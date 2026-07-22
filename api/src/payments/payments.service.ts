import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentType,
  type Payment,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_EVENTS } from '../webhooks/webhook-events';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import { toCsv } from '../common/csv.util';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';

/** Transiciones de estado válidas de un pago. */
const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.SCHEDULED]: [PaymentStatus.PROCESSING, PaymentStatus.FAILED],
  [PaymentStatus.PROCESSING]: [PaymentStatus.COMPLETED, PaymentStatus.FAILED],
  [PaymentStatus.COMPLETED]: [],
  [PaymentStatus.FAILED]: [PaymentStatus.SCHEDULED],
};

const serialize = (p: Payment) => ({
  ...p,
  totalAmount: Number(p.totalAmount),
});

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
    private readonly activity: ActivityLogService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreatePaymentDto) {
    const organizationId = this.requireOrg(user);

    const payment = await this.prisma.withOrg(organizationId, async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: {
          id: { in: dto.invoiceIds },
          organizationId,
          direction: 'PAYABLE',
          deletedAt: null,
        },
        select: {
          id: true,
          total: true,
          status: true,
          supplierId: true,
          payments: { where: { status: { not: PaymentStatus.FAILED } }, select: { id: true } },
        },
      });

      if (invoices.length !== dto.invoiceIds.length) {
        throw new NotFoundException(
          'Una o más facturas no existen o no pertenecen a tu organización.',
        );
      }

      const notApproved = invoices.filter(
        (i) => i.status !== InvoiceStatus.APPROVED,
      );
      if (notApproved.length > 0) {
        throw new ConflictException(
          'Solo se pueden pagar facturas en estado APPROVED.',
        );
      }

      const alreadyLinked = invoices.filter((i) => i.payments.length > 0);
      if (alreadyLinked.length > 0) {
        throw new ConflictException(
          'Una o más facturas ya están incluidas en otro pago activo.',
        );
      }

      const totalAmount = invoices.reduce((sum, i) => sum + Number(i.total), 0);

      return tx.payment.create({
        data: {
          organizationId,
          totalAmount,
          route: dto.route,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
          notes: dto.notes,
          createdByUserId: user.id,
          invoices: { connect: dto.invoiceIds.map((id) => ({ id })) },
        },
        include: this.detailInclude(),
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'PAYMENT_CREATED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { totalAmount: Number(payment.totalAmount), invoices: dto.invoiceIds.length },
    });

    return serialize(payment);
  }

  async findAll(
    user: AuthenticatedUser,
    query: QueryPaymentsDto,
  ): Promise<Paginated<ReturnType<typeof serialize>>> {
    const organizationId = this.requireOrg(user);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);

    const where: Prisma.PaymentWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.route ? { route: query.route } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt: dateFilter } : {}),
    };

    const { rows, total } = await this.prisma.withOrg(
      organizationId,
      async (tx) => {
        const rows = await tx.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: query.skip,
          take: query.limit,
          include: { _count: { select: { invoices: true } } },
        });
        const total = await tx.payment.count({ where });
        return { rows, total };
      },
    );

    return buildPaginated(
      rows.map((p) => ({ ...serialize(p), invoiceCount: p._count.invoices })),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const payment = await this.prisma.withOrg(organizationId, (tx) =>
      tx.payment.findFirst({
        where: { id, organizationId },
        include: this.detailInclude(),
      }),
    );
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    return serialize(payment);
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    target: PaymentStatus,
    transactionRef?: string,
    reason?: string,
  ) {
    const organizationId = this.requireOrg(user);
    const payment = await this.prisma.withOrg(organizationId, (tx) =>
      tx.payment.findFirst({
        where: { id, organizationId },
        include: { invoices: { select: { id: true, paymentType: true } } },
      }),
    );
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    if (!TRANSITIONS[payment.status].includes(target)) {
      throw new BadRequestException(
        `Transición inválida: ${payment.status} → ${target}.`,
      );
    }

    const data: Prisma.PaymentUpdateInput = { status: target };
    if (transactionRef) data.transactionRef = transactionRef;
    if (target === PaymentStatus.COMPLETED) data.processedAt = new Date();

    // Al completar el pago: las facturas pasan a PAID y, si son PPD, queda
    // pendiente el REP que debe emitir el cliente (PUE no requiere REP).
    await this.prisma.withOrg(organizationId, async (tx) => {
      await tx.payment.update({ where: { id }, data });

      if (target === PaymentStatus.COMPLETED) {
        const paidDate = new Date();
        const ppdIds = payment.invoices
          .filter((i) => i.paymentType === PaymentType.PPD)
          .map((i) => i.id);
        const nonPpdIds = payment.invoices
          .filter((i) => i.paymentType !== PaymentType.PPD)
          .map((i) => i.id);

        if (ppdIds.length > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: ppdIds } },
            data: { status: InvoiceStatus.PAID, paidDate, repStatus: 'PENDING' },
          });
        }
        if (nonPpdIds.length > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: nonPpdIds } },
            data: { status: InvoiceStatus.PAID, paidDate, repStatus: 'NA' },
          });
        }
      }
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'PAYMENT_STATUS_CHANGED',
      entityType: 'Payment',
      entityId: id,
      metadata: { from: payment.status, to: target, reason },
    });

    if (target === PaymentStatus.COMPLETED) {
      if (payment.createdByUserId) {
        await this.notifications.create({
          userId: payment.createdByUserId,
          type: 'PAYMENT_COMPLETED',
          title: 'Pago completado',
          body: `El pago por $${Number(payment.totalAmount).toLocaleString(
            'es-MX',
          )} se marcó como completado.`,
          metadata: { paymentId: id },
        });
      }
      await this.webhooks.dispatch(organizationId, WEBHOOK_EVENTS.PAYMENT_COMPLETED, {
        paymentId: id,
        totalAmount: Number(payment.totalAmount),
        invoiceIds: payment.invoices.map((i) => i.id),
      });
    }

    // ── Alerta crítica: pago fallido ──
    if (target === PaymentStatus.FAILED) {
      const amount = Number(payment.totalAmount).toLocaleString('es-MX');
      const title = 'Pago fallido';
      const body = `El pago por $${amount} falló${reason ? ` (${reason})` : ''}. Requiere revisión.`;
      await this.notifications.notifyOrgAdmins(organizationId, {
        type: 'PAYMENT_FAILED',
        title,
        body,
        metadata: { paymentId: id, reason },
      });
      void this.whatsapp.notifyOrgAdmins(
        organizationId,
        `⚠️ Royáltica · ${title}: ${body}`,
      );
    }

    return this.findOne(user, id);
  }

  async exportCsv(user: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.payment.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { invoices: true } } },
      }),
    );

    return toCsv(rows, [
      { header: 'ID', value: (p) => p.id },
      { header: 'Estatus', value: (p) => p.status },
      { header: 'Ruta', value: (p) => p.route },
      { header: 'Monto', value: (p) => Number(p.totalAmount) },
      { header: 'Facturas', value: (p) => p._count.invoices },
      { header: 'Programado', value: (p) => p.scheduledDate },
      { header: 'Procesado', value: (p) => p.processedAt },
      { header: 'Referencia', value: (p) => p.transactionRef },
      { header: 'Creado', value: (p) => p.createdAt },
    ]);
  }

  // ── helpers ───────────────────────────────────────────────

  private detailInclude() {
    return {
      invoices: {
        select: {
          id: true,
          cfdiUuid: true,
          folio: true,
          total: true,
          status: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      creator: { select: { id: true, name: true } },
    } satisfies Prisma.PaymentInclude;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
