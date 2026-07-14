import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FactorajeStatus,
  InvoiceStatus,
  type FactorajeRequest,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_EVENTS } from '../webhooks/webhook-events';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateFactorajeDto } from './dto/create-factoraje.dto';
import { QueryFactorajeDto } from './dto/query-factoraje.dto';
import { FactorajeProviderService } from './factoraje-provider.service';

/** Formato de pesos mexicanos para los textos de notificación. */
const formatMxn = (n: number): string =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

const serialize = (f: FactorajeRequest) => ({
  ...f,
  requestedAmount: Number(f.requestedAmount),
  fee: Number(f.fee),
  netAmount: Number(f.netAmount),
  rate: Number(f.rate),
});

@Injectable()
export class FactorajeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly activity: ActivityLogService,
    private readonly provider: FactorajeProviderService,
    private readonly webhooks: WebhooksService,
  ) {}

  /**
   * Crea una solicitud de factoraje sobre una factura aprobada. Sirve tanto
   * al lado corporativo (admin) como al portal del proveedor: en ese caso
   * `restrictSupplierId` fuerza que la factura sea del proveedor logueado.
   */
  async request(
    user: AuthenticatedUser,
    dto: CreateFactorajeDto,
    restrictSupplierId?: string,
  ) {
    const organizationId = this.requireOrg(user);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        organizationId,
        deletedAt: null,
        ...(restrictSupplierId ? { supplierId: restrictSupplierId } : {}),
      },
      select: {
        id: true,
        total: true,
        status: true,
        supplierId: true,
        folio: true,
        cfdiUuid: true,
        supplier: { select: { name: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');

    if (invoice.status !== InvoiceStatus.APPROVED) {
      throw new ConflictException(
        'Solo se puede solicitar factoraje sobre facturas APROBADAS.',
      );
    }

    const existing = await this.prisma.factorajeRequest.findFirst({
      where: {
        invoiceId: invoice.id,
        status: { in: [FactorajeStatus.PENDING, FactorajeStatus.APPROVED, FactorajeStatus.DISBURSED] },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Esta factura ya tiene una solicitud de factoraje activa.',
      );
    }

    const invoiceTotal = Number(invoice.total);
    const requestedAmount = dto.requestedAmount ?? invoiceTotal;
    if (requestedAmount > invoiceTotal) {
      throw new BadRequestException(
        'El monto solicitado no puede exceder el total de la factura.',
      );
    }

    const { factorajeFeePercent } = await this.settings.get(organizationId);
    const fee = Math.round(requestedAmount * factorajeFeePercent) / 100;
    const netAmount = requestedAmount - fee;

    const created = await this.prisma.factorajeRequest.create({
      data: {
        invoiceId: invoice.id,
        supplierId: invoice.supplierId,
        requestedAmount,
        fee,
        netAmount,
        rate: factorajeFeePercent,
        notes: dto.notes,
      },
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'FACTORAJE_REQUESTED',
      entityType: 'FactorajeRequest',
      entityId: created.id,
      metadata: { invoiceId: invoice.id, requestedAmount, netAmount },
    });

    // Avisa a los administradores corporativos (campana del portal corporativo).
    // Fire-and-forget: una falla de notificación nunca debe tumbar la solicitud.
    const folio = invoice.folio ?? invoice.cfdiUuid;
    void this.notifications.notifyOrgAdmins(organizationId, {
      type: 'FACTORAJE_REQUESTED',
      title: 'Nueva solicitud de anticipo',
      body: `${invoice.supplier.name} solicitó un anticipo de ${formatMxn(requestedAmount)} sobre la factura ${folio}.`,
      metadata: {
        factorajeId: created.id,
        invoiceId: invoice.id,
        supplierId: invoice.supplierId,
        requestedAmount,
      },
    });

    return serialize(created);
  }

  async findAll(
    user: AuthenticatedUser,
    query: QueryFactorajeDto,
    restrictSupplierId?: string,
  ): Promise<Paginated<ReturnType<typeof serialize>>> {
    const organizationId = this.requireOrg(user);

    const where: Prisma.FactorajeRequestWhereInput = {
      supplier: { organizationId },
      ...(restrictSupplierId ? { supplierId: restrictSupplierId } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.factorajeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          supplier: { select: { id: true, name: true } },
          invoice: { select: { id: true, cfdiUuid: true, folio: true } },
        },
      }),
      this.prisma.factorajeRequest.count({ where }),
    ]);

    return buildPaginated(rows.map(serialize), total, query.page, query.limit);
  }

  async findOne(
    user: AuthenticatedUser,
    id: string,
    restrictSupplierId?: string,
  ) {
    const request = await this.getScoped(user, id, restrictSupplierId);
    return serialize(request);
  }

  /** Aprueba la solicitud (PENDING → APPROVED). Solo lado corporativo. */
  async approve(user: AuthenticatedUser, id: string) {
    const request = await this.getScoped(user, id);
    this.assertStatus(request.status, FactorajeStatus.PENDING);

    const updated = await this.prisma.factorajeRequest.update({
      where: { id },
      data: { status: FactorajeStatus.APPROVED, resolvedAt: new Date() },
    });
    await this.notifySupplier(request.supplierId, {
      type: 'FACTORAJE_APPROVED',
      title: 'Factoraje aprobado',
      body: `Tu solicitud de factoraje por $${Number(
        request.netAmount,
      ).toLocaleString('es-MX')} fue aprobada.`,
      metadata: { factorajeRequestId: id },
    });
    await this.activity.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'FACTORAJE_APPROVED',
      entityType: 'FactorajeRequest',
      entityId: id,
    });
    return serialize(updated);
  }

  /** Rechaza la solicitud (PENDING → REJECTED). */
  async reject(user: AuthenticatedUser, id: string, reason?: string) {
    const request = await this.getScoped(user, id);
    this.assertStatus(request.status, FactorajeStatus.PENDING);

    const updated = await this.prisma.factorajeRequest.update({
      where: { id },
      data: {
        status: FactorajeStatus.REJECTED,
        resolvedAt: new Date(),
        notes: reason ?? request.notes,
      },
    });
    await this.notifySupplier(request.supplierId, {
      type: 'FACTORAJE_REJECTED',
      title: 'Factoraje rechazado',
      body: 'Tu solicitud de factoraje no fue aprobada.',
      metadata: { factorajeRequestId: id, reason },
    });
    await this.activity.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'FACTORAJE_REJECTED',
      entityType: 'FactorajeRequest',
      entityId: id,
      metadata: { reason },
    });
    return serialize(updated);
  }

  /**
   * Dispersa el adelanto al proveedor (APPROVED → DISBURSED) usando el
   * adaptador del proveedor externo de factoraje.
   */
  async disburse(user: AuthenticatedUser, id: string) {
    const request = await this.getScoped(user, id);
    this.assertStatus(request.status, FactorajeStatus.APPROVED);

    const supplier = await this.prisma.supplier.findUnique({
      where: { id: request.supplierId },
      select: { name: true, clabeInterbancaria: true },
    });

    const { providerRef, mode } = await this.provider.disburse({
      factorajeRequestId: request.id,
      supplierName: supplier?.name ?? 'Proveedor',
      clabe: supplier?.clabeInterbancaria ?? null,
      netAmount: Number(request.netAmount),
      concept: `Factoraje ${request.id}`,
    });

    const updated = await this.prisma.factorajeRequest.update({
      where: { id },
      data: {
        status: FactorajeStatus.DISBURSED,
        providerRef,
        disbursedAt: new Date(),
      },
    });

    await this.notifySupplier(request.supplierId, {
      type: 'FACTORAJE_DISBURSED',
      title: 'Factoraje dispersado',
      body: `Se dispersaron $${Number(request.netAmount).toLocaleString(
        'es-MX',
      )} a tu cuenta.`,
      metadata: { factorajeRequestId: id, providerRef },
    });
    await this.activity.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'FACTORAJE_DISBURSED',
      entityType: 'FactorajeRequest',
      entityId: id,
      metadata: { providerRef, mode },
    });
    await this.webhooks.dispatch(
      this.requireOrg(user),
      WEBHOOK_EVENTS.FACTORAJE_DISBURSED,
      {
        factorajeRequestId: id,
        supplierId: request.supplierId,
        netAmount: Number(request.netAmount),
        providerRef,
      },
    );

    return { ...serialize(updated), disbursementMode: mode };
  }

  // ── helpers ───────────────────────────────────────────────

  private async getScoped(
    user: AuthenticatedUser,
    id: string,
    restrictSupplierId?: string,
  ): Promise<FactorajeRequest> {
    const organizationId = this.requireOrg(user);
    const request = await this.prisma.factorajeRequest.findFirst({
      where: {
        id,
        supplier: { organizationId },
        ...(restrictSupplierId ? { supplierId: restrictSupplierId } : {}),
      },
    });
    if (!request) {
      throw new NotFoundException('Solicitud de factoraje no encontrada.');
    }
    return request;
  }

  private assertStatus(current: FactorajeStatus, expected: FactorajeStatus) {
    if (current !== expected) {
      throw new ConflictException(
        `La solicitud está en estado ${current}; se esperaba ${expected}.`,
      );
    }
  }

  /** Notifica al usuario PROVIDER ligado al proveedor (si existe). */
  private async notifySupplier(
    supplierId: string,
    payload: {
      type: string;
      title: string;
      body: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const providerUser = await this.prisma.user.findFirst({
      where: { supplierId },
      select: { id: true },
    });
    if (providerUser) {
      await this.notifications.create({ userId: providerUser.id, ...payload });
    }
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
