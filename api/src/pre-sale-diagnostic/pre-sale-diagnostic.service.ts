import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiagnosticHealthTier } from '@prisma/client';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';
import {
  DIAGNOSTIC_AVG_DAYS_HIGH,
  DIAGNOSTIC_AVG_DAYS_MODERATE,
  DIAGNOSTIC_BASE_SCORE,
  DIAGNOSTIC_DEDUCTIONS,
  DIAGNOSTIC_OVERDUE_PCT_HIGH,
  DIAGNOSTIC_OVERDUE_PCT_MODERATE,
  DIAGNOSTIC_TIER_OPORTUNIDADES_MIN,
  DIAGNOSTIC_TIER_SALUDABLE_MIN,
} from './pre-sale-diagnostic.constants';

export interface DiagnosticAnalysis {
  score: number;
  tier: DiagnosticHealthTier;
  recommendations: string[];
}

const DIAGNOSTIC_TIER_LABELS: Record<DiagnosticHealthTier, string> = {
  SALUDABLE: 'Cobranza saludable',
  OPORTUNIDADES: 'Hay oportunidades claras',
  RIESGO_ALTO: 'Riesgo alto de fuga de flujo de caja',
};

/**
 * "Diagnóstico" pre-venta (Fase 4, concepto de Paolo): formulario guiado
 * público para un prospecto, ANTES de contratar. Pasos 1-2 del concepto
 * ("analizar su situación actual" + "entregar un primer análisis de áreas
 * a mejorar, sin decir mucho"). El paso 3 (alimentar la plataforma con su
 * CSV/clientes/historial) es Fase 5, ya con cuenta — no vive aquí.
 */
@Injectable()
export class PreSaleDiagnosticService {
  private readonly logger = new Logger(PreSaleDiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get leadsEmail(): string | string[] {
    const raw =
      this.config.get('LEADS_EMAIL', { infer: true }) || 'hello@royaltica.com';
    const addresses = raw
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    return addresses.length > 1 ? addresses : addresses[0];
  }

  async submit(dto: SubmitDiagnosticDto) {
    // Honeypot (mismo criterio que MarketingService): bot detectado, 200
    // falso, no se guarda ni se notifica nada.
    if (dto.website && dto.website.trim() !== '') {
      this.logger.warn(`[SPAM diagnostico] Honeypot activado desde ${dto.contactEmail}`);
      return this.fakeResult();
    }

    const analysis = this.analyze(dto);

    const record = await this.prisma.preSaleDiagnostic.create({
      data: {
        contactName: dto.contactName,
        contactEmail: dto.contactEmail.toLowerCase(),
        company: dto.company ?? null,
        phone: dto.phone ?? null,
        hasCollectionPolicy: dto.hasCollectionPolicy,
        collectionMethod: dto.collectionMethod,
        avgDaysToCollect: dto.avgDaysToCollect,
        overduePortfolioPct: dto.overduePortfolioPct,
        portfolioSize: dto.portfolioSize ?? null,
        usesSoftware: dto.usesSoftware,
        score: analysis.score,
        tier: analysis.tier,
        recommendations: analysis.recommendations,
        source: dto.source ?? null,
      },
    });

    await this.sendInternalNotification(dto, analysis, record.id);
    await this.sendProspectResult(dto, analysis);
    await this.notifySuperadmins(dto, analysis, record.id);

    this.logger.warn(
      `[DIAGNOSTICO] ${dto.contactEmail} (${dto.company ?? 's/empresa'}) — score=${analysis.score} tier=${analysis.tier} id=${record.id}`,
    );

    return { id: record.id, ...analysis };
  }

  /** Recupera un diagnóstico ya respondido (liga compartible, id opaco UUID). */
  async findOne(id: string) {
    const record = await this.prisma.preSaleDiagnostic.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('Diagnóstico no encontrado.');
    return {
      id: record.id,
      contactName: record.contactName,
      company: record.company,
      score: record.score,
      tier: record.tier,
      recommendations: record.recommendations,
      createdAt: record.createdAt,
    };
  }

  /**
   * Regla determinista (sin IA, sin costo): arranca en 100 y descuenta por
   * cada señal de riesgo. El resultado siempre se puede explicar en una
   * frase — mismo criterio que CustomerRiskService (Fase 1).
   */
  analyze(dto: SubmitDiagnosticDto): DiagnosticAnalysis {
    let score = DIAGNOSTIC_BASE_SCORE;
    const recommendations: string[] = [];

    if (!dto.hasCollectionPolicy) {
      score -= DIAGNOSTIC_DEDUCTIONS.noPolicy;
      recommendations.push(
        'Definir una política de cobranza formal (días de gracia, escalamiento, canales por etapa) estandariza el proceso y reduce la dependencia de una sola persona.',
      );
    }

    if (dto.collectionMethod === 'NINGUNO') {
      score -= DIAGNOSTIC_DEDUCTIONS.noProcess;
      recommendations.push(
        'Hoy no hay un seguimiento sistemático: empezar con recordatorios automáticos desde antes del vencimiento suele ser la mejora de mayor impacto.',
      );
    } else if (dto.collectionMethod === 'MANUAL_EXCEL' || dto.collectionMethod === 'LLAMADAS') {
      score -= DIAGNOSTIC_DEDUCTIONS.manualProcess;
      recommendations.push(
        'El seguimiento manual es propenso a que se te vaya un cliente entre las manos: automatizar los recordatorios tempranos libera tiempo del equipo para los casos que de verdad necesitan una llamada.',
      );
    }

    if (dto.avgDaysToCollect > DIAGNOSTIC_AVG_DAYS_HIGH) {
      score -= DIAGNOSTIC_DEDUCTIONS.highAvgDays;
      recommendations.push(
        `${dto.avgDaysToCollect} días promedio para cobrar es alto: un proceso de cobranza temprana (antes del vencimiento, no después) reduce directamente este número.`,
      );
    } else if (dto.avgDaysToCollect > DIAGNOSTIC_AVG_DAYS_MODERATE) {
      score -= DIAGNOSTIC_DEDUCTIONS.moderateAvgDays;
    }

    if (dto.overduePortfolioPct > DIAGNOSTIC_OVERDUE_PCT_HIGH) {
      score -= DIAGNOSTIC_DEDUCTIONS.highOverduePct;
      recommendations.push(
        `Con ${dto.overduePortfolioPct}% de tu cartera vencida hay una oportunidad clara de recuperar flujo de caja con un proceso más consistente de seguimiento.`,
      );
    } else if (dto.overduePortfolioPct > DIAGNOSTIC_OVERDUE_PCT_MODERATE) {
      score -= DIAGNOSTIC_DEDUCTIONS.moderateOverduePct;
    }

    if (!dto.usesSoftware) {
      score -= DIAGNOSTIC_DEDUCTIONS.noSoftware;
    }

    score = Math.max(0, Math.min(100, score));

    const tier =
      score >= DIAGNOSTIC_TIER_SALUDABLE_MIN
        ? DiagnosticHealthTier.SALUDABLE
        : score >= DIAGNOSTIC_TIER_OPORTUNIDADES_MIN
          ? DiagnosticHealthTier.OPORTUNIDADES
          : DiagnosticHealthTier.RIESGO_ALTO;

    if (recommendations.length === 0) {
      recommendations.push(
        'Tu cobranza ya tiene bases sólidas: el siguiente paso es ganar consistencia y visibilidad sin perder el toque personal que ya funciona.',
      );
    }

    return { score, tier, recommendations: recommendations.slice(0, 3) };
  }

  private fakeResult(): { id: null; score: number; tier: DiagnosticHealthTier; recommendations: string[] } {
    return { id: null, score: 0, tier: DiagnosticHealthTier.RIESGO_ALTO, recommendations: [] };
  }

  private async sendInternalNotification(
    dto: SubmitDiagnosticDto,
    analysis: DiagnosticAnalysis,
    id: string,
  ): Promise<void> {
    await this.email
      .send({
        to: this.leadsEmail,
        subject: `🩺 Nuevo diagnóstico de cobranza: ${dto.company ?? dto.contactName} (${analysis.tier})`,
        html: this.internalHtml(dto, analysis, id),
        text: this.internalText(dto, analysis, id),
      })
      .catch((err) =>
        this.logger.error(`Fallo enviando correo interno de diagnóstico: ${err}`),
      );
  }

  /** Correo de "primer análisis" al prospecto — el valor inmediato del
   * diagnóstico, con las recomendaciones ya generadas pero sin la receta
   * completa (eso se reserva para cuando ya es cliente). */
  private async sendProspectResult(
    dto: SubmitDiagnosticDto,
    analysis: DiagnosticAnalysis,
  ): Promise<void> {
    try {
      const tierLabel = DIAGNOSTIC_TIER_LABELS[analysis.tier];
      await this.email.send({
        to: dto.contactEmail,
        subject: `Tu diagnóstico de cobranza: ${tierLabel} · Royáltica`,
        html: this.prospectHtml(dto, analysis, tierLabel),
        text: this.prospectText(dto, analysis, tierLabel),
      });
    } catch (err) {
      this.logger.error(
        `Fallo enviando el primer análisis al prospecto: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async notifySuperadmins(
    dto: SubmitDiagnosticDto,
    analysis: DiagnosticAnalysis,
    id: string,
  ): Promise<void> {
    const admins = await this.prisma.user
      .findMany({ where: { role: 'SUPERADMIN', isActive: true }, select: { id: true } })
      .catch(() => [] as { id: string }[]);
    await Promise.all(
      admins.map((a) =>
        this.notifications
          .create({
            userId: a.id,
            type: 'PRE_SALE_DIAGNOSTIC_SUBMITTED',
            title: 'Nuevo diagnóstico de cobranza respondido',
            body: `${dto.contactName} (${dto.company ?? dto.contactEmail}) — ${analysis.tier}, score ${analysis.score}.`,
            metadata: { diagnosticId: id },
          })
          .catch(() => undefined),
      ),
    );
  }

  private internalHtml(dto: SubmitDiagnosticDto, a: DiagnosticAnalysis, id: string): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px">${escapeHtml(dto.company ?? dto.contactName)} — ${a.tier} (${a.score}/100)</h1>
  <p>${escapeHtml(dto.contactName)} · <a href="mailto:${escapeHtml(dto.contactEmail)}">${escapeHtml(dto.contactEmail)}</a>${dto.phone ? ` · ${escapeHtml(dto.phone)}` : ''}</p>
  <ul>
    <li>Política de cobranza: ${dto.hasCollectionPolicy ? 'sí' : 'no'}</li>
    <li>Método actual: ${dto.collectionMethod}</li>
    <li>Días promedio para cobrar: ${dto.avgDaysToCollect}</li>
    <li>% cartera vencida: ${dto.overduePortfolioPct}%</li>
    <li>Usa software hoy: ${dto.usesSoftware ? 'sí' : 'no'}</li>
    ${dto.portfolioSize ? `<li>Tamaño de cartera: ${dto.portfolioSize} clientes</li>` : ''}
  </ul>
  <p style="font-size:12px;color:#999">id=${id}</p>
</div>`;
  }

  private internalText(dto: SubmitDiagnosticDto, a: DiagnosticAnalysis, id: string): string {
    return [
      `${dto.company ?? dto.contactName} — ${a.tier} (${a.score}/100)`,
      `${dto.contactName} · ${dto.contactEmail}${dto.phone ? ` · ${dto.phone}` : ''}`,
      `Política de cobranza: ${dto.hasCollectionPolicy ? 'sí' : 'no'}`,
      `Método actual: ${dto.collectionMethod}`,
      `Días promedio para cobrar: ${dto.avgDaysToCollect}`,
      `% cartera vencida: ${dto.overduePortfolioPct}%`,
      `Usa software hoy: ${dto.usesSoftware ? 'sí' : 'no'}`,
      dto.portfolioSize && `Tamaño de cartera: ${dto.portfolioSize} clientes`,
      `id=${id}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private prospectHtml(dto: SubmitDiagnosticDto, a: DiagnosticAnalysis, tierLabel: string): string {
    return `<!doctype html><meta charset="utf-8"/>
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111;max-width:600px;margin:0 auto;padding:24px">
  <div style="border-left:4px solid #C9A961;padding-left:16px;margin-bottom:24px">
    <div style="text-transform:uppercase;letter-spacing:2px;font-size:11px;color:#666">Tu diagnóstico de cobranza</div>
    <h1 style="margin:8px 0 0;font-size:24px">${escapeHtml(tierLabel)}</h1>
  </div>
  <p>Hola ${escapeHtml(dto.contactName)}, esto es lo que vemos con lo que nos compartiste:</p>
  <ul>
    ${a.recommendations.map((r) => `<li style="margin-bottom:8px">${escapeHtml(r)}</li>`).join('')}
  </ul>
  <p style="margin-top:24px">Con Royáltica esto se automatiza de principio a fin. Si quieres, platicamos los detalles.</p>
  <p style="margin-top:32px;font-size:12px;color:#999">— Equipo Royáltica</p>
</div>`;
  }

  private prospectText(dto: SubmitDiagnosticDto, a: DiagnosticAnalysis, tierLabel: string): string {
    return [
      `Tu diagnóstico de cobranza: ${tierLabel}`,
      '',
      `Hola ${dto.contactName}, esto es lo que vemos:`,
      ...a.recommendations.map((r) => `- ${r}`),
      '',
      'Con Royáltica esto se automatiza de principio a fin. Si quieres, platicamos los detalles.',
    ].join('\n');
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
