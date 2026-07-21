import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, type Invoice, type Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { WEBHOOK_EVENTS } from '../webhooks/webhook-events';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import AdmZip from 'adm-zip';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { parseCfdiXml, type ParsedCfdi } from './cfdi/cfdi-parser';
import { toCsv } from '../common/csv.util';

/**
 * Transiciones de estado permitidas. APPROVED no se alcanza por cambio
 * manual sin firmas; PAID requiere venir de APPROVED.
 */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.PENDING]: [InvoiceStatus.AUDITED, InvoiceStatus.REJECTED],
  [InvoiceStatus.AUDITED]: [InvoiceStatus.APPROVED, InvoiceStatus.REJECTED],
  [InvoiceStatus.APPROVED]: [InvoiceStatus.PAID, InvoiceStatus.REJECTED],
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

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateInvoiceDto) {
    const organizationId = this.requireOrg(user);

    // Chequeo GLOBAL a propósito (fuera de withOrg): cfdiUuid es @unique en
    // toda la tabla, no por organización, así que este check de duplicado
    // debe ver TODAS las organizaciones o daría falsos negativos ante un
    // choque entre orgs distintas (el INSERT igual lo bloquearía el
    // constraint de Postgres, pero con un error feo en vez de este mensaje).
    const dupe = await this.prisma.invoice.findUnique({
      where: { cfdiUuid: dto.cfdiUuid },
      select: { id: true },
    });
    if (dupe) {
      throw new ConflictException('Ya existe una factura con ese UUID de CFDI.');
    }

    const subtotal = this.assertMoney(dto.subtotal, 'subtotal');
    const iva = this.assertMoney(dto.iva, 'iva');
    const total = this.assertMoney(dto.total, 'total');

    return this.prisma.withOrg(organizationId, async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) {
        throw new NotFoundException('Proveedor no encontrado.');
      }

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          supplierId: dto.supplierId,
          cfdiUuid: dto.cfdiUuid,
          rfcEmisor: dto.rfcEmisor.toUpperCase(),
          rfcReceptor: dto.rfcReceptor.toUpperCase(),
          subtotal,
          iva,
          total,
          date: new Date(dto.date),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          folio: dto.folio,
          paymentRoute: dto.paymentRoute,
          paymentType: dto.paymentType,
          poNumber: dto.poNumber,
          description: dto.description,
          cfdiXmlUrl: dto.cfdiXmlUrl,
          pdfUrl: dto.pdfUrl,
        },
      });

      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: invoice.id,
          userId: user.id,
          action: 'CREATE',
          newStatus: invoice.status,
        },
      });

      return serialize(invoice);
    });
  }

  async findAll(
    user: AuthenticatedUser,
    query: QueryInvoicesDto,
  ): Promise<Paginated<ReturnType<typeof serialize>>> {
    const organizationId = this.requireOrg(user);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.forensicStatus ? { forensicStatus: query.forensicStatus } : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
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
          include: { supplier: { select: { id: true, name: true, rfc: true } } },
        });
        const total = await tx.invoice.count({ where });
        return { rows, total };
      },
    );

    // La verificación 69-B es una propiedad del PROVEEDOR (su RFC no cambia
    // entre facturas), así que se expone en /suppliers y /portal/profile, no
    // aquí: repetirla por factura sería trabajo redundante. Por factura solo
    // importa el estatus del CFDI (satStatus), que sí es único por UUID.
    return buildPaginated(
      rows.map(serialize),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const invoice = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findFirst({
        where: { id, organizationId, deletedAt: null },
        include: {
          supplier: { select: { id: true, name: true, rfc: true } },
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
      const current = invoice.status;

      if (!TRANSITIONS[current].includes(target)) {
        throw new BadRequestException(
          `Transición inválida: ${current} → ${target}.`,
        );
      }
      if (target === InvoiceStatus.APPROVED) {
        const required = await this.requiredSignatures(invoice.organizationId);
        if (invoice.signatures < required) {
          throw new ConflictException(
            `Se requieren ${required} firmas para aprobar (actuales: ${invoice.signatures}).`,
          );
        }
      }

      const data: Prisma.InvoiceUpdateInput = { status: target };
      if (target === InvoiceStatus.PAID) data.paidDate = new Date();

      const updated = await tx.invoice.update({ where: { id }, data });
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId: user.id,
          action: 'STATUS_CHANGE',
          previousStatus: current,
          newStatus: target,
          metadata: reason
            ? ({ reason } as Prisma.InputJsonValue)
            : undefined,
        },
      });
      return updated;
    });

    await this.emitStatusWebhook(organizationId, updated, target);
    return serialize(updated);
  }

  async sign(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const result = await this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await this.getOwnedTx(tx, organizationId, id);

      if (invoice.status !== InvoiceStatus.AUDITED) {
        throw new ConflictException(
          'Solo se pueden firmar facturas en estado AUDITED.',
        );
      }

      // Cada usuario firma una sola vez (2 firmas = 2 usuarios distintos).
      const alreadySigned = await tx.invoiceAuditLog.findFirst({
        where: { invoiceId: id, userId: user.id, action: 'SIGN' },
        select: { id: true },
      });
      if (alreadySigned) {
        throw new ConflictException('Ya firmaste esta factura.');
      }

      const required = await this.requiredSignatures(invoice.organizationId);
      const signatures = invoice.signatures + 1;
      const promote = signatures >= required;
      const newStatus = promote ? InvoiceStatus.APPROVED : invoice.status;

      const updated = await tx.invoice.update({
        where: { id },
        data: { signatures, status: newStatus },
      });
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId: user.id,
          action: 'SIGN',
          previousStatus: invoice.status,
          newStatus,
          metadata: { signatureNumber: signatures } as Prisma.InputJsonValue,
        },
      });

      return { updated, required, promote };
    });

    const { updated, required, promote } = result;
    if (promote) {
      await this.emitStatusWebhook(
        organizationId,
        updated,
        InvoiceStatus.APPROVED,
      );
    }

    return {
      ...serialize(updated),
      signaturesRequired: required,
      approved: promote,
    };
  }

  /**
   * Registra el REP (complemento de pago) emitido por el cliente para una
   * factura PPD pagada. Royáltica NO timbra ni consulta al SAT: solo guarda
   * el UUID y marca `repStatus = RECEIVED` para cerrar el recordatorio.
   */
  async registerRep(user: AuthenticatedUser, id: string, repUuid: string) {
    const organizationId = this.requireOrg(user);
    return this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await this.getOwnedTx(tx, organizationId, id);

      if (invoice.paymentType !== 'PPD') {
        throw new BadRequestException(
          'El REP solo aplica a facturas con método de pago PPD.',
        );
      }
      if (invoice.status !== InvoiceStatus.PAID) {
        throw new ConflictException(
          'Solo se registra el REP de facturas ya pagadas.',
        );
      }
      if (invoice.repStatus === 'RECEIVED') {
        throw new ConflictException('Esta factura ya tiene un REP registrado.');
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          repUuid: repUuid.toUpperCase(),
          repStatus: 'RECEIVED',
          repReceivedAt: new Date(),
        },
      });
      await tx.invoiceAuditLog.create({
        data: {
          invoiceId: id,
          userId: user.id,
          action: 'REP_REGISTERED',
          metadata: { repUuid } as Prisma.InputJsonValue,
        },
      });
      return serialize(updated);
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    await this.prisma.withOrg(organizationId, async (tx) => {
      const invoice = await this.getOwnedTx(tx, organizationId, id);
      if (invoice.status !== InvoiceStatus.PENDING) {
        throw new ConflictException(
          'Solo se pueden eliminar facturas en estado PENDING.',
        );
      }
      await tx.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
    return { deleted: true, id };
  }

  /**
   * Importa de forma masiva un ZIP de XMLs de CFDI. Por cada XML: parsea,
   * empata el proveedor por RFC del emisor, salta duplicados y registra la
   * factura. Devuelve un resumen con creadas, saltadas y errores por archivo.
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
        // Transacción por archivo (no una sola para todo el ZIP): así un
        // error en un XML no aborta la transacción y arruina el resto de
        // los archivos que sí son válidos.
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

  /** Exporta las facturas de la organización a CSV. */
  async exportCsv(user: AuthenticatedUser): Promise<string> {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.invoice.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { date: 'desc' },
        include: { supplier: { select: { name: true, rfc: true } } },
      }),
    );

    return toCsv(rows, [
      { header: 'UUID', value: (i) => i.cfdiUuid },
      { header: 'Folio', value: (i) => i.folio },
      { header: 'Proveedor', value: (i) => i.supplier.name },
      { header: 'RFC Emisor', value: (i) => i.rfcEmisor },
      { header: 'Subtotal', value: (i) => Number(i.subtotal) },
      { header: 'IVA', value: (i) => Number(i.iva) },
      { header: 'Total', value: (i) => Number(i.total) },
      { header: 'Moneda', value: (i) => i.currency },
      { header: 'Estatus', value: (i) => i.status },
      { header: 'Forense', value: (i) => i.forensicStatus },
      { header: 'REP', value: (i) => i.repStatus },
      { header: 'Fecha', value: (i) => i.date },
      { header: 'Pagada', value: (i) => i.paidDate },
    ]);
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Registra una factura a partir de un CFDI ya parseado. Empata proveedor
   * por RFC del emisor y salta si el UUID ya existe. No lanza por duplicado
   * ni por proveedor faltante: devuelve un resultado para el resumen masivo.
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
    // Chequeo GLOBAL a propósito, ver comentario en create(): cfdiUuid es
    // único en toda la tabla, no por organización.
    const dupe = await this.prisma.invoice.findUnique({
      where: { cfdiUuid: parsed.cfdiUuid },
      select: { id: true },
    });
    if (dupe) {
      return { skipped: true, reason: 'UUID ya registrado.' };
    }

    const supplier = await tx.supplier.findFirst({
      where: { organizationId, rfc: parsed.rfcEmisor, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) {
      return {
        skipped: true,
        reason: `Sin proveedor con RFC ${parsed.rfcEmisor}.`,
      };
    }

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        supplierId: supplier.id,
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
        metadata: { source: 'BULK_IMPORT' } as Prisma.InputJsonValue,
      },
    });

    return { skipped: false, invoiceId: invoice.id };
  }

  /** Emite el webhook correspondiente cuando una factura cambia a un estado notificable. */
  private async emitStatusWebhook(
    organizationId: string,
    invoice: Invoice,
    status: InvoiceStatus,
  ): Promise<void> {
    const event =
      status === InvoiceStatus.APPROVED
        ? WEBHOOK_EVENTS.INVOICE_APPROVED
        : status === InvoiceStatus.REJECTED
          ? WEBHOOK_EVENTS.INVOICE_REJECTED
          : null;
    if (!event) return;
    await this.webhooks.dispatch(organizationId, event, {
      invoiceId: invoice.id,
      cfdiUuid: invoice.cfdiUuid,
      supplierId: invoice.supplierId,
      total: Number(invoice.total),
      status,
    });
  }

  private async getOwnedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<Invoice> {
    const invoice = await tx.invoice.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return invoice;
  }

  private async requiredSignatures(organizationId: string): Promise<number> {
    const settings = await this.settings.get(organizationId);
    return settings.requiredSignatures;
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
