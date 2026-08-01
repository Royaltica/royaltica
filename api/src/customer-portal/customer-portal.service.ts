import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Vigencia por defecto de un enlace del portal de autoservicio. Generoso a
 * propósito (90 días): el cliente no tiene cuenta, así que el enlace mismo
 * ES su credencial durante ese tiempo. Reemitir (`issuePortalLink`) crea un
 * token nuevo; el anterior sigue existiendo pero deja de mandarse.
 */
const DEFAULT_TTL_DAYS = 90;

/** Acción de bitácora usada para deduplicar clicks repetidos de "ya pagué". */
const MARK_PAID_ACTION = 'CUSTOMER_CLAIMED_PAID';

/** Fila cruda de CustomerPortalAccess (tabla nueva, ver migración
 * 20260803000000_customer_portal_access). Se consulta con SQL parametrizado
 * en vez del delegate generado de Prisma para no depender de que el cliente
 * ya haya sido regenerado en cada entorno donde corre este código. */
interface CustomerPortalAccessRow {
  id: string;
  organizationId: string;
  customerId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date | null;
}

export interface CustomerPortalInvoiceDto {
  id: string;
  folio: string | null;
  total: number;
  currency: string;
  dueDate: string | null;
  status: string;
  daysOverdue: number;
  alreadyClaimedPaid: boolean;
}

export interface CustomerPortalDataDto {
  customer: { name: string };
  currency: string;
  invoices: CustomerPortalInvoiceDto[];
  aging: {
    current: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
    totalPending: number;
    totalOverdue: number;
  };
}

/**
 * Portal de autoservicio SIN CUENTA para clientes deudores (Tradespace,
 * Canadá): resuelve identidad SOLO a partir de un token opaco (nunca de
 * organizationId/customerId mandados por el cliente), lectura de facturas
 * pendientes + acuse "ya pagué" (no cambia el status real, eso queda a
 * reconciliación humana). Toda acción se audita (ActivityLogService),
 * requisito duro de Tradespace.
 */
@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Emite (o reemite) un enlace del portal para un cliente. Uso interno
   * (otros módulos, p. ej. el agente de cobranza al mandar recordatorios).
   * No se expone por un endpoint público: solo procesos internos conocen el
   * customerId real.
   */
  async issuePortalLink(customerId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, organizationId: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 86_400_000);
    const id = randomUUID();

    await this.prisma.withOrg(customer.organizationId, (tx) =>
      tx.$executeRaw`
        INSERT INTO "CustomerPortalAccess"
          ("id", "organizationId", "customerId", "token", "expiresAt", "createdAt")
        VALUES
          (${id}, ${customer.organizationId}, ${customer.id}, ${token}, ${expiresAt}, now())
      `,
    );

    await this.activity.record({
      organizationId: customer.organizationId,
      action: 'CUSTOMER_PORTAL_LINK_ISSUED',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: {},
    });

    const base = this.config.get('FRONTEND_URL', { infer: true }).replace(/\/$/, '');
    return `${base}/portal-cliente/${token}`;
  }

  /**
   * Datos de solo lectura para la vista pública del portal. Resuelve
   * identidad ÚNICA Y EXCLUSIVAMENTE del token; nunca acepta organizationId
   * ni customerId del cliente. Token inválido o vencido → 404/410 (nunca
   * 401/403, para no filtrar si el formato del token es "casi válido").
   */
  async getPortalData(token: string): Promise<CustomerPortalDataDto> {
    const access = await this.resolveAccess(token);

    const result = await this.prisma.withOrg(access.organizationId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: access.customerId,
          organizationId: access.organizationId,
          deletedAt: null,
        },
        select: { name: true },
      });
      if (!customer) return null;

      const org = await tx.organization.findUnique({
        where: { id: access.organizationId },
        select: { currency: true },
      });

      const invoices = await tx.invoice.findMany({
        where: {
          organizationId: access.organizationId,
          customerId: access.customerId,
          direction: 'RECEIVABLE',
          status: 'PENDING',
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          folio: true,
          total: true,
          currency: true,
          dueDate: true,
          status: true,
        },
      });

      // Reclamos previos de "ya pagué" de este cliente, para no volver a
      // mostrar el botón activo en una factura ya marcada.
      const claims = await tx.activityLog.findMany({
        where: {
          organizationId: access.organizationId,
          entityType: 'Invoice',
          action: MARK_PAID_ACTION,
          entityId: { in: invoices.map((i) => i.id) },
        },
        select: { entityId: true },
      });
      const claimedIds = new Set(claims.map((c) => c.entityId));

      return { customer, currency: org?.currency ?? 'MXN', invoices, claimedIds };
    });

    if (!result) throw new NotFoundException('Cliente no encontrado.');

    const now = Date.now();
    const aging = {
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 0,
      totalPending: 0,
      totalOverdue: 0,
    };

    const invoiceDtos: CustomerPortalInvoiceDto[] = result.invoices.map((inv) => {
      const total = Number(inv.total);
      const dueDate = inv.dueDate;
      const daysOverdue = dueDate
        ? Math.floor((now - new Date(dueDate).getTime()) / 86_400_000)
        : 0;

      aging.totalPending += total;
      if (daysOverdue <= 0) aging.current += total;
      else if (daysOverdue <= 30) aging.d1_30 += total;
      else if (daysOverdue <= 60) aging.d31_60 += total;
      else if (daysOverdue <= 90) aging.d61_90 += total;
      else aging.d90_plus += total;
      if (daysOverdue > 0) aging.totalOverdue += total;

      return {
        id: inv.id,
        folio: inv.folio,
        total,
        currency: inv.currency,
        dueDate: dueDate ? dueDate.toISOString() : null,
        status: inv.status,
        daysOverdue: Math.max(0, daysOverdue),
        alreadyClaimedPaid: result.claimedIds.has(inv.id),
      };
    });

    await this.touchLastAccessed(access);
    await this.activity.record({
      organizationId: access.organizationId,
      action: 'CUSTOMER_PORTAL_VIEWED',
      entityType: 'Customer',
      entityId: access.customerId,
      metadata: { portalAccessId: access.id },
    });

    return {
      customer: { name: result.customer.name },
      currency: result.currency,
      invoices: invoiceDtos,
      aging,
    };
  }

  /**
   * El cliente marca "ya pagué" una factura. NO cambia el status real de la
   * factura (eso es acción humana de reconciliación): registra una
   * ActivityLog + notifica a los CORPORATE_ADMIN de la organización para que
   * verifiquen. Deduplica: un mismo token no puede volver a disparar la
   * notificación para la misma factura (evita spam de clicks repetidos).
   */
  async markInvoicePaid(
    token: string,
    invoiceId: string,
  ): Promise<{ ok: true; alreadyFlagged: boolean }> {
    const access = await this.resolveAccess(token);

    const invoice = await this.prisma.withOrg(access.organizationId, (tx) =>
      tx.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: access.organizationId,
          customerId: access.customerId,
          direction: 'RECEIVABLE',
          deletedAt: null,
        },
        include: { customer: { select: { name: true } } },
      }),
    );
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    if (invoice.status !== 'PENDING') {
      throw new ConflictException('Esta factura ya no está pendiente de cobro.');
    }

    const existing = await this.prisma.activityLog.findFirst({
      where: {
        organizationId: access.organizationId,
        entityType: 'Invoice',
        entityId: invoiceId,
        action: MARK_PAID_ACTION,
      },
    });

    await this.touchLastAccessed(access);

    if (existing) {
      // Ya se había reclamado antes: se audita el reintento (trazabilidad),
      // pero no se vuelve a notificar a los admins para no saturarlos de
      // clicks repetidos sobre la misma factura.
      await this.activity.record({
        organizationId: access.organizationId,
        action: 'CUSTOMER_CLAIMED_PAID_REPEAT',
        entityType: 'Invoice',
        entityId: invoiceId,
        metadata: { portalAccessId: access.id },
      });
      return { ok: true, alreadyFlagged: true };
    }

    await this.activity.record({
      organizationId: access.organizationId,
      action: MARK_PAID_ACTION,
      entityType: 'Invoice',
      entityId: invoiceId,
      metadata: {
        portalAccessId: access.id,
        customerId: access.customerId,
        folio: invoice.folio,
        total: Number(invoice.total),
      },
    });

    const folio = invoice.folio ?? invoice.cfdiUuid.slice(0, 8);
    await this.notifications.notifyOrgAdmins(access.organizationId, {
      type: 'CUSTOMER_PAID_CLAIM',
      title: 'Un cliente marcó una factura como pagada',
      body: `${invoice.customer?.name ?? 'El cliente'} indicó que ya pagó la factura ${folio}. Verifica y concilia el pago.`,
      metadata: { invoiceId, customerId: access.customerId },
    });

    return { ok: true, alreadyFlagged: false };
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * Resuelve el token a un acceso válido y vigente. Nunca revela si un token
   * inexistente vs. vencido: ambos casos son "no autorizado" desde el punto
   * de vista de este método, pero devuelven códigos distintos (404 vs 410)
   * para dar una señal mínima de UX sin filtrar validez de formato.
   */
  private async resolveAccess(token: string): Promise<CustomerPortalAccessRow> {
    if (!token || token.length < 32) {
      throw new NotFoundException('Enlace no encontrado.');
    }

    const rows = await this.prisma.$queryRaw<CustomerPortalAccessRow[]>`
      SELECT "id", "organizationId", "customerId", "token", "expiresAt", "createdAt", "lastAccessedAt"
      FROM "CustomerPortalAccess"
      WHERE "token" = ${token}
      LIMIT 1
    `;
    const access = rows[0];
    if (!access) throw new NotFoundException('Enlace no encontrado.');
    if (access.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Este enlace ya venció.');
    }
    return access;
  }

  private async touchLastAccessed(access: CustomerPortalAccessRow): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE "CustomerPortalAccess" SET "lastAccessedAt" = now() WHERE "id" = ${access.id}
      `;
    } catch (err) {
      this.logger.warn(
        `No se pudo actualizar lastAccessedAt del portal (${access.id}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
