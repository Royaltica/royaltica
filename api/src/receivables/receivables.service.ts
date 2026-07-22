import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, type Invoice, type Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_EVENTS } from '../webhooks/webhook-events';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import { toCsv } from '../common/csv.util';
import AdmZip from 'adm-zip';
import { parseCfdiXml, type ParsedCfdi } from '../invoices/cfdi/cfdi-parser';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { QueryReceivablesDto } from './dto/query-receivables.dto';

/**
 * Estados de una factura de venta (CxC). A diferencia de CxP no hay flujo de
 * firmas/aprobación: la factura nace PENDING (pendiente de cobro) y termina en
 * PAID (cobrada) o REJECTED (cancelada/incobrable).
 */
const TRANSITIONS: Partial<Record<InvoiceStatus, InvoiceStatus[]>> = {
  [InvoiceStatus.PENDING]: [InvoiceStatus.PAID, InvoiceStatus.REJECTED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.REJECTED]: [],
};

/** Factura serializada para la API (Decimal → number). */
const serialize = (i: Invoice) => ({
  ...i,
  subtotal: Number(i.subtotal),
  iva: Number(i.iva),
  total: Number(i.total),
});

const money = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2 });

@Injectable()
export class ReceivablesService {
  private readonly logger = new Logger(ReceivablesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReceivableDto) {
    const organizationId = this.requireOrg(user);

    const dupe = await this.prisma.invoice.findUnique({
      where: { cfdiUuid: dto.cfdiUuid },
      select: { id: true },
    });
    if (dupe) {
      throw new ConflictException('Ya existe una factura con ese UUID de CFDI.');
    }

    return this.prisma.withOrg(organizationId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
        select: { id: true, rfc: true },
      });
      if (!customer) {
        throw new NotFoundException('Cliente no encontrado.');
      }

      // La empresa EMITE la factura: rfcEmisor es el RFC de la organización y
      // rfcReceptor el del cliente. Se derivan si no vienen en el DTO, para no
      // depender de datos del navegador.
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { rfc: true },
      });
      const rfcEmisor = (dto.rfcEmisor ?? org?.rfc ?? '').toUpperCase();
      const rfcReceptor = (dto.rfcReceptor ?? customer.rfc).toUpperCase();

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          direction: 'RECEIVABLE',
          customerId: dto.customerId,
          cfdiUuid: dto.cfdiUuid,
          rfcEmisor,
          rfcReceptor,
          subtotal: this.assertMoney(dto.subtotal, 'subtotal'),
          iva: this.assertMoney(dto.iva, 'iva'),
          total: this.assertMoney(dto.total, 'total'),
          date: new Date(dto.date),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          folio: dto.folio,
          description: dto.description,
        },
      });

      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: user.id,
          action: 'CREATE',
          newStatus: invoice.status,
          metadata: { direction: 'RECEIVABLE' } as Prisma.InputJsonValue,
        },
      });

      return serialize(invoice);
    });
  }

  async findAll(
    user: AuthenticatedUser,
    query: QueryReceivablesDto,
  ): Promise<Paginated<ReturnType<typeof serialize>>> {
    const organizationId = this.requireOrg(user);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      direction: 'RECEIVABLE',
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo ? { date: dateFilter } : {}),
      ...(query.search
        ? {
            OR: [
              { cfdiUuid: { contains: query.search, mode: 'insensitive' } },
              { folio: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { rows, total } = await this.prisma.withOrg(
      organizationId,
      async (tx) => {
        const rows = await tx.invoice.findMany({
          where,
          orderBy: { date: 'desc' },
          skip: query.skip,
          take: query.limit,
          include: {
            customer: { select: { id: true, name: true, rfc: true } },
          },
        });
        const total = await tx.invoice.count({ where });
        return { rows, total };
      },
    );

    return buildPaginated(rows.map(serialize), total, query.page, query.limit);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const invoice = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findFirst({
        where: { id, organizationId, direction: 'RECEIVABLE', deletedAt: null },
        include: {
          customer: { select: { id: true, name: true, rfc: true } },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
    );
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return serialize(invoice);
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    target: InvoiceStatus,
    reason?: string,
  ) {
    const organizationId = this.requireOrg(user);
    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await this.getOwnedTx(tx, organizationId, id);
      const allowed = TRANSITIONS[invoice.status] ?? [];
      if (!allowed.includes(target)) {
        throw new BadRequestException(
          `Transición inválida: ${invoice.status} → ${target}.`,
        );
      }

      const data: Prisma.InvoiceUpdateInput = { status: target };
      if (target === InvoiceStatus.PAID) data.paidDate = new Date();

      const updated = await tx.invoice.update({ where: { id }, data });
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId: user.id,
          action: 'STATUS_CHANGE',
          previousStatus: invoice.status,
          newStatus: target,
          metadata: reason
            ? ({ reason } as Prisma.InputJsonValue)
            : undefined,
        },
      });
      return updated;
    });

    if (target === InvoiceStatus.PAID) {
      await this.webhooks.dispatch(
        organizationId,
        WEBHOOK_EVENTS.RECEIVABLE_PAID,
        {
          invoiceId: updated.id,
          cfdiUuid: updated.cfdiUuid,
          customerId: updated.customerId,
          total: Number(updated.total),
        },
      );
    }

    return serialize(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    await this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await this.getOwnedTx(tx, organizationId, id);
      if (invoice.status !== InvoiceStatus.PENDING) {
        throw new ConflictException(
          'Solo se pueden eliminar facturas de venta pendientes de cobro.',
        );
      }
      await tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return { deleted: true, id };
  }

  async exportCsv(user: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findMany({
        where: { organizationId, direction: 'RECEIVABLE', deletedAt: null },
        orderBy: { date: 'desc' },
        include: { customer: { select: { name: true, rfc: true } } },
      }),
    );

    return toCsv(rows, [
      { header: 'UUID', value: (i) => i.cfdiUuid },
      { header: 'Folio', value: (i) => i.folio },
      { header: 'Cliente', value: (i) => i.customer?.name ?? '' },
      { header: 'RFC Receptor', value: (i) => i.rfcReceptor },
      { header: 'Subtotal', value: (i) => Number(i.subtotal) },
      { header: 'IVA', value: (i) => Number(i.iva) },
      { header: 'Total', value: (i) => Number(i.total) },
      { header: 'Moneda', value: (i) => i.currency },
      { header: 'Estatus', value: (i) => i.status },
      { header: 'Emisión', value: (i) => i.date },
      { header: 'Vencimiento', value: (i) => i.dueDate },
      { header: 'Cobrada', value: (i) => i.paidDate },
      { header: 'Último recordatorio', value: (i) => i.lastReminderSentAt },
    ]);
  }

  /**
   * Envía un recordatorio de cobro al cliente de una factura, bajo demanda
   * (botón en el dashboard). Reusa el mismo despacho que el agente automático.
   */
  async sendReminder(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const invoice = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findFirst({
        where: { id, organizationId, direction: 'RECEIVABLE', deletedAt: null },
        include: { customer: true },
      }),
    );
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new ConflictException(
        'Solo se envían recordatorios de facturas pendientes de cobro.',
      );
    }
    if (!invoice.customer) {
      throw new ConflictException('La factura no tiene un cliente asociado.');
    }
    if (!invoice.customer.phone && !invoice.customer.email) {
      throw new ConflictException(
        'El cliente no tiene teléfono ni correo para enviarle el recordatorio.',
      );
    }
    return this.dispatchReminder(invoice, invoice.customer);
  }

  /**
   * Escaneo del agente de cobranza: recorre las organizaciones activas y envía
   * recordatorios de las facturas de venta pendientes que vencen pronto o ya
   * vencieron y no han sido recordadas en las últimas 24 horas. Idempotente.
   * Proceso de sistema (no viene de un request de usuario): consulta directa
   * cruzando organizaciones, mismo patrón que JobsService (sin withOrg).
   */
  async runReminderScan(upcomingDays = 3): Promise<{ sent: number }> {
    const now = new Date();
    const dueLimit = new Date(now.getTime() + upcomingDays * 86_400_000);
    const staleBefore = new Date(now.getTime() - 86_400_000);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        direction: 'RECEIVABLE',
        deletedAt: null,
        status: InvoiceStatus.PENDING,
        dueDate: { not: null, lte: dueLimit },
        OR: [
          { lastReminderSentAt: null },
          { lastReminderSentAt: { lt: staleBefore } },
        ],
        organization: { isActive: true, deletedAt: null },
      },
      include: { customer: true },
    });

    let sent = 0;
    for (const inv of invoices) {
      // Sin canal de contacto no hay a quién recordarle: se salta para no
      // "consumir" el recordatorio (marcar lastReminderSentAt) en vano.
      if (!inv.customer || (!inv.customer.phone && !inv.customer.email)) continue;
      const res = await this.dispatchReminder(inv, inv.customer);
      if (res.emailSent || res.whatsappSent) sent += 1;
    }
    this.logger.log(`receivable-reminder: ${sent} recordatorio(s) enviados.`);
    return { sent };
  }

  /**
   * Importa facturas de venta desde un ZIP de CFDI (XML) exportado del ERP de
   * la empresa. Como la organización es la EMISORA, cada CFDI se empata al
   * CLIENTE por su RFC receptor (espejo de InvoicesService.bulkImportZip, que
   * empata proveedor por RFC emisor). Salta duplicados por cfdiUuid y clientes
   * no registrados; devuelve un resumen por archivo.
   */
  async bulkImportZip(
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string } | undefined,
  ) {
    const organizationId = this.requireOrg(user);
    if (!file) throw new BadRequestException('Falta el archivo ZIP a importar.');

    let entries: { name: string; xml: string }[];
    try {
      const zip = new AdmZip(file.buffer);
      entries = zip
        .getEntries()
        .filter((e) => !e.isDirectory && /\.xml$/i.test(e.entryName))
        .map((e) => ({ name: e.entryName, xml: e.getData().toString('utf8') }));
    } catch {
      throw new BadRequestException('El archivo no es un ZIP válido.');
    }

    if (entries.length === 0) {
      throw new BadRequestException('El ZIP no contiene archivos .xml.');
    }

    const created: string[] = [];
    const skipped: { file: string; reason: string }[] = [];

    for (const entry of entries) {
      try {
        const parsed = parseCfdiXml(entry.xml);
        // Transacción por archivo: un XML inválido no aborta el resto.
        const result = await this.prisma.withOrg(organizationId, (tx) =>
          this.persistParsed(tx, organizationId, user.id, parsed),
        );
        if (result.skipped) {
          skipped.push({ file: entry.name, reason: result.reason });
        } else {
          created.push(result.invoiceId);
        }
      } catch (err) {
        skipped.push({
          file: entry.name,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      total: entries.length,
      created: created.length,
      skipped: skipped.length,
      details: { createdIds: created, skipped },
    };
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Registra una factura de venta a partir de un CFDI ya parseado. Empata el
   * cliente por RFC receptor y salta si el UUID ya existe. No lanza por
   * duplicado ni por cliente faltante: devuelve un resultado para el resumen.
   */
  private async persistParsed(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
    parsed: ParsedCfdi,
  ): Promise<
    | { skipped: true; reason: string; invoiceId?: undefined }
    | { skipped: false; reason?: undefined; invoiceId: string }
  > {
    // cfdiUuid es único GLOBAL (no por org): el chequeo debe ver toda la tabla.
    const dupe = await this.prisma.invoice.findUnique({
      where: { cfdiUuid: parsed.cfdiUuid },
      select: { id: true },
    });
    if (dupe) {
      return { skipped: true, reason: 'UUID ya registrado.' };
    }

    const customer = await tx.customer.findFirst({
      where: { organizationId, rfc: parsed.rfcReceptor, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      return {
        skipped: true,
        reason: `Sin cliente con RFC ${parsed.rfcReceptor}.`,
      };
    }

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        direction: 'RECEIVABLE',
        customerId: customer.id,
        cfdiUuid: parsed.cfdiUuid,
        rfcEmisor: parsed.rfcEmisor,
        rfcReceptor: parsed.rfcReceptor,
        subtotal: parsed.subtotal,
        iva: parsed.iva,
        total: parsed.total,
        currency: parsed.currency,
        date: parsed.date,
        folio: parsed.folio,
        paymentType: parsed.paymentType,
      },
    });

    await tx.invoiceAuditLog.create({
      data: {
        invoiceId: invoice.id,
        userId,
        action: 'CREATE',
        newStatus: invoice.status,
        metadata: {
          source: 'BULK_IMPORT',
          direction: 'RECEIVABLE',
        } as Prisma.InputJsonValue,
      },
    });

    return { skipped: false, invoiceId: invoice.id };
  }

  /**
   * Envío efectivo del recordatorio al cliente por WhatsApp y correo (ambos
   * con degradación stub), marca de tiempo y webhook. Nunca lanza por fallo de
   * canal: los servicios de email/whatsapp ya son fire-and-forget seguros.
   */
  private async dispatchReminder(
    invoice: Invoice,
    customer: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    },
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const total = money(Number(invoice.total));
    const due = (invoice.dueDate ?? invoice.date).toLocaleDateString('es-MX');
    const folio = invoice.folio ?? invoice.cfdiUuid.slice(0, 8);
    const text = `Hola ${customer.name}, tu factura ${folio} por $${total} MXN vence el ${due}. Por favor confirma tu pago o contáctanos si necesitas apoyo. Gracias.`;

    let whatsappSent = false;
    if (customer.phone) {
      const res = await this.whatsapp.sendMessage(customer.phone, text);
      whatsappSent = res.sent;
    }

    let emailSent = false;
    if (customer.email) {
      const res = await this.email.sendCollectionReminder(
        customer.email,
        customer.name,
        folio,
        total,
        due,
        invoice.organizationId,
      );
      emailSent = res.sent;
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { lastReminderSentAt: new Date() },
    });

    // Historial inmutable de cada recordatorio (base para medir la efectividad
    // del agente de cobranza: comparar la fecha del último recordatorio contra
    // la fecha de pago). lastReminderSentAt solo guarda el ÚLTIMO; el audit log
    // conserva todos. Se AWAITEA (no fire-and-forget): es dato de trazabilidad
    // que no debe perderse.
    await this.prisma.invoiceAuditLog.create({
      data: {
        invoiceId: invoice.id,
        action: 'REMINDER_SENT',
        metadata: {
          channels: { whatsapp: whatsappSent, email: emailSent },
        } as Prisma.InputJsonValue,
      },
    });

    void this.webhooks.dispatch(
      invoice.organizationId,
      WEBHOOK_EVENTS.RECEIVABLE_REMINDER_SENT,
      {
        invoiceId: invoice.id,
        customerId: customer.id,
        channels: { whatsapp: whatsappSent, email: emailSent },
      },
    );

    return { emailSent, whatsappSent };
  }

  private async getOwnedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<Invoice> {
    const invoice = await tx.invoice.findFirst({
      where: { id, organizationId, direction: 'RECEIVABLE', deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return invoice;
  }

  private assertMoney(value: number, field: string): number {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`El campo ${field} es inválido.`);
    }
    return value;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
