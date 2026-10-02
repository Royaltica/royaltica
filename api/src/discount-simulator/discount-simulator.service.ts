import { ForbiddenException, Injectable } from '@nestjs/common';
import { InvoiceStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  CASTIGADA_BUCKETS,
  type CastigadaBucket,
  type SimulateDiscountDto,
} from './dto/simulate-discount.dto';

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);

type BucketKey = Exclude<CastigadaBucket, 'all'>;

/**
 * Tasa de recuperación ASUMIDA sin descuento, por balde de cartera castigada
 * (cuanto más vieja la deuda, menos probable que se cobre). Son supuestos de
 * industria razonables, no datos medidos — Royáltica aún no tiene historial
 * de campañas de quita para calibrarlos con datos propios. El Supervisor ve
 * estos supuestos en la respuesta (`assumptions`) y puede ajustarlos
 * mentalmente; el valor del simulador es comparar escenarios de forma
 * consistente, no predecir con precisión absoluta.
 */
const BASELINE_RECOVERY_RATE: Record<BucketKey, number> = {
  d91_180: 0.25,
  d181_300: 0.12,
  d300_plus: 0.05,
};

/** +0.6 puntos porcentuales de probabilidad de cobro por cada 1% de descuento ofrecido. */
const UPLIFT_PER_DISCOUNT_POINT = 0.006;
/** Tope de realismo: ni con 90% de descuento se asume que cobras más del 85% de una cartera castigada. */
const MAX_RECOVERY_RATE = 0.85;

const classify = (daysOverdue: number): BucketKey | null => {
  if (daysOverdue <= 90) return null; // no es "castigada" todavía
  if (daysOverdue <= 180) return 'd91_180';
  if (daysOverdue <= 300) return 'd181_300';
  return 'd300_plus';
};

/**
 * FR-03 (spec "Mejoras V1"): motor de simulación de quitas/descuentos por
 * pronto pago sobre carteras castigadas, para campañas especiales (Black
 * Friday / Buen Fin). Responde a la pregunta del Supervisor: "¿me conviene
 * ofrecer X% de descuento a esta cartera, o pierdo más de lo que recupero?"
 */
@Injectable()
export class DiscountSimulatorService {
  constructor(private readonly prisma: PrismaService) {}

  async simulate(user: AuthenticatedUser, dto: SimulateDiscountDto) {
    const organizationId = this.requireOrg(user);
    const targetBuckets: BucketKey[] =
      !dto.bucket || dto.bucket === 'all'
        ? (CASTIGADA_BUCKETS.filter((b) => b !== 'all') as BucketKey[])
        : [dto.bucket];

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PENDING,
      },
      select: { id: true, total: true, date: true, dueDate: true, customerId: true },
    });

    const now = Date.now();
    let outstandingAmount = 0;
    let invoiceCount = 0;
    const customerIds = new Set<string>();
    const byBucket: Record<BucketKey, { amount: number; count: number }> = {
      d91_180: { amount: 0, count: 0 },
      d181_300: { amount: 0, count: 0 },
      d300_plus: { amount: 0, count: 0 },
    };

    for (const inv of invoices) {
      const reference = (inv.dueDate ?? inv.date).getTime();
      const daysOverdue = Math.floor((now - reference) / 86_400_000);
      const bucket = classify(daysOverdue);
      if (!bucket || !targetBuckets.includes(bucket)) continue;

      const amount = num(inv.total);
      outstandingAmount += amount;
      invoiceCount += 1;
      byBucket[bucket].amount += amount;
      byBucket[bucket].count += 1;
      if (inv.customerId) customerIds.add(inv.customerId);
    }

    // Tasa base ponderada por monto entre los baldes incluidos — una cartera
    // con más peso en d300_plus tiene una tasa base más baja que una
    // concentrada en d91_180.
    const baselineRecoveryRate =
      outstandingAmount > 0
        ? targetBuckets.reduce(
            (acc, b) =>
              acc + (byBucket[b].amount / outstandingAmount) * BASELINE_RECOVERY_RATE[b],
            0,
          )
        : 0;

    const recoveryRateWithDiscount = Math.min(
      MAX_RECOVERY_RATE,
      baselineRecoveryRate + dto.discountPercent * UPLIFT_PER_DISCOUNT_POINT,
    );

    const baselineRecoveredAmount = outstandingAmount * baselineRecoveryRate;
    const grossRecoveredWithDiscount = outstandingAmount * recoveryRateWithDiscount;
    const netRecoveredWithDiscount =
      grossRecoveredWithDiscount * (1 - dto.discountPercent / 100);
    const netImpact = netRecoveredWithDiscount - baselineRecoveredAmount;

    return {
      bucket: dto.bucket ?? 'all',
      discountPercent: dto.discountPercent,
      portfolio: {
        invoices: invoiceCount,
        customers: customerIds.size,
        outstandingAmount,
        byBucket,
      },
      baseline: {
        recoveryRate: round4(baselineRecoveryRate),
        projectedRecoveredAmount: round2(baselineRecoveredAmount),
      },
      withDiscount: {
        recoveryRate: round4(recoveryRateWithDiscount),
        grossRecoveredAmount: round2(grossRecoveredWithDiscount),
        netRecoveredAmount: round2(netRecoveredWithDiscount),
      },
      // Positivo = la campaña de quita recupera MÁS efectivo neto que no
      // ofrecer nada; negativo = conviene más dejarla en cobranza normal.
      netImpact: round2(netImpact),
      recommendation:
        netImpact > 0
          ? 'La campaña de quita proyecta recuperar más efectivo neto que la cobranza normal.'
          : 'La campaña de quita proyecta recuperar MENOS efectivo neto que la cobranza normal — considera un descuento menor.',
      assumptions: {
        baselineRecoveryRateByBucket: BASELINE_RECOVERY_RATE,
        upliftPerDiscountPoint: UPLIFT_PER_DISCOUNT_POINT,
        maxRecoveryRate: MAX_RECOVERY_RATE,
        note: 'Tasas de recuperación ASUMIDAS (no medidas): sirven para comparar escenarios de forma consistente, no como predicción exacta.',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
