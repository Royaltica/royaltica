import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceStatus,
  PaymentRoute,
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
import { SpeiService } from '../spei/spei.service';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import { toCsv } from '../common/csv.util';
import type { Env } from '../config/env.validation';
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
    private readonly spei: SpeiService,
    private readonly config: ConfigService<Env, true>,
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

      // Un pago por TRANSFER se dispersa como UNA sola transferencia SPEI a
      // UNA sola cuenta CLABE: si las facturas fueran de proveedores
      // distintos no habría a dónde mandar el dinero de forma inequívoca.
      // CHECK/CREDIT no tienen esta restricción (no generan una dispersión
      // electrónica única).
      if (dto.route === PaymentRoute.TRANSFER) {
        const supplierIds = new Set(invoices.map((i) => i.supplierId));
        if (supplierIds.size > 1) {
          throw new ConflictException(
            'Un pago por transferencia (SPEI) solo puede incluir facturas del mismo proveedor.',
          );
        }
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
        include: {
          invoices: {
            select: {
              id: true,
              paymentType: true,
              supplierId: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                  rfc: true,
                  clabeInterbancaria: true,
                },
              },
            },
          },
        },
      }),
    );
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    if (!TRANSITIONS[payment.status].includes(target)) {
      throw new BadRequestException(
        `Transición inválida: ${payment.status} → ${target}.`,
      );
    }

    // ── Dispersión SPEI real ──────────────────────────────────
    // Al pasar a PROCESSING un pago por TRANSFER, esto es lo que de verdad
    // mueve el dinero. Antes este método solo cambiaba un status en la BD
    // sin llamar nunca a SpeiService — con credenciales configuradas eso
    // significaba que "PROCESSING" no reflejaba la realidad. Si SPEI no
    // está configurado, SpeiService cae a modo stub (igual que siempre) y
    // el flujo sigue funcionando en desarrollo/demo sin romperse.
    let speiClaveRastreo: string | undefined;
    if (target === PaymentStatus.PROCESSING && payment.route === PaymentRoute.TRANSFER) {
      speiClaveRastreo = await this.disperseSpei(organizationId, payment);
    }

    const data: Prisma.PaymentUpdateInput = { status: target };
    if (transactionRef) data.transactionRef = transactionRef;
    else if (speiClaveRastreo) data.transactionRef = speiClaveRastreo;
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

  /**
   * Dispara la transferencia SPEI real hacia el proveedor del pago y
   * devuelve la claveRastreo para guardarla en `transactionRef`. Lanza si
   * falta la CLABE del proveedor, si se exceden los límites de seguridad,
   * o si el proveedor SPEI (Conekta/STP) rechaza la orden — en todos esos
   * casos NO se permite avanzar a PROCESSING, porque el dinero de verdad
   * no se movió.
   */
  private async disperseSpei(
    organizationId: string,
    payment: Payment & {
      invoices: {
        id: string;
        supplierId: string | null;
        supplier: {
          id: string;
          name: string;
          rfc: string;
          clabeInterbancaria: string | null;
        } | null;
      }[];
    },
  ): Promise<string> {
    const supplier = payment.invoices[0]?.supplier;
    if (!supplier) {
      throw new BadRequestException(
        'No se puede dispersar por SPEI: el pago no tiene proveedor asociado.',
      );
    }
    if (!supplier.clabeInterbancaria) {
      throw new BadRequestException(
        `${supplier.name} no tiene CLABE interbancaria registrada. Agrégala en su expediente antes de dispersar por SPEI.`,
      );
    }

    const amount = Number(payment.totalAmount);

    const maxPerTransfer = this.config.get('SPEI_MAX_AMOUNT_PER_TRANSFER', {
      infer: true,
    });
    if (amount > maxPerTransfer) {
      throw new BadRequestException(
        `El monto ($${amount.toLocaleString('es-MX')}) excede el límite por transferencia SPEI ` +
          `($${maxPerTransfer.toLocaleString('es-MX')}). Divide el pago o ajusta SPEI_MAX_AMOUNT_PER_TRANSFER.`,
      );
    }

    const maxDailyTotal = this.config.get('SPEI_MAX_DAILY_TOTAL_PER_ORG', {
      infer: true,
    });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const alreadyDispersedToday = await this.prisma.withOrg(
      organizationId,
      (tx) =>
        tx.payment.aggregate({
          where: {
            organizationId,
            route: PaymentRoute.TRANSFER,
            status: { in: [PaymentStatus.PROCESSING, PaymentStatus.COMPLETED] },
            createdAt: { gte: todayStart },
          },
          _sum: { totalAmount: true },
        }),
    );
    const dispersedToday = Number(alreadyDispersedToday._sum.totalAmount ?? 0);
    if (dispersedToday + amount > maxDailyTotal) {
      throw new BadRequestException(
        `Este pago excede el límite diario de dispersión SPEI de la organización ` +
          `($${maxDailyTotal.toLocaleString('es-MX')}; ya dispersado hoy: $${dispersedToday.toLocaleString('es-MX')}). ` +
          'Intenta mañana o ajusta SPEI_MAX_DAILY_TOTAL_PER_ORG.',
      );
    }

    const result = await this.spei.order({
      clabeDestino: supplier.clabeInterbancaria,
      nombreBeneficiario: supplier.name,
      rfcBeneficiario: supplier.rfc,
      monto: amount,
      concepto: `Royaltica pago ${payment.id.slice(0, 8)}`,
      // Banxico exige una referencia numérica corta; derivamos una de 6
      // dígitos determinística a partir del timestamp actual.
      referenciaNumerica: Number(Date.now().toString().slice(-6)),
    });

    if (!result.success || !result.claveRastreo) {
      throw new BadRequestException(
        `La transferencia SPEI fue rechazada: ${result.error ?? 'error desconocido'}.`,
      );
    }

    return result.claveRastreo;
  }

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
