import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  buildPortfolioReport,
  type InvoiceInput,
  type PortfolioReportData,
} from './portfolio-analysis.calc';
import {
  lastClosedPeriod,
  periodContaining,
  previousPeriod,
  type ReportFrequency,
} from './portfolio-period.util';

/**
 * Análisis periódico de cartera — pasos 1 a 3:
 *  1. JALAR: clientes, facturas de venta y mensajes de WhatsApp de la org.
 *  2. DEPURAR: detecta datos incompletos o raros (ver dataQualityIssues).
 *  3. CALCULAR: métricas por cliente al cierre del periodo, comparación
 *     contra el periodo anterior y estadística por tipo de cliente.
 * El resultado se guarda en PortfolioReport (historial). La IA (paso 4) se
 * agrega después encima de estos números, sin recalcularlos.
 */
@Injectable()
export class PortfolioAnalysisService {
  private readonly logger = new Logger(PortfolioAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ── Lectura (pantalla) ────────────────────────────────────

  async list(user: AuthenticatedUser) {
    const organizationId = this.requireViewer(user);
    const [rows, settings] = await Promise.all([
      this.prisma.withOrg(organizationId, (tx) =>
        tx.portfolioReport.findMany({
          where: { organizationId },
          orderBy: { periodFrom: 'desc' },
          take: 24,
          select: { id: true, frequency: true, periodFrom: true, periodTo: true, generatedAt: true, data: true },
        }),
      ),
      this.settings.get(organizationId),
    ]);
    return {
      frequency: settings.portfolioReportFrequency,
      reports: rows.map((r) => ({
        id: r.id,
        frequency: r.frequency,
        periodFrom: r.periodFrom,
        periodTo: r.periodTo,
        label: (r.data as unknown as PortfolioReportData).period?.label ?? '',
        generatedAt: r.generatedAt,
      })),
    };
  }

  async get(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireViewer(user);
    const row = await this.prisma.withOrg(organizationId, (tx) =>
      tx.portfolioReport.findFirst({ where: { id, organizationId } }),
    );
    if (!row) throw new NotFoundException('Reporte no encontrado.');
    return row;
  }

  async setFrequency(user: AuthenticatedUser, frequency: ReportFrequency) {
    const organizationId = this.requireAdmin(user);
    const next = await this.settings.update(organizationId, { portfolioReportFrequency: frequency });
    return { frequency: next.portfolioReportFrequency };
  }

  /**
   * "Generar ahora" desde la pantalla. `current=true` analiza el periodo EN
   * CURSO hasta hoy (vista previa, útil para probar); por defecto, el último
   * periodo ya cerrado. Si ya existía un reporte de ese periodo, se recalcula.
   */
  async generateNow(
    user: AuthenticatedUser,
    opts: { frequency?: ReportFrequency; current?: boolean },
  ) {
    const organizationId = this.requireAdmin(user);
    const settings = await this.settings.get(organizationId);
    const frequency = opts.frequency ?? settings.portfolioReportFrequency;
    const now = new Date();
    const period = opts.current
      ? { ...periodContaining(frequency, now), to: now }
      : lastClosedPeriod(frequency, now);
    if (opts.current) period.label = `${period.label} (al día de hoy)`;
    return this.generate(organizationId, frequency, period, user.id);
  }

  // ── Generación (cron y "Generar ahora") ───────────────────

  /**
   * Cron: para cada org activa, si ya cerró un periodo de SU frecuencia y no
   * existe su reporte, lo genera. Idempotente: correrlo dos veces el mismo día
   * no duplica nada (llave única org + frecuencia + inicio del periodo).
   */
  async runScheduled(now = new Date()): Promise<{ generated: number; skipped: number }> {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    let generated = 0;
    let skipped = 0;
    for (const org of orgs) {
      try {
        const { portfolioReportFrequency: frequency } = await this.settings.get(org.id);
        const period = lastClosedPeriod(frequency, now);
        const exists = await this.prisma.withOrg(org.id, (tx) =>
          tx.portfolioReport.findUnique({
            where: {
              organizationId_frequency_periodFrom: {
                organizationId: org.id,
                frequency,
                periodFrom: period.from,
              },
            },
            select: { id: true },
          }),
        );
        if (exists) {
          skipped += 1;
          continue;
        }
        const hasData = await this.prisma.withOrg(org.id, (tx) =>
          tx.invoice.count({ where: { organizationId: org.id, direction: 'RECEIVABLE', deletedAt: null } }),
        );
        if (hasData === 0) {
          skipped += 1;
          continue;
        }
        await this.generate(org.id, frequency, period, null);
        generated += 1;
      } catch (err) {
        this.logger.warn(
          `No se pudo generar el análisis de cartera de ${org.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log(`portfolio-analysis: ${generated} generado(s), ${skipped} omitido(s).`);
    return { generated, skipped };
  }

  private async generate(
    organizationId: string,
    frequency: ReportFrequency,
    period: { from: Date; to: Date; label: string },
    userId: string | null,
  ) {
    const previous = previousPeriod(frequency, period);

    // 1. JALAR — todo de una vez, con RLS de la org.
    const { customers, invoices, messages } = await this.prisma.withOrg(organizationId, async (tx) => {
      const [customers, invoices, messages] = await Promise.all([
        tx.customer.findMany({
          where: { organizationId, deletedAt: null },
          select: {
            id: true,
            name: true,
            category: true,
            creditLimitDays: true,
            phone: true,
            email: true,
            financeContactPhone: true,
            financeContactEmail: true,
            doNotContact: true,
            isActive: true,
          },
        }),
        tx.invoice.findMany({
          where: { organizationId, direction: 'RECEIVABLE', deletedAt: null },
          select: {
            id: true,
            customerId: true,
            folio: true,
            total: true,
            date: true,
            dueDate: true,
            status: true,
            paidDate: true,
          },
        }),
        tx.whatsappMessage.findMany({
          where: { organizationId, createdAt: { lt: period.to } },
          select: {
            customerId: true,
            invoiceId: true,
            direction: true,
            kind: true,
            templateName: true,
            sent: true,
            createdAt: true,
          },
        }),
      ]);
      return { customers, invoices, messages };
    });

    // 2 y 3. DEPURAR + CALCULAR (funciones puras).
    const data = buildPortfolioReport({
      frequency,
      period,
      previous,
      customers,
      invoices: invoices.map(
        (i): InvoiceInput => ({ ...i, total: Number(i.total), status: i.status as InvoiceInput['status'] }),
      ),
      messages,
    });

    const json = data as unknown as Prisma.InputJsonValue;
    return this.prisma.withOrg(organizationId, (tx) =>
      tx.portfolioReport.upsert({
        where: {
          organizationId_frequency_periodFrom: { organizationId, frequency, periodFrom: period.from },
        },
        create: {
          organizationId,
          frequency,
          periodFrom: period.from,
          periodTo: period.to,
          data: json,
          generatedByUserId: userId,
        },
        update: { periodTo: period.to, data: json, generatedByUserId: userId, generatedAt: new Date() },
      }),
    );
  }

  // ── permisos ──────────────────────────────────────────────

  /** El análisis es de TODA la cartera: un Agente solo ve a sus clientes. */
  private requireViewer(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    if (user.operationalProfile === 'AGENTE_EJECUTIVO') {
      throw new ForbiddenException('El análisis de cartera es para Administración y Supervisión.');
    }
    return user.organizationId;
  }

  private requireAdmin(user: AuthenticatedUser): string {
    const org = this.requireViewer(user);
    if (user.role !== 'CORPORATE_ADMIN' && user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Solo un administrador puede generar el análisis o cambiar su frecuencia.');
    }
    return org;
  }
}
