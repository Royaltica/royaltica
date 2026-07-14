import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ForensicStatus, InvoiceStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../../gemini/gemini.service';
import { SatService } from '../../sat/sat.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

/** Versión del motor de auditoría — se guarda en cada log para trazabilidad. */
const ENGINE_VERSION = '1.0';
/** Tolerancia (pesos) para la suma subtotal + iva = total. */
const MATH_TOLERANCE = 0.01;
/** Múltiplo del promedio histórico a partir del cual un monto es atípico. */
const AMOUNT_OUTLIER_FACTOR = 3;

export interface ForensicCheck {
  code: string;
  label: string;
  passed: boolean;
  /** Si falla, cuántos puntos resta y si es bloqueante. */
  pointsDeducted: number;
  blocking: boolean;
  detail: string;
}

export interface AiAnalysis {
  provider: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  additionalConcerns: string[];
}

/**
 * Motor de auditoría forense de facturas.
 *
 * El `forensicScore` (0-100) es **determinista**: se calcula con reglas
 * verificables (consistencia matemática, RFC emisor/receptor, duplicados,
 * monto atípico). Esto lo hace reproducible y defendible para compliance.
 *
 * Gemini agrega un análisis cualitativo (resumen + nivel de riesgo +
 * preocupaciones adicionales) pero NO altera el score numérico. Si Gemini
 * no está configurado, la auditoría sigue funcionando solo con las reglas.
 *
 * El resultado se guarda inmutable en InvoiceAuditLog.
 */
@Injectable()
export class InvoiceAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly sat: SatService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async audit(user: AuthenticatedUser, invoiceId: string) {
    const organizationId = this.requireOrg(user);

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId, deletedAt: null },
      include: {
        supplier: { select: { id: true, rfc: true, name: true } },
        organization: { select: { rfc: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');

    if (
      invoice.status !== InvoiceStatus.PENDING &&
      invoice.status !== InvoiceStatus.AUDITED
    ) {
      throw new ConflictException(
        'Solo se pueden auditar facturas en estado PENDING o AUDITED.',
      );
    }

    const subtotal = Number(invoice.subtotal);
    const iva = Number(invoice.iva);
    const total = Number(invoice.total);

    // ── Contexto histórico del proveedor (para detectar atípicos) ──
    const [dupCount, history] = await Promise.all([
      this.prisma.invoice.count({
        where: {
          organizationId,
          supplierId: invoice.supplierId,
          total: invoice.total,
          date: invoice.date,
          deletedAt: null,
          id: { not: invoice.id },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId,
          supplierId: invoice.supplierId,
          deletedAt: null,
          id: { not: invoice.id },
        },
        _avg: { total: true },
        _count: { _all: true },
      }),
    ]);

    const historicalAvg = history._avg.total ? Number(history._avg.total) : null;

    // ── Reglas deterministas ──
    const checks: ForensicCheck[] = [];

    const mathOk = Math.abs(subtotal + iva - total) <= MATH_TOLERANCE;
    checks.push({
      code: 'MATH_CONSISTENCY',
      label: 'Consistencia subtotal + IVA = total',
      passed: mathOk,
      pointsDeducted: mathOk ? 0 : 25,
      blocking: false,
      detail: mathOk
        ? 'Los montos cuadran.'
        : `subtotal (${subtotal}) + iva (${iva}) ≠ total (${total}).`,
    });

    const emisorOk =
      invoice.rfcEmisor.toUpperCase() === invoice.supplier.rfc.toUpperCase();
    checks.push({
      code: 'RFC_EMISOR_MATCH',
      label: 'RFC emisor coincide con el proveedor',
      passed: emisorOk,
      pointsDeducted: emisorOk ? 0 : 30,
      blocking: false,
      detail: emisorOk
        ? 'El RFC emisor corresponde al proveedor registrado.'
        : `RFC emisor (${invoice.rfcEmisor}) ≠ RFC del proveedor (${invoice.supplier.rfc}).`,
    });

    const receptorOk =
      invoice.rfcReceptor.toUpperCase() ===
      invoice.organization.rfc.toUpperCase();
    checks.push({
      code: 'RFC_RECEPTOR_MATCH',
      label: 'RFC receptor coincide con la organización',
      passed: receptorOk,
      pointsDeducted: receptorOk ? 0 : 15,
      blocking: false,
      detail: receptorOk
        ? 'El RFC receptor corresponde a la organización.'
        : `RFC receptor (${invoice.rfcReceptor}) ≠ RFC de la organización (${invoice.organization.rfc}).`,
    });

    const noDuplicate = dupCount === 0;
    checks.push({
      code: 'DUPLICATE_LIKELY',
      label: 'Sin duplicados por proveedor/monto/fecha',
      passed: noDuplicate,
      pointsDeducted: noDuplicate ? 0 : 50,
      blocking: !noDuplicate,
      detail: noDuplicate
        ? 'No se detectaron facturas duplicadas.'
        : `Existen ${dupCount} factura(s) con mismo proveedor, monto y fecha.`,
    });

    const amountOk =
      historicalAvg === null || total <= historicalAvg * AMOUNT_OUTLIER_FACTOR;
    checks.push({
      code: 'AMOUNT_OUTLIER',
      label: 'Monto dentro del rango histórico del proveedor',
      passed: amountOk,
      pointsDeducted: amountOk ? 0 : 15,
      blocking: false,
      detail:
        historicalAvg === null
          ? 'Sin histórico suficiente para comparar.'
          : amountOk
            ? `Monto dentro del rango (promedio histórico ${historicalAvg.toFixed(2)}).`
            : `Monto (${total}) supera ${AMOUNT_OUTLIER_FACTOR}x el promedio histórico (${historicalAvg.toFixed(2)}).`,
    });

    // ── Lista 69-B del SAT (EFOS/EDOS) ──
    const efos = await this.sat.check69b(invoice.rfcEmisor);
    checks.push({
      code: 'SAT_69B_EFOS',
      label: 'Emisor fuera de la lista 69-B del SAT',
      passed: !efos.listed,
      pointsDeducted: efos.listed ? 50 : 0,
      blocking: efos.listed,
      detail: efos.listed
        ? `RFC emisor en lista 69-B (estatus ${efos.status}). Riesgo fiscal: deducción no procedente.`
        : 'El emisor no aparece en la lista 69-B.',
    });

    // ── Verificación ante el SAT ──
    const satResult = await this.sat.verifyCfdi({
      cfdiUuid: invoice.cfdiUuid,
      rfcEmisor: invoice.rfcEmisor,
      rfcReceptor: invoice.rfcReceptor,
      total,
    });
    const satBlocking = satResult.status === 'Cancelado';
    const satDiscrepancy =
      satResult.status === 'No Encontrado' ||
      satResult.status === 'No Verificado';

    // ── Score determinista ──
    const deductions = checks.reduce((acc, c) => acc + c.pointsDeducted, 0);
    const forensicScore = Math.max(0, Math.min(100, 100 - deductions));
    const hasBlocking = checks.some((c) => !c.passed && c.blocking);

    let forensicStatus: ForensicStatus;
    if (hasBlocking || satBlocking || forensicScore < 50) {
      forensicStatus = ForensicStatus.BLOCKED;
    } else if (forensicScore < 80 || satDiscrepancy) {
      forensicStatus = ForensicStatus.DISCREPANCY;
    } else {
      forensicStatus = ForensicStatus.VALIDATED;
    }

    // ── Análisis cualitativo con Gemini (no altera el score) ──
    const ai = await this.runGemini(
      invoice,
      checks,
      {
        satStatus: satResult.status,
        historicalAvg,
        historyCount: history._count._all,
      },
      organizationId,
    );

    const auditAnalysis = {
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
      score: forensicScore,
      status: forensicStatus,
      checks,
      sat: satResult,
      ai,
    };

    // ── Persistencia: actualiza factura + log inmutable ──
    const previousStatus = invoice.status;
    const newStatus =
      invoice.status === InvoiceStatus.PENDING
        ? InvoiceStatus.AUDITED
        : invoice.status;

    const [updated] = await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          forensicScore,
          forensicStatus,
          auditAnalysis: auditAnalysis as unknown as Prisma.InputJsonValue,
          satStatus: satResult.status,
          status: newStatus,
        },
      }),
      this.prisma.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: user.id,
          action: 'AUDIT',
          previousStatus,
          newStatus,
          metadata: {
            forensicScore,
            forensicStatus,
            satStatus: satResult.status,
            aiProvider: ai ? ai.provider : null,
            failedChecks: checks.filter((c) => !c.passed).map((c) => c.code),
          } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    // ── Alerta crítica: factura bloqueada por la auditoría ──
    if (forensicStatus === ForensicStatus.BLOCKED) {
      await this.alertBlocked(organizationId, invoice);
    }

    return {
      invoiceId: updated.id,
      status: updated.status,
      forensicScore,
      forensicStatus,
      satStatus: satResult.status,
      analysis: auditAnalysis,
    };
  }

  /**
   * Notifica a los admins (in-app + WhatsApp opt-in) que una factura quedó
   * bloqueada. Crítico: una factura bloqueada implica riesgo fiscal/fraude.
   * No bloquea la respuesta de la auditoría si la alerta falla.
   */
  private async alertBlocked(
    organizationId: string,
    invoice: { id: string; folio: string | null; supplier: { name: string } },
  ): Promise<void> {
    const ref = invoice.folio ?? invoice.id;
    const title = 'Factura bloqueada';
    const body = `La factura ${ref} de ${invoice.supplier.name} fue BLOQUEADA por la auditoría forense. Revísala antes de aprobar o pagar.`;
    try {
      await this.notifications.notifyOrgAdmins(organizationId, {
        type: 'INVOICE_BLOCKED',
        title,
        body,
        metadata: { invoiceId: invoice.id },
      });
      void this.whatsapp.notifyOrgAdmins(
        organizationId,
        `🚫 Royáltica · ${title}: ${body}`,
      );
    } catch {
      // La telemetría/alerta no debe tumbar la auditoría.
    }
  }

  // ── helpers ───────────────────────────────────────────────

  private async runGemini(
    invoice: {
      cfdiUuid: string;
      rfcEmisor: string;
      rfcReceptor: string;
      subtotal: Prisma.Decimal;
      iva: Prisma.Decimal;
      total: Prisma.Decimal;
      date: Date;
      supplier: { name: string };
    },
    checks: ForensicCheck[],
    context: {
      satStatus: string;
      historicalAvg: number | null;
      historyCount: number;
    },
    organizationId: string,
  ): Promise<AiAnalysis | null> {
    if (!this.gemini.isConfigured) return null;

    const prompt = [
      'Eres un auditor forense de facturas (CFDI) en México. Analiza la siguiente factura',
      'y las verificaciones automáticas ya realizadas. Responde SOLO con un objeto JSON',
      'con esta forma exacta:',
      '{ "summary": string (máx 280 caracteres, en español),',
      '  "riskLevel": "low" | "medium" | "high",',
      '  "additionalConcerns": string[] (preocupaciones no cubiertas por las reglas, máx 5) }',
      '',
      'FACTURA:',
      JSON.stringify({
        proveedor: invoice.supplier.name,
        cfdiUuid: invoice.cfdiUuid,
        rfcEmisor: invoice.rfcEmisor,
        rfcReceptor: invoice.rfcReceptor,
        subtotal: Number(invoice.subtotal),
        iva: Number(invoice.iva),
        total: Number(invoice.total),
        fecha: invoice.date.toISOString(),
      }),
      '',
      'VERIFICACIONES AUTOMÁTICAS:',
      JSON.stringify(
        checks.map((c) => ({
          regla: c.code,
          aprobada: c.passed,
          detalle: c.detail,
        })),
      ),
      '',
      'CONTEXTO:',
      JSON.stringify(context),
    ].join('\n');

    const result = await this.gemini.generateJson<{
      summary?: unknown;
      riskLevel?: unknown;
      additionalConcerns?: unknown;
    }>(prompt, { organizationId, feature: 'GEMINI_AUDIT' });
    if (!result) return null;

    const riskLevel =
      result.riskLevel === 'low' ||
      result.riskLevel === 'medium' ||
      result.riskLevel === 'high'
        ? result.riskLevel
        : 'medium';

    return {
      provider: 'gemini',
      summary:
        typeof result.summary === 'string'
          ? result.summary.slice(0, 280)
          : 'Sin resumen.',
      riskLevel,
      additionalConcerns: Array.isArray(result.additionalConcerns)
        ? result.additionalConcerns
            .filter((c): c is string => typeof c === 'string')
            .slice(0, 5)
        : [],
    };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
