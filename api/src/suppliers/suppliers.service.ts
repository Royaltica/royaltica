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
  ) {}

  async create(admin: AuthenticatedUser, dto: CreateSupplierDto) {
    const organizationId = this.requireOrg(admin);
    const rfc = dto.rfc.toUpperCase();

    const exists = await this.prisma.supplier.findFirst({
      where: { organizationId, rfc, deletedAt: null },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException('Ya existe un proveedor con ese RFC.');
    }

    const supplier = await this.prisma.supplier.create({
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
    return serialize(supplier);
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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
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
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const data = rows.map((r) => ({
      ...serialize(r),
      documentsCount: r._count.documents,
      invoicesCount: r._count.invoices,
    }));
    return buildPaginated(data, total, query.page, query.limit);
  }

  async findOne(admin: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(admin);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');
    return serialize(supplier);
  }

  async update(admin: AuthenticatedUser, id: string, dto: UpdateSupplierDto) {
    await this.ensureExists(admin, id);
    const data: Prisma.SupplierUpdateInput = { ...dto };
    if (dto.rfc) data.rfc = dto.rfc.toUpperCase();

    const updated = await this.prisma.supplier.update({ where: { id }, data });
    return serialize(updated);
  }

  async approve(admin: AuthenticatedUser, id: string, isApproved: boolean) {
    await this.ensureExists(admin, id);
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isApproved },
    });
    if (isApproved && admin.organizationId) {
      await this.webhooks.dispatch(
        admin.organizationId,
        WEBHOOK_EVENTS.SUPPLIER_APPROVED,
        { supplierId: updated.id, name: updated.name, rfc: updated.rfc },
      );
    }
    return serialize(updated);
  }

  async remove(admin: AuthenticatedUser, id: string) {
    await this.ensureExists(admin, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true, id };
  }

  /** Exporta el padrón de proveedores de la organización a CSV. */
  async exportCsv(admin: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(admin);
    const rows = await this.prisma.supplier.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { invoices: true } } },
    });

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
    admin: AuthenticatedUser,
    id: string,
  ): Promise<void> {
    const organizationId = this.requireOrg(admin);
    const found = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Proveedor no encontrado.');
  }
}
