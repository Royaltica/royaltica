import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseService } from '../auth/firebase/firebase.service';
import { EmailService } from '../email/email.service';
import { UsageService, type UsagePeriod } from '../usage/usage.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryCostsDto } from './dto/query-costs.dto';
import type { Env } from '../config/env.validation';
import { SEAT_PACKAGE_PRESETS, getSeatLimits } from '../common/seat-limits';
import { AuthService, type AuthResult } from '../auth/auth.service';
import {
  COLLECTION_ENGINE_JOB_RUN_ACTION,
  SYSTEM_HEALTH_SNAPSHOT_ACTION,
} from '../jobs/jobs.service';
import { PLAN_MONTHLY_PRICE_MXN, isRevenueGenerating } from '../common/plan-pricing';
import { computeHealthScore } from '../common/health-score';

/** Cadencia esperada del motor de cobranza (cron diario 11am). Si no hay una
 * corrida exitosa en más de esta ventana, se marca "atascado" en vez de
 * esperar indefinidamente a que aparezca una — ver AdminService#collectionEngineHealth. */
const COLLECTION_ENGINE_STALE_HOURS = 26;

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);
const avg = (nums: number[]): number | null =>
  nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;

/**
 * Operaciones del panel SUPERADMIN: gestión de organizaciones (onboarding,
 * plan, activación), métricas globales de la plataforma y cost tracking.
 *
 * Estas operaciones NO se acotan por organizationId del JWT: el SUPERADMIN
 * opera sobre toda la plataforma. El guard de rol (RolesGuard + @Roles) protege
 * el acceso a nivel de controlador.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly email: EmailService,
    private readonly usage: UsageService,
    private readonly config: ConfigService<Env, true>,
    private readonly auth: AuthService,
  ) {}

  /** "Entrar como este cliente" — ver AuthService#impersonateOrganizationAdmin. */
  async impersonate(
    organizationId: string,
    actingSuperadmin: { id: string; email: string },
  ): Promise<AuthResult> {
    return this.auth.impersonateOrganizationAdmin(
      organizationId,
      actingSuperadmin,
    );
  }

  // ── Organizaciones ────────────────────────────────────────

  /**
   * Crea una organización nueva y su primer CORPORATE_ADMIN.
   * Si Firebase está configurado, crea la cuenta y genera el link de
   * invitación; si no (modo desarrollo), usa un firebaseUid temporal para no
   * bloquear el onboarding y deja el link en null.
   */
  async createOrganization(dto: CreateOrganizationDto) {
    const rfc = dto.rfc.toUpperCase();
    const adminEmail = dto.adminEmail.toLowerCase();

    const [orgDupe, userDupe] = await Promise.all([
      this.prisma.organization.findUnique({ where: { rfc } }),
      this.prisma.user.findUnique({ where: { email: adminEmail } }),
    ]);
    if (orgDupe) {
      throw new ConflictException('Ya existe una organización con ese RFC.');
    }
    if (userDupe) {
      throw new ConflictException('Ya existe un usuario con ese email.');
    }

    let firebaseUid = `pending-${randomUUID()}`;
    let inviteLink: string | null = null;
    if (this.firebase.isConfigured) {
      const fbUser = await this.firebase.createOrGetUser(
        adminEmail,
        dto.adminName,
      );
      firebaseUid = fbUser.uid;
      inviteLink = await this.firebase.generateInviteLink(adminEmail);
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        rfc,
        legalName: dto.legalName,
        locale: dto.locale,
        currency: dto.currency,
        plan: dto.plan ?? 'FREE',
        users: {
          create: {
            firebaseUid,
            email: adminEmail,
            name: dto.adminName,
            role: 'CORPORATE_ADMIN',
            status: 'INVITED',
            isActive: true,
          },
        },
      },
      include: {
        users: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    this.logger.log(
      `Organización creada: ${organization.name} (${rfc}) con admin ${adminEmail}.`,
    );

    // Registrar en la bitácora (aparece en el panel → Actividad). No bloquea
    // el onboarding si falla la escritura del log.
    await this.prisma.activityLog
      .create({
        data: {
          organizationId: organization.id,
          action: 'ORG_CREATED',
          entityType: 'Organization',
          entityId: organization.id,
          metadata: { name: organization.name, rfc, adminEmail },
        },
      })
      .catch(() => undefined);

    let emailSent = false;
    if (inviteLink) {
      const res = await this.email.sendInvitation(
        adminEmail,
        dto.adminName,
        inviteLink,
        organization.name,
        organization.id,
      );
      emailSent = res.sent;
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        rfc: organization.rfc,
        legalName: organization.legalName,
        plan: organization.plan,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
      },
      admin: organization.users[0],
      inviteLink,
      emailSent,
      firebaseConfigured: this.firebase.isConfigured,
    };
  }

  /** Lista todas las organizaciones con métricas básicas. */
  async listOrganizations() {
    const [
      orgs,
      amounts,
      adminCounts,
      supervisorCounts,
      agenteCounts,
      sequenceReminderCounts,
      singleStepReminderLogs,
      remindersCostByOrg,
      lastLoginByOrg,
      totalCostByOrg,
      paymentsTotalByOrg,
      paymentsFailedByOrg,
      overdueInvoicesByOrg,
    ] = await Promise.all([
        this.prisma.organization.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            rfc: true,
            plan: true,
            isActive: true,
            createdAt: true,
            deletedAt: true,
            settings: true,
            subscriptionStatus: true,
            _count: {
              select: { users: true, suppliers: true, invoices: true },
            },
          },
        }),
        // Monto facturado total por organización (para "volumen" en el panel).
        this.prisma.invoice.groupBy({
          by: ['organizationId'],
          where: { direction: 'PAYABLE', deletedAt: null },
          _sum: { total: true },
        }),
        // Uso de asientos por bucket (ver common/seat-limits.ts): para la
        // pestaña de supervisión multi-cliente (cuántas subcuentas de cada
        // tipo tiene cada cliente ya usadas, vs. el tope de su paquete).
        this.prisma.user.groupBy({
          by: ['organizationId'],
          where: { role: 'CORPORATE_ADMIN' },
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({
          by: ['organizationId'],
          where: { operationalProfile: 'SUPERVISOR_GERENTE' },
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({
          by: ['organizationId'],
          where: { operationalProfile: 'AGENTE_EJECUTIVO' },
          _count: { _all: true },
        }),
        // Recordatorios del motor de escalamiento multi-paso (collection-sequences).
        this.prisma.activityLog.groupBy({
          by: ['organizationId'],
          where: { action: 'COLLECTION_SEQUENCE_STEP_SENT' },
          _count: { _all: true },
        }),
        // Recordatorios del agente de un solo paso (T14/T3, ReceivablesService)
        // — viven en InvoiceAuditLog, no en ActivityLog, y sin organizationId
        // propio (solo vía Invoice), así que no se puede hacer un groupBy
        // directo: se trae la proyección mínima y se agrega en memoria.
        this.prisma.invoiceAuditLog.findMany({
          where: { action: 'REMINDER_SENT' },
          select: { invoice: { select: { organizationId: true } } },
        }),
        // Costo aislado de recordatorios de cobranza (tag 'collection_reminder'),
        // separado del resto de correos/WhatsApp — pedido explícito de Paolo.
        this.usage.costByTagPerOrganization('collection_reminder'),
        // Último acceso REAL (login) por organización — User.lastLoginAt ya se
        // actualiza en cada login (ver AuthService#verifyToken/issueSession);
        // solo faltaba exponerlo acá. Distinto de "Cliente Desde" (createdAt).
        this.prisma.user.groupBy({
          by: ['organizationId'],
          where: { lastLoginAt: { not: null } },
          _max: { lastLoginAt: true },
        }),
        // Costo TOTAL por organización (todos los features, no solo
        // recordatorios) — para calcular margen (ingreso - costo) por cliente.
        this.usage.costByOrganization(),
        // ── Señales reales para healthScore (ver common/health-score.ts) ──
        this.prisma.payment.groupBy({
          by: ['organizationId'],
          _count: { _all: true },
        }),
        this.prisma.payment.groupBy({
          by: ['organizationId'],
          where: { status: 'FAILED' },
          _count: { _all: true },
        }),
        this.prisma.invoice.groupBy({
          by: ['organizationId'],
          where: {
            dueDate: { lt: new Date() },
            status: { not: InvoiceStatus.PAID },
            deletedAt: null,
          },
          _count: { _all: true },
        }),
      ]);

    const amountByOrg = new Map(
      amounts.map((a) => [a.organizationId, num(a._sum.total)]),
    );
    // organizationId es nullable en el tipo que genera groupBy (aunque en la
    // práctica un User de CORPORATE_ADMIN/SUPERVISOR_GERENTE/AGENTE_EJECUTIVO
    // siempre pertenece a una organización) — se tipa `string | null` para
    // calzar exactamente con lo que Prisma infiere, y se descartan los nulls.
    const toCountMap = (
      rows: { organizationId: string | null; _count: { _all: number } }[],
    ) =>
      new Map(
        rows
          .filter((r): r is { organizationId: string; _count: { _all: number } } =>
            r.organizationId !== null,
          )
          .map((r) => [r.organizationId, r._count._all]),
      );
    const adminByOrg = toCountMap(adminCounts);
    const supervisorByOrg = toCountMap(supervisorCounts);
    const agenteByOrg = toCountMap(agenteCounts);

    // Recordatorios enviados = motor multi-paso (ActivityLog) + agente de un
    // solo paso T14/T3 (InvoiceAuditLog, agregado en memoria arriba).
    const remindersSentByOrg = toCountMap(sequenceReminderCounts);
    for (const log of singleStepReminderLogs) {
      const orgId = log.invoice.organizationId;
      remindersSentByOrg.set(orgId, (remindersSentByOrg.get(orgId) ?? 0) + 1);
    }
    const lastLoginByOrgMap = new Map(
      lastLoginByOrg
        .filter((r): r is typeof r & { organizationId: string } => r.organizationId !== null)
        .map((r) => [r.organizationId, r._max.lastLoginAt]),
    );
    const totalCostByOrgMap = new Map(
      totalCostByOrg.map((c) => [c.organizationId, c.estimatedCostMxn]),
    );
    const paymentsTotalByOrgMap = toCountMap(paymentsTotalByOrg);
    const paymentsFailedByOrgMap = toCountMap(paymentsFailedByOrg);
    const overdueInvoicesByOrgMap = toCountMap(overdueInvoicesByOrg);

    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      rfc: o.rfc,
      plan: o.plan,
      isActive: o.isActive,
      deleted: o.deletedAt !== null,
      seatPackage:
        ((o.settings as Record<string, unknown>)?.seatPackage as
          | string
          | undefined) ?? null,
      product:
        ((o.settings as Record<string, unknown>)?.product as
          | string
          | undefined) ?? null,
      seats: {
        admin: adminByOrg.get(o.id) ?? 0,
        supervisor: supervisorByOrg.get(o.id) ?? 0,
        agente: agenteByOrg.get(o.id) ?? 0,
      },
      // Infinity (sin paquete asignado = sin tope) no es JSON válido; se
      // normaliza a null explícitamente para que el frontend no dependa del
      // comportamiento implícito de JSON.stringify(Infinity) === "null".
      seatLimits: (() => {
        const l = getSeatLimits({ settings: o.settings });
        const toNullable = (n: number) => (Number.isFinite(n) ? n : null);
        return {
          admin: toNullable(l.admin),
          supervisor: toNullable(l.supervisor),
          agente: toNullable(l.agente),
        };
      })(),
      createdAt: o.createdAt,
      amount: amountByOrg.get(o.id) ?? 0,
      // Recordatorios de cobranza enviados (histórico completo) — punto
      // pedido por Paolo en el audio del superadmin.
      remindersSent: remindersSentByOrg.get(o.id) ?? 0,
      // Costo aislado SOLO de recordatorios (no mezclado con otros correos/WhatsApp).
      remindersCostMxn: remindersCostByOrg.get(o.id)?.estimatedCostMxn ?? 0,
      // Margen estimado (ingreso de plan - costo operativo total) — ingreso
      // aproximado por PLAN_MONTHLY_PRICE_MXN (no es el monto real de
      // Stripe, ver common/plan-pricing.ts), costo real medido vía UsageEvent.
      totalCostMxn: totalCostByOrgMap.get(o.id) ?? 0,
      revenueMxn: isRevenueGenerating(o.subscriptionStatus) ? PLAN_MONTHLY_PRICE_MXN[o.plan] : 0,
      marginMxn:
        (isRevenueGenerating(o.subscriptionStatus) ? PLAN_MONTHLY_PRICE_MXN[o.plan] : 0) -
        (totalCostByOrgMap.get(o.id) ?? 0),
      subscriptionStatus: o.subscriptionStatus,
      // Último login REAL de cualquier usuario de esta organización (null si
      // nunca ha entrado nadie). Distinto de createdAt ("Cliente Desde").
      lastLoginAt: lastLoginByOrgMap.get(o.id)?.toISOString() ?? null,
      // "Salud" real (ver common/health-score.ts): % de pagos fallidos, %
      // de facturas vencidas y qué tan reciente fue el último login — ya NO
      // es la heurística fija de antes (deleted/inactive → 0, invoices>0 → 95).
      healthScore: computeHealthScore({
        deleted: o.deletedAt !== null,
        isActive: o.isActive,
        totalPayments: paymentsTotalByOrgMap.get(o.id) ?? 0,
        failedPayments: paymentsFailedByOrgMap.get(o.id) ?? 0,
        totalInvoices: o._count.invoices,
        overdueInvoices: overdueInvoicesByOrgMap.get(o.id) ?? 0,
        lastLoginAt: lastLoginByOrgMap.get(o.id) ?? null,
      }),
      counts: {
        users: o._count.users,
        suppliers: o._count.suppliers,
        invoices: o._count.invoices,
      },
    }));
  }

  /**
   * Bitácora de actividad GLOBAL de la plataforma (todas las organizaciones).
   * A diferencia de GET /activity (acotado al org del usuario), aquí el
   * SUPERADMIN ve todo. Incluye el nombre del usuario y de la organización.
   */
  async recentActivity(limit = 50) {
    const take = Math.min(100, Math.max(1, limit));
    const rows = await this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      user: a.user?.name ?? 'Sistema',
      organization: a.organization?.name ?? '—',
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Historial de accesos (quién entró y cuándo) — pedido explícito de Paolo.
   * Filtra la misma bitácora a solo eventos de login (AuthService ya los
   * escribe en cada verifyToken/issueSession exitoso): LOGIN_SUCCESS,
   * LOGIN_2FA_PENDING, LOGIN_2FA_COMPLETED, e impersonation del SUPERADMIN.
   */
  async loginHistory(limit = 50) {
    const take = Math.min(200, Math.max(1, limit));
    const rows = await this.prisma.activityLog.findMany({
      where: {
        action: {
          in: [
            'LOGIN_SUCCESS',
            'LOGIN_2FA_PENDING',
            'LOGIN_2FA_COMPLETED',
            'SUPERADMIN_IMPERSONATION_STARTED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      action: a.action,
      user: a.user?.name ?? 'Sistema',
      userEmail: a.user?.email ?? null,
      organization: a.organization?.name ?? '—',
      ipAddress: a.ipAddress,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /** Detalle de una organización + estadísticas de uso y costo (30 días). */
  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        rfc: true,
        legalName: true,
        plan: true,
        isActive: true,
        settings: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: { users: true, suppliers: true, invoices: true, payments: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [invoiced, paid, costs] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId: id, direction: 'PAYABLE', deletedAt: null },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          organizationId: id,
          direction: 'PAYABLE',
          deletedAt: null,
          status: InvoiceStatus.PAID,
        },
        _sum: { total: true },
      }),
      this.usage.breakdownByFeature(id, { from: since }),
    ]);

    return {
      id: org.id,
      name: org.name,
      rfc: org.rfc,
      legalName: org.legalName,
      plan: org.plan,
      isActive: org.isActive,
      deleted: org.deletedAt !== null,
      createdAt: org.createdAt,
      counts: {
        users: org._count.users,
        suppliers: org._count.suppliers,
        invoices: org._count.invoices,
        payments: org._count.payments,
      },
      amounts: {
        totalInvoiced: num(invoiced._sum.total),
        totalPaid: num(paid._sum.total),
      },
      cost30d: costs,
    };
  }

  /**
   * Cambia plan y/o estado activo de una organización.
   * `actor` es el SUPERADMIN que hace el cambio — se audita en ActivityLog
   * (acción SUPERADMIN_ORG_UPDATED) para poder revisar después quién tocó
   * qué plan/paquete/producto de qué cliente y cuándo.
   */
  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    actor?: { id: string; email: string },
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { plan: true, isActive: true, settings: true, name: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');
    const before = {
      plan: org.plan,
      isActive: org.isActive,
      seatPackage: (org.settings as Prisma.JsonObject | null)?.seatPackage ?? null,
      product: (org.settings as Prisma.JsonObject | null)?.product ?? null,
    };
    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.seatPackage !== undefined || dto.product !== undefined) {
      // Ambos se guardan en settings (JSON) — ver common/seat-limits.ts
      // sobre por qué no son columnas propias todavía. Se fusionan en un
      // solo patch para no pisar uno al escribir el otro.
      const settings = (org.settings ?? {}) as Prisma.JsonObject;
      const patch: Record<string, unknown> = { ...settings };
      if (dto.seatPackage !== undefined) {
        patch.seatLimits = SEAT_PACKAGE_PRESETS[dto.seatPackage];
        patch.seatPackage = dto.seatPackage;
      }
      if (dto.product !== undefined) {
        patch.product = dto.product;
      }
      // Cast explícito a InputJsonValue: Prisma exige que el shape calce
      // estructuralmente con JsonValue, y los tipos de origen (SeatLimits
      // con Number.POSITIVE_INFINITY tipado `number`, Product como union
      // literal) no lo satisfacen por inferencia automática aunque el valor
      // real siempre sea serializable.
      data.settings = patch as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
      select: { id: true, name: true, plan: true, isActive: true, settings: true },
    });

    const after = {
      plan: updated.plan,
      isActive: updated.isActive,
      seatPackage: (updated.settings as Prisma.JsonObject | null)?.seatPackage ?? null,
      product: (updated.settings as Prisma.JsonObject | null)?.product ?? null,
    };
    const changed = (Object.keys(after) as Array<keyof typeof after>).filter(
      (k) => before[k] !== after[k],
    );
    if (changed.length > 0) {
      await this.prisma.activityLog
        .create({
          data: {
            organizationId: id,
            userId: actor?.id,
            action: 'SUPERADMIN_ORG_UPDATED',
            entityType: 'Organization',
            entityId: id,
            metadata: {
              orgName: org.name,
              actorEmail: actor?.email ?? null,
              changed,
              before: Object.fromEntries(changed.map((k) => [k, before[k]])),
              after: Object.fromEntries(changed.map((k) => [k, after[k]])),
            },
          },
        })
        .catch(() => undefined);
    }

    return updated;
  }

  /** Soft-delete: marca deletedAt y desactiva. No borra datos. */
  async removeOrganization(id: string, actor?: { id: string; email: string }) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.prisma.activityLog
      .create({
        data: {
          organizationId: id,
          userId: actor?.id,
          action: 'SUPERADMIN_ORG_DELETED',
          entityType: 'Organization',
          entityId: id,
          metadata: { orgName: org.name, actorEmail: actor?.email ?? null },
        },
      })
      .catch(() => undefined);
    return { deleted: true, id };
  }

  // ── Métricas globales ─────────────────────────────────────

  /** KPIs de toda la plataforma. */
  async globalStats() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      orgsTotal,
      orgsActive,
      usersTotal,
      suppliersTotal,
      invoicesTotal,
      invoiced,
      cost30d,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.user.count(),
      this.prisma.supplier.count({ where: { deletedAt: null } }),
      this.prisma.invoice.count({ where: { direction: 'PAYABLE', deletedAt: null } }),
      this.prisma.invoice.aggregate({
        where: { direction: 'PAYABLE', deletedAt: null },
        _sum: { total: true },
      }),
      this.prisma.usageEvent.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { estimatedCostMxn: true },
        _count: { _all: true },
      }),
    ]);

    return {
      organizations: { total: orgsTotal, active: orgsActive },
      users: usersTotal,
      suppliers: suppliersTotal,
      invoices: { total: invoicesTotal, totalAmount: num(invoiced._sum.total) },
      cost30d: {
        events: cost30d._count._all,
        estimatedCostMxn: num(cost30d._sum.estimatedCostMxn),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Cost tracking (delegado a UsageService) ───────────────

  costByOrganization(query: QueryCostsDto) {
    return this.usage.costByOrganization(this.toPeriod(query));
  }

  /** Desglose de costo por feature de toda la plataforma (Gemini, correos, etc.). */
  globalCostByFeature(query: QueryCostsDto) {
    return this.usage.globalBreakdownByFeature(this.toPeriod(query));
  }

  /** Costo aislado de recordatorios de cobranza de TODA la plataforma (separado del resto de correos/WhatsApp). */
  remindersCostGlobal(query: QueryCostsDto) {
    return this.usage.costByTag('collection_reminder', undefined, this.toPeriod(query));
  }

  async costForOrganization(organizationId: string, query: QueryCostsDto) {
    await this.ensureExists(organizationId);
    return this.usage.breakdownByFeature(organizationId, this.toPeriod(query));
  }

  realtimeCosts() {
    return this.usage.realtime();
  }

  // ── Salud del agente de recordatorios (cron de cobranza) ───

  /**
   * Estado del motor de escalamiento de cobranza (JobsService#collectionSequenceEngine,
   * corre diario 11am). Distinto del health-check general (API/DB/Redis/IA):
   * aquí se responde específicamente "¿está vivo el agente de recordatorios,
   * o se quedó trabado/falló?" — pedido explícito de Paolo.
   */
  async collectionEngineHealth(): Promise<{
    status: 'ok' | 'failed' | 'stuck' | 'unknown';
    lastRunAt: string | null;
    lastRunSuccess: boolean | null;
    lastRunResult: Record<string, unknown> | null;
    hoursSinceLastRun: number | null;
  }> {
    const last = await this.prisma.activityLog.findFirst({
      where: { action: COLLECTION_ENGINE_JOB_RUN_ACTION },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) {
      return {
        status: 'unknown',
        lastRunAt: null,
        lastRunSuccess: null,
        lastRunResult: null,
        hoursSinceLastRun: null,
      };
    }
    const meta = (last.metadata ?? {}) as Record<string, unknown>;
    const success = meta.success === true;
    const hoursSince = (Date.now() - last.createdAt.getTime()) / 3_600_000;
    const stuck = hoursSince > COLLECTION_ENGINE_STALE_HOURS;
    return {
      status: stuck ? 'stuck' : success ? 'ok' : 'failed',
      lastRunAt: last.createdAt.toISOString(),
      lastRunSuccess: success,
      lastRunResult: meta,
      hoursSinceLastRun: Math.round(hoursSince * 10) / 10,
    };
  }

  // ── Histórico de latencia/uptime (snapshots cada 10 min, ver JobsService#systemHealthSnapshot) ──

  /**
   * Histórico real de salud del sistema (no solo el snapshot que se mide al
   * cargar el dashboard): lee los snapshots periódicos que JobsService
   * guarda cada 10 minutos en ActivityLog, y calcula uptime % de DB/Redis
   * en la ventana solicitada además de la serie de latencia para graficar.
   */
  async healthHistory(hours = 24) {
    const since = new Date(Date.now() - Math.min(168, Math.max(1, hours)) * 3_600_000);
    const rows = await this.prisma.activityLog.findMany({
      where: { action: SYSTEM_HEALTH_SNAPSHOT_ACTION, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, metadata: true },
    });

    const samples = rows.map((r) => {
      const m = r.metadata as Record<string, unknown>;
      return {
        at: r.createdAt.toISOString(),
        dbOk: m.dbOk === true,
        dbLatencyMs: typeof m.dbLatencyMs === 'number' ? m.dbLatencyMs : null,
        redisOk: m.redisOk === true,
        redisLatencyMs: typeof m.redisLatencyMs === 'number' ? m.redisLatencyMs : null,
      };
    });

    const pct = (okCount: number) =>
      samples.length > 0 ? Math.round((okCount / samples.length) * 1000) / 10 : 100;

    return {
      windowHours: hours,
      samples,
      uptimePct: {
        db: pct(samples.filter((s) => s.dbOk).length),
        redis: pct(samples.filter((s) => s.redisOk).length),
      },
      avgLatencyMs: {
        db: avg(samples.map((s) => s.dbLatencyMs).filter((n): n is number => n !== null)),
        redis: avg(samples.map((s) => s.redisLatencyMs).filter((n): n is number => n !== null)),
      },
    };
  }

  // ── Hardening checklist ────────────────────────────────────

  /**
   * Checklist de hardening por ambiente. No revela secretos, solo presencia.
   * Vive en el panel SUPERADMIN (no en /organization) porque expone postura
   * de infraestructura de toda la plataforma, no algo que un admin de un
   * tenant individual deba poder consultar.
   */
  getProductionReadiness() {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const has = (key: keyof Env) =>
      String(this.config.get(key, { infer: true }) ?? '').length > 0;
    const allowDevLogin =
      this.config.get('ALLOW_DEV_LOGIN', { infer: true }) === 'true';

    const items = [
      {
        key: 'node_env',
        label: 'NODE_ENV production',
        status: nodeEnv === 'production',
        detail: `NODE_ENV=${nodeEnv}`,
      },
      {
        key: 'dev_login',
        label: 'Dev-login apagado',
        status: !allowDevLogin,
        detail: allowDevLogin
          ? 'ALLOW_DEV_LOGIN=true; no usar con datos reales.'
          : 'ALLOW_DEV_LOGIN=false.',
      },
      {
        key: 'firebase',
        label: 'Firebase Admin real',
        status:
          has('FIREBASE_PROJECT_ID') &&
          has('FIREBASE_CLIENT_EMAIL') &&
          has('FIREBASE_PRIVATE_KEY'),
        detail: 'Requiere project id, client email y private key.',
      },
      {
        key: 'cors',
        label: 'CORS restringido',
        status: !this.config.get('ALLOWED_ORIGINS', { infer: true }).includes('*'),
        detail: this.config.get('ALLOWED_ORIGINS', { infer: true }),
      },
      {
        key: 'sentry',
        label: 'Sentry configurado',
        status: has('SENTRY_DSN'),
        detail: has('SENTRY_DSN') ? 'Errores enviados a Sentry.' : 'Sentry no-op.',
      },
      {
        key: 'email',
        label: 'Email real',
        status: has('RESEND_API_KEY'),
        detail: has('RESEND_API_KEY') ? 'Resend activo.' : 'Email en stub.',
      },
      {
        key: 'storage',
        label: 'Storage real',
        status:
          has('GCS_BUCKET_NAME') ||
          (has('S3_BUCKET') && has('S3_ACCESS_KEY_ID') && has('S3_SECRET_ACCESS_KEY')),
        detail: 'GCS o S3-compatible configurado.',
      },
      {
        key: 'jobs',
        label: 'Jobs explícitamente configurados',
        status: ['true', 'false'].includes(
          this.config.get('JOBS_ENABLED', { infer: true }),
        ),
        detail: `JOBS_ENABLED=${this.config.get('JOBS_ENABLED', { infer: true })}`,
      },
    ];
    const passed = items.filter((i) => i.status).length;
    return {
      passed,
      total: items.length,
      percent: Math.round((passed / items.length) * 100),
      productionSafe: items.every((i) => i.status),
      items,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  private async ensureExists(id: string): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');
  }

  private toPeriod(query: QueryCostsDto): UsagePeriod {
    return {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }
}
