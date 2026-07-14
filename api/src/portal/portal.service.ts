import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { FactorajeService } from '../factoraje/factoraje.service';
import { CreateFactorajeDto } from '../factoraje/dto/create-factoraje.dto';
import { QueryFactorajeDto } from '../factoraje/dto/query-factoraje.dto';
import { QueryInvoicesDto } from '../invoices/dto/query-invoices.dto';
import { QueryPaymentsDto } from '../payments/dto/query-payments.dto';
import { UpdateProviderProfileDto } from './dto/update-profile.dto';
import { DocumentsService } from '../suppliers/documents/documents.service';
import { UploadDocumentDto } from '../suppliers/dto/upload-document.dto';

interface SupplierContext {
  supplierId: string;
  organizationId: string;
}

/**
 * Lógica del Portal del Proveedor. Todo queda acotado al `supplierId` que
 * trae el JWT del usuario PROVIDER; nunca puede ver datos de otro proveedor.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factoraje: FactorajeService,
    private readonly documents: DocumentsService,
  ) {}

  // ── Documentos KYC del proveedor (sube/lista/borra los SUYOS) ──────

  /** Lista los documentos KYC del proveedor autenticado. */
  listDocuments(user: AuthenticatedUser) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.documents.list(scoped, supplierId),
    );
  }

  /** El proveedor sube un documento KYC propio. */
  uploadDocument(
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    dto: UploadDocumentDto,
  ) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.documents.upload(scoped, supplierId, file, dto),
    );
  }

  /** El proveedor borra un documento propio. */
  deleteDocument(user: AuthenticatedUser, docId: string) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.documents.remove(scoped, supplierId, docId),
    );
  }

  /** URL firmada de descarga de un documento propio. */
  downloadDocument(user: AuthenticatedUser, docId: string) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.documents.getDownloadUrl(scoped, supplierId, docId),
    );
  }

  /** Perfil del proveedor + sus documentos KYC. */
  async getProfile(user: AuthenticatedUser) {
    const { supplierId } = await this.requireSupplier(user);
    return this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
  }

  /** El proveedor actualiza sus propios datos bancarios (CLABE / banco). */
  async updateProfile(user: AuthenticatedUser, dto: UpdateProviderProfileDto) {
    const { supplierId } = await this.requireSupplier(user);
    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...(dto.clabeInterbancaria !== undefined
          ? { clabeInterbancaria: dto.clabeInterbancaria }
          : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName } : {}),
      },
      include: {
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
  }

  async getInvoices(
    user: AuthenticatedUser,
    query: QueryInvoicesDto,
  ): Promise<Paginated<unknown>> {
    const { supplierId } = await this.requireSupplier(user);

    const where: Prisma.InvoiceWhereInput = {
      supplierId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const data = rows.map((i) => ({
      ...i,
      subtotal: Number(i.subtotal),
      iva: Number(i.iva),
      total: Number(i.total),
    }));
    return buildPaginated(data, total, query.page, query.limit);
  }

  async getPayments(
    user: AuthenticatedUser,
    query: QueryPaymentsDto,
  ): Promise<Paginated<unknown>> {
    const { supplierId } = await this.requireSupplier(user);

    const where: Prisma.PaymentWhereInput = {
      invoices: { some: { supplierId } },
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        // Solo expone las facturas del proveedor dentro de cada pago.
        include: {
          invoices: {
            where: { supplierId },
            select: { id: true, cfdiUuid: true, folio: true, total: true },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const data = rows.map((p) => ({ ...p, totalAmount: Number(p.totalAmount) }));
    return buildPaginated(data, total, query.page, query.limit);
  }

  getFactoraje(user: AuthenticatedUser, query: QueryFactorajeDto) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.factoraje.findAll(scoped, query, supplierId),
    );
  }

  requestFactoraje(user: AuthenticatedUser, dto: CreateFactorajeDto) {
    return this.withSupplierUser(user, (scoped, supplierId) =>
      this.factoraje.request(scoped, dto, supplierId),
    );
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Ejecuta una acción de factoraje con un usuario "aumentado" que lleva el
   * organizationId del proveedor, de modo que el scope por organización del
   * FactorajeService funcione aunque el JWT del PROVIDER no lo incluya.
   */
  private async withSupplierUser<T>(
    user: AuthenticatedUser,
    fn: (scoped: AuthenticatedUser, supplierId: string) => Promise<T>,
  ): Promise<T> {
    const { supplierId, organizationId } = await this.requireSupplier(user);
    return fn({ ...user, organizationId }, supplierId);
  }

  private async requireSupplier(
    user: AuthenticatedUser,
  ): Promise<SupplierContext> {
    if (!user.supplierId) {
      throw new ForbiddenException(
        'Tu cuenta no está ligada a un proveedor.',
      );
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: user.supplierId, deletedAt: null },
      select: { id: true, organizationId: true },
    });
    if (!supplier) {
      throw new ForbiddenException('Proveedor no encontrado o inactivo.');
    }
    return { supplierId: supplier.id, organizationId: supplier.organizationId };
  }
}
