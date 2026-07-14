import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentStatus, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

/** Pesos del score (deben sumar 1). */
const WEIGHTS = {
  kyc: 0.3,
  forensic: 0.4,
  punctuality: 0.2,
  seniority: 0.1,
} as const;

export interface ScoreBreakdown {
  score: number;
  components: {
    kyc: number;
    forensic: number;
    punctuality: number;
    seniority: number;
  };
  computedAt: string;
}

/**
 * Calcula un score de confiabilidad 0-100 por proveedor combinando:
 * documentos KYC vigentes (30%), promedio forense de sus facturas (40%),
 * puntualidad de pago (20%) y antigüedad de la relación (10%).
 *
 * Es DETERMINISTA (mismas entradas → mismo score), igual que el motor
 * forense: nada de IA en el cálculo, para que sea auditable.
 */
@Injectable()
export class SupplierScoringService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcula y persiste el score del proveedor (scoped al org del usuario). */
  async recompute(
    user: AuthenticatedUser,
    supplierId: string,
  ): Promise<ScoreBreakdown> {
    const organizationId = this.requireOrg(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId, deletedAt: null },
      select: { id: true, seniorityYears: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');

    const breakdown = await this.compute(supplier.id, supplier.seniorityYears);

    await this.prisma.supplier.update({
      where: { id: supplier.id },
      data: { score: breakdown.score, scoreUpdatedAt: new Date() },
    });

    return breakdown;
  }

  /** Núcleo de cálculo (sin persistir). Reutilizable por jobs futuros. */
  async compute(
    supplierId: string,
    seniorityYears: number,
  ): Promise<ScoreBreakdown> {
    const [docs, invoices] = await Promise.all([
      this.prisma.supplierDocument.findMany({
        where: { supplierId, deletedAt: null },
        select: { status: true, expiresAt: true },
      }),
      this.prisma.invoice.findMany({
        where: { supplierId, deletedAt: null },
        select: {
          forensicScore: true,
          status: true,
          dueDate: true,
          paidDate: true,
        },
      }),
    ]);

    const kyc = this.kycComponent(docs);
    const forensic = this.forensicComponent(invoices);
    const punctuality = this.punctualityComponent(invoices);
    const seniority = Math.min(seniorityYears / 10, 1) * 100;

    const score = Math.round(
      kyc * WEIGHTS.kyc +
        forensic * WEIGHTS.forensic +
        punctuality * WEIGHTS.punctuality +
        seniority * WEIGHTS.seniority,
    );

    return {
      score: Math.max(0, Math.min(100, score)),
      components: {
        kyc: Math.round(kyc),
        forensic: Math.round(forensic),
        punctuality: Math.round(punctuality),
        seniority: Math.round(seniority),
      },
      computedAt: new Date().toISOString(),
    };
  }

  // ── componentes ───────────────────────────────────────────

  /** % de documentos KYC vigentes (VALIDATED y sin vencer). Sin docs → 0. */
  private kycComponent(
    docs: { status: DocumentStatus; expiresAt: Date | null }[],
  ): number {
    if (docs.length === 0) return 0;
    const now = Date.now();
    const valid = docs.filter(
      (d) =>
        d.status === DocumentStatus.VALIDATED &&
        (!d.expiresAt || d.expiresAt.getTime() > now),
    ).length;
    return (valid / docs.length) * 100;
  }

  /** Promedio del forensicScore de las facturas auditadas. Sin datos → 50. */
  private forensicComponent(
    invoices: { forensicScore: number | null }[],
  ): number {
    const scored = invoices
      .map((i) => i.forensicScore)
      .filter((s): s is number => typeof s === 'number');
    if (scored.length === 0) return 50;
    return scored.reduce((a, b) => a + b, 0) / scored.length;
  }

  /** % de facturas pagadas en o antes de su vencimiento. Sin pagos → 50. */
  private punctualityComponent(
    invoices: {
      status: InvoiceStatus;
      dueDate: Date | null;
      paidDate: Date | null;
    }[],
  ): number {
    const paid = invoices.filter(
      (i) => i.status === InvoiceStatus.PAID && i.paidDate,
    );
    if (paid.length === 0) return 50;
    const onTime = paid.filter(
      (i) => !i.dueDate || (i.paidDate as Date).getTime() <= i.dueDate.getTime(),
    ).length;
    return (onTime / paid.length) * 100;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
