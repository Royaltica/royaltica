import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SatService } from '../sat/sat.service';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomersDto } from './dto/query-customers.dto';
import { toCsv } from '../common/csv.util';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sat: SatService,
  ) {}

  async create(admin: AuthenticatedUser, dto: CreateCustomerDto) {
    const organizationId = this.requireOrg(admin);
    const rfc = dto.rfc.toUpperCase();

    return this.prisma.withOrg(organizationId, async (tx) => {
      const exists = await tx.customer.findFirst({
        where: { organizationId, rfc, deletedAt: null },
        select: { id: true },
      });
      if (exists) {
        throw new ConflictException('Ya existe un cliente con ese RFC.');
      }

      return tx.customer.create({
        data: {
          organizationId,
          name: dto.name,
          rfc,
          legalName: dto.legalName,
          contact: dto.contact,
          email: dto.email,
          phone: dto.phone,
          category: dto.category,
          creditLimitDays: dto.creditLimitDays,
        },
      });
    });
  }

  async findAll(
    admin: AuthenticatedUser,
    query: QueryCustomersDto,
  ): Promise<Paginated<Customer & { invoicesCount: number; sat69b: unknown }>> {
    const organizationId = this.requireOrg(admin);

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
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
        const rows = await tx.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.limit,
          include: { _count: { select: { invoices: true } } },
        });
        const total = await tx.customer.count({ where });
        return { rows, total };
      },
    );

    const efos = await this.sat.check69bBatch(rows.map((r) => r.rfc));
    const data = rows.map((r) => ({
      ...r,
      invoicesCount: r._count.invoices,
      sat69b: this.buildSat69b(r.rfc, efos.get(r.rfc.toUpperCase())),
    }));
    return buildPaginated(data, total, query.page, query.limit);
  }

  /** Mismo criterio que SuppliersService: formato de RFC + presencia en 69-B. */
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
    const customer = await this.prisma.withOrg(organizationId, (tx) =>
      tx.customer.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
    if (!customer) throw new NotFoundException('Cliente no encontrado.');
    const efos = await this.sat.check69bBatch([customer.rfc]);
    return {
      ...customer,
      sat69b: this.buildSat69b(customer.rfc, efos.get(customer.rfc.toUpperCase())),
    };
  }

  async update(admin: AuthenticatedUser, id: string, dto: UpdateCustomerDto) {
    const organizationId = this.requireOrg(admin);
    const data: Prisma.CustomerUpdateInput = { ...dto };
    if (dto.rfc) data.rfc = dto.rfc.toUpperCase();

    return this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      return tx.customer.update({ where: { id }, data });
    });
  }

  async remove(admin: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(admin);
    await this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      // No se permite borrar un cliente con facturas por cobrar abiertas:
      // dejaría saldos huérfanos bajo un cliente eliminado.
      const open = await tx.invoice.count({
        where: {
          customerId: id,
          direction: 'RECEIVABLE',
          status: 'PENDING',
          deletedAt: null,
        },
      });
      if (open > 0) {
        throw new ConflictException(
          `El cliente tiene ${open} factura(s) por cobrar abierta(s). Cóbralas o cancélalas antes de eliminarlo.`,
        );
      }
      await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return { deleted: true, id };
  }

  /** Exporta el padrón de clientes de la organización a CSV. */
  async exportCsv(admin: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(admin);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.customer.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { name: 'asc' },
        include: { _count: { select: { invoices: true } } },
      }),
    );

    return toCsv(rows, [
      { header: 'Nombre', value: (c) => c.name },
      { header: 'Razón social', value: (c) => c.legalName },
      { header: 'RFC', value: (c) => c.rfc },
      { header: 'Categoría', value: (c) => c.category },
      { header: 'Contacto', value: (c) => c.contact },
      { header: 'Email', value: (c) => c.email },
      { header: 'Teléfono', value: (c) => c.phone },
      { header: 'Días crédito', value: (c) => c.creditLimitDays },
      { header: 'Activo', value: (c) => (c.isActive ? 'Sí' : 'No') },
      { header: 'Facturas', value: (c) => c._count.invoices },
      { header: 'Alta', value: (c) => c.createdAt },
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
    const found = await tx.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Cliente no encontrado.');
  }
}
