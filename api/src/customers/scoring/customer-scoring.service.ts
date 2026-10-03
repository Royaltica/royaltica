import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SCORE_DROP_ALERT_THRESHOLD } from './customer-scoring.constants';

export interface CustomerScoreResult {
  score: number;
  previousScore: number | null;
  /** true si la caída respecto al score anterior es >= SCORE_DROP_ALERT_THRESHOLD. */
  droppedSignificantly: boolean;
  computedAt: string;
}

/**
 * Score de puntualidad 0-100 por cliente (FR-04, spec "Mejoras V1"):
 * % de facturas CxC pagadas en o antes de su vencimiento. MISMA fórmula que
 * DashboardService.computeCustomerStats (onTimePct) para que el número que
 * ve Supervisión en el dashboard y el que dispara alertas/guardrails sea
 * siempre el mismo — la diferencia es que aquí SÍ se persiste, lo que
 * permite comparar contra el valor anterior y detectar una caída (el
 * dashboard la calcula al vuelo y no tiene memoria entre una corrida y
 * la siguiente).
 *
 * Es DETERMINISTA (mismas facturas → mismo score), igual que
 * SupplierScoringService: nada de IA en el cálculo, para que sea auditable.
 */
@Injectable()
export class CustomerScoringService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recalcula y persiste el score de un cliente (scoped al org del usuario). */
  async recompute(
    user: AuthenticatedUser,
    customerId: string,
  ): Promise<CustomerScoreResult> {
    const organizationId = this.requireOrg(user);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
      select: { id: true, score: true },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    return this.recomputeOne(customer.id, customer.score);
  }

  /**
   * Núcleo reutilizable por el cron diario (JobsService), que itera muchos
   * clientes sin un AuthenticatedUser de por medio.
   */
  async recomputeOne(
    customerId: string,
    previousScore: number | null,
  ): Promise<CustomerScoreResult> {
    const invoices = await this.prisma.invoice.findMany({
      where: { customerId, direction: 'RECEIVABLE', deletedAt: null },
      select: { status: true, dueDate: true, paidDate: true },
    });

    const score = this.punctualityScore(invoices);
    const computedAt = new Date();
    await this.prisma.customer.update({
      where: { id: customerId },
      data: { score, scoreUpdatedAt: computedAt },
    });

    const droppedSignificantly =
      previousScore != null && previousScore - score >= SCORE_DROP_ALERT_THRESHOLD;

    return {
      score,
      previousScore,
      droppedSignificantly,
      computedAt: computedAt.toISOString(),
    };
  }

  /**
   * % de facturas pagadas en o antes de su vencimiento, sobre el total de
   * facturas pagadas CON fecha de vencimiento (igual que
   * DashboardService.computeCustomerStats: una factura pagada sin dueDate no
   * cuenta ni a favor ni en contra). Sin facturas "liquidables" → 50
   * (neutral: ni buen ni mal pagador, aún no hay historial suficiente).
   */
  private punctualityScore(
    invoices: {
      status: InvoiceStatus;
      dueDate: Date | null;
      paidDate: Date | null;
    }[],
  ): number {
    const settled = invoices.filter(
      (i) => i.status === InvoiceStatus.PAID && i.paidDate && i.dueDate,
    );
    if (settled.length === 0) return 50;
    const onTime = settled.filter(
      (i) => (i.paidDate as Date).getTime() <= (i.dueDate as Date).getTime(),
    ).length;
    return Math.round((onTime / settled.length) * 100);
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
