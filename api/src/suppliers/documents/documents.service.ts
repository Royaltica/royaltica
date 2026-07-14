import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentStatus,
  type SupplierDocument,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { UsageService } from '../../usage/usage.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UploadDocumentDto } from '../dto/upload-document.dto';

/** Estatus automático según la fecha de vencimiento. */
const statusFor = (expiresAt: Date | null): DocumentStatus =>
  expiresAt && expiresAt.getTime() < Date.now()
    ? DocumentStatus.EXPIRED
    : DocumentStatus.VALIDATED;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly usage: UsageService,
  ) {}

  async list(admin: AuthenticatedUser, supplierId: string) {
    await this.ensureSupplier(admin, supplierId);
    return this.prisma.supplierDocument.findMany({
      where: { supplierId, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async upload(
    admin: AuthenticatedUser,
    supplierId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    dto: UploadDocumentDto,
  ): Promise<SupplierDocument> {
    await this.ensureSupplier(admin, supplierId);
    if (!file) {
      throw new BadRequestException('Falta el archivo a subir.');
    }

    const uploaded = await this.storage.upload(file, `documents/${supplierId}`);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    // Cost tracking de almacenamiento (bytes subidos), fire-and-forget.
    if (admin.organizationId) {
      void this.usage.record({
        organizationId: admin.organizationId,
        feature: 'GCS_UPLOAD',
        units: file.buffer.length,
        metadata: { type: dto.type, fileName: file.originalname },
      });
    }

    return this.prisma.supplierDocument.create({
      data: {
        supplierId,
        type: dto.type,
        fileName: file.originalname,
        storageUrl: uploaded.storageUrl,
        status: statusFor(expiresAt),
        expiresAt,
        uploadedByUserId: admin.id,
      },
    });
  }

  async remove(admin: AuthenticatedUser, supplierId: string, docId: string) {
    await this.ensureSupplier(admin, supplierId);
    const doc = await this.prisma.supplierDocument.findFirst({
      where: { id: docId, supplierId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado.');

    await this.storage.delete(doc.storageUrl);
    await this.prisma.supplierDocument.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true, id: doc.id };
  }

  /** Genera una URL de descarga temporal para el documento. */
  async getDownloadUrl(
    admin: AuthenticatedUser,
    supplierId: string,
    docId: string,
  ) {
    await this.ensureSupplier(admin, supplierId);
    const doc = await this.prisma.supplierDocument.findFirst({
      where: { id: docId, supplierId, deletedAt: null },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    return { url: await this.storage.getSignedUrl(doc.storageUrl) };
  }

  // ── helpers ───────────────────────────────────────────────

  private async ensureSupplier(
    admin: AuthenticatedUser,
    supplierId: string,
  ): Promise<void> {
    if (!admin.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId: admin.organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado.');
  }
}
