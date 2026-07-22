import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, type DiotDeclaration, type Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import {
  buildPaginated,
  type PaginationDto,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { periodRange } from './period.util';

/** Estatus de factura que cuentan como operación para DIOT. */
const COUNTED_STATUSES = [InvoiceStatus.APPROVED, InvoiceStatus.PAID];

/** Una operación con tercero en la DIOT. */
interface DiotEntry {
  rfcTercero: string;
  nombre: string;
  tipoTercero: string; // '04' = proveedor nacional
  tipoOperacion: string; // '85' = otros
  baseGravable: number;
  iva: number;
  numeroOperaciones: number;
}

const serialize = (d: DiotDeclaration) => ({
  ...d,
  totalIva: Number(d.totalIva),
});

@Injectable()
export class DiotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Genera (o regenera, si no está presentada) la DIOT de un período. */
  async generate(user: AuthenticatedUser, period: string) {
    const organizationId = this.requireOrg(user);

    const declaration = await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.diotDeclaration.findUnique({
        where: { organizationId_period: { organizationId, period } },
      });
      if (existing?.submittedAt) {
        throw new ConflictException(
          'La DIOT de este período ya fue presentada y no puede regenerarse.',
        );
      }

      const { entries, totalOps, totalIva } = await this.computeEntries(
        tx,
        organizationId,
        period,
      );

      return tx.diotDeclaration.upsert({
        where: { organizationId_period: { organizationId, period } },
        create: {
          organizationId,
          period,
          entries: entries as unknown as Prisma.InputJsonValue,
          totalOps,
          totalIva,
          createdByUserId: user.id,
        },
        update: {
          entries: entries as unknown as Prisma.InputJsonValue,
          totalOps,
          totalIva,
          generatedAt: new Date(),
        },
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'DIOT_GENERATED',
      entityType: 'DiotDeclaration',
      entityId: declaration.id,
      metadata: { period, totalOps: declaration.totalOps },
    });

    return serialize(declaration);
  }

  async list(user: AuthenticatedUser, query: PaginationDto) {
    const organizationId = this.requireOrg(user);
    const where: Prisma.DiotDeclarationWhereInput = { organizationId };

    const { rows, total } = await this.prisma.withOrg(
      organizationId,
      async (tx) => {
        const rows = await tx.diotDeclaration.findMany({
          where,
          orderBy: { period: 'desc' },
          skip: query.skip,
          take: query.limit,
        });
        const total = await tx.diotDeclaration.count({ where });
        return { rows, total };
      },
    );

    return buildPaginated(rows.map(serialize), total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const declaration = await this.prisma.withOrg(organizationId, (tx) =>
      this.getOwnedTx(tx, organizationId, id),
    );
    return serialize(declaration);
  }

  /** Recalcula la DIOT desde las facturas actuales (antes de presentar). */
  async update(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const declaration = await this.prisma.withOrg(organizationId, (tx) =>
      this.getOwnedTx(tx, organizationId, id),
    );
    if (declaration.submittedAt) {
      throw new ConflictException(
        'No se puede modificar una DIOT ya presentada.',
      );
    }
    return this.generate(user, declaration.period);
  }

  /** Marca la DIOT como presentada (acción única e irreversible). */
  async submit(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      const declaration = await this.getOwnedTx(tx, organizationId, id);
      if (declaration.submittedAt) {
        throw new ConflictException('La DIOT ya fue presentada.');
      }
      return tx.diotDeclaration.update({
        where: { id },
        data: { submittedAt: new Date() },
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'DIOT_SUBMITTED',
      entityType: 'DiotDeclaration',
      entityId: id,
      metadata: { period: updated.period },
    });

    return serialize(updated);
  }

  // ── helpers ───────────────────────────────────────────────

  private async computeEntries(
    tx: Prisma.TransactionClient,
    organizationId: string,
    period: string,
  ) {
    const { start, end } = periodRange(period);

    const invoices = await tx.invoice.findMany({
      where: {
        organizationId,
        direction: 'PAYABLE',
        deletedAt: null,
        status: { in: COUNTED_STATUSES },
        date: { gte: start, lt: end },
      },
      select: {
        rfcEmisor: true,
        subtotal: true,
        iva: true,
        supplier: { select: { name: true } },
      },
    });

    const byRfc = new Map<string, DiotEntry>();
    for (const inv of invoices) {
      const rfc = inv.rfcEmisor.toUpperCase();
      const entry = byRfc.get(rfc) ?? {
        rfcTercero: rfc,
        nombre: inv.supplier?.name ?? rfc,
        tipoTercero: '04',
        tipoOperacion: '85',
        baseGravable: 0,
        iva: 0,
        numeroOperaciones: 0,
      };
      entry.baseGravable += Number(inv.subtotal);
      entry.iva += Number(inv.iva);
      entry.numeroOperaciones += 1;
      byRfc.set(rfc, entry);
    }

    const entries = [...byRfc.values()].map((e) => ({
      ...e,
      baseGravable: round2(e.baseGravable),
      iva: round2(e.iva),
    }));
    const totalOps = entries.reduce((a, e) => a + e.numeroOperaciones, 0);
    const totalIva = round2(entries.reduce((a, e) => a + e.iva, 0));

    return { entries, totalOps, totalIva };
  }

  private async getOwnedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<DiotDeclaration> {
    const declaration = await tx.diotDeclaration.findFirst({
      where: { id, organizationId },
    });
    if (!declaration) throw new NotFoundException('Declaración no encontrada.');
    return declaration;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
