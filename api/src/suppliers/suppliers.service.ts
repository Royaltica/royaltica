import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, Supplier } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_EVENTS } from '../webhooks/webhook-events';
import { SatService } from '../sat/sat.service';
import { SearchService } from '../search/search.service';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { toCsv } from '../common/csv.util';

/** Proveedor serializado para la API (Decimal → number). */
const serialize = (s: Supplier) => ({
  ...s,
  capitalAmount: Number(s.capitalAmount),
});

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly sat: SatService,
    private readonly search: SearchService,
  ) {}

  /**
   * Empaqueta un Supplier para Meilisearch. `organizationId` es
   * imprescindible: se usa como filtro en el endpoint /search para
   * respetar el aislamiento multi-tenant.
   */
  private toSearchDoc(s: Supplier) {
    return {
      id: s.id,
      organizationId: s.organizationId,
      name: s.name,
      legalName: s.legalName,
      rfc: s.rfc,
      contact: s.contact,
      email: s.email,
      category: s.category,
      activity: s.activity,
      isApproved: s.isApproved,
      score: s.score ?? null,
      seniorityYears: s.seniorityYears,
      createdAt: s.createdAt?.getTime?.() ?? null,
    };
  }

  async create(admin: AuthenticatedUser, dto: CreateSupplierDto) {
    const organizationId = this.requireOrg(admin);
    const rfc = dto.rfc.toUpperCase();

    return this.prisma.withOrg(organizationId, async (tx) => {
      const exists = await tx.supplier.findFirst({
        where: { organizationId, rfc, deletedAt: null },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Ya existe un proveedor con ese RFC.');
      }

      const supplier = await tx.supplier.create({
        data: {
          organizationId,
          name: dto.name,
          rfc,
          legalName: dto.legalName,
          contact: dto.contact,
          email: dto.email,
          category: dto.category,
          activity: dto.activity,
          seniorityYears: dto.seniorityYears ?? 0,
          capitalAmount: dto.capitalAmount ?? 0,
          clabeInterbancaria: dto.clabeInterbancaria,
          bankName: dto.bankName,
        },
      });
      // Index en Meilisearch (fire-and-forget; no-op si Meili no está activo).
      void this.search.indexDocument('suppliers', this.toSearchDoc(supplier));
      return serialize(supplier);
    });
  }

  async findAll(
    admin: AuthenticatedUser,
    query: QuerySuppliersDto,
  ): Promise<Paginated<ReturnType<typeof serialize>>> {
    const organizationId = this.requireOrg(admin);

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.isApproved !== undefined
        ? { isApproved: query.isApproved }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { legalName: { contains: query.search, mode: 'insensitive' } },
              { rfc: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { rows, total } = await this.prisma.withOrg(
      organizationId,
      async (tx) => {
        const rows = await tx.supplier.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.limit,
          include: {
            _count: { select: { documents: true, invoices: true } },
            documents: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: 'desc' },
              select: {
                id: true,
                type: true,
                status: true,
                fileName: true,
                expiresAt: true,
              },
            },
          },
        });
        const total = await tx.supplier.count({ where });
        return { rows, total };
      },
    );

    const efos = await this.sat.check69bBatch(rows.map((r) => r.rfc));
    const data = rows.map((r) => ({
      ...serialize(r),
      documentsCount: r._count.documents,
      invoicesCount: r._count.invoices,
      sat69b: this.buildSat69b(r.rfc, efos.get(r.rfc.toUpperCase())),
    }));
    return buildPaginated(data, total, query.page, query.limit);
  }

  /**
   * Estatus de verificación SAT a nivel proveedor (se calcula por RFC, no por
   * factura): validez de formato del RFC y presencia en la lista negra 69-B.
   */
  private buildSat69b(
    rfc: string,
    entry?: { status: string },
  ): { listed: boolean; status: string | null; rfcValid: boolean } {
    const rfcValid = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i.test(rfc);
    return {
      listed: entry != null,
      status: entry?.status ?? null,
      rfcValid,
    };
  }

  async findOne(admin: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(admin);
    const supplier = await this.prisma.withOrg(organizationId, (tx) =>
      tx.supplier.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      }),
    );
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');
    const efos = await this.sat.check69bBatch([supplier.rfc]);
    return {
      ...serialize(supplier),
      sat69b: this.buildSat69b(supplier.rfc, efos.get(supplier.rfc.toUpperCase())),
    };
  }

  async update(admin: AuthenticatedUser, id: string, dto: UpdateSupplierDto) {
    const organizationId = this.requireOrg(admin);
    const data: Prisma.SupplierUpdateInput = { ...dto };
    if (dto.rfc) data.rfc = dto.rfc.toUpperCase();

    return this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      const updated = await tx.supplier.update({ where: { id }, data });
      void this.search.indexDocument('suppliers', this.toSearchDoc(updated));
      return serialize(updated);
    });
  }

  async approve(admin: AuthenticatedUser, id: string, isApproved: boolean) {
    const organizationId = this.requireOrg(admin);
    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      return tx.supplier.update({
        where: { id },
        data: { isApproved },
      });
    });
    if (isApproved) {
      await this.webhooks.dispatch(
        organizationId,
        WEBHOOK_EVENTS.SUPPLIER_APPROVED,
        { supplierId: updated.id, name: updated.name, rfc: updated.rfc },
      );
    }
    void this.search.indexDocument('suppliers', this.toSearchDoc(updated));
    return serialize(updated);
  }

  async remove(admin: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(admin);
    await this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      await tx.supplier.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    void this.search.removeDocument('suppliers', id);
    return { deleted: true, id };
  }

  /** Exporta el padrón de proveedores de la organización a CSV. */
  async exportCsv(admin: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(admin);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.supplier.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { name: 'asc' },
        include: { _count: { select: { invoices: true } } },
      }),
    );

    return toCsv(rows, [
      { header: 'Nombre', value: (s) => s.name },
      { header: 'Razón social', value: (s) => s.legalName },
      { header: 'RFC', value: (s) => s.rfc },
      { header: 'Categoría', value: (s) => s.category },
      { header: 'Email', value: (s) => s.email },
      { header: 'Aprobado', value: (s) => (s.isApproved ? 'Sí' : 'No') },
      { header: 'Antigüedad (años)', value: (s) => s.seniorityYears },
      { header: 'Capital', value: (s) => Number(s.capitalAmount) },
      { header: 'Banco', value: (s) => s.bankName },
      { header: 'CLABE', value: (s) => s.clabeInterbancaria },
      { header: 'Facturas', value: (s) => s._count.invoices },
      { header: 'Alta', value: (s) => s.createdAt },
    ]);
  }

  // ── helpers ───────────────────────────────────────────────

  private requireOrg(admin: AuthenticatedUser): string {
    if (!admin.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return admin.organizationId;
  }

  private async ensureExists(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<void> {
    const found = await tx.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Proveedor no encontrado.');
  }
}
