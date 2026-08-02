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

const num = (v: Prisma.Decimal | null): number => (v ? Number(v) : 0);

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
  ) {}

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
    const [orgs, amounts] = await Promise.all([
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
    ]);

    const amountByOrg = new Map(
      amounts.map((a) => [a.organizationId, num(a._sum.total)]),
    );

    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      rfc: o.rfc,
      plan: o.plan,
      isActive: o.isActive,
      deleted: o.deletedAt !== null,
      createdAt: o.createdAt,
      amount: amountByOrg.get(o.id) ?? 0,
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

  /** Cambia plan y/o estado activo de una organización. */
  async updateOrganization(id: string, dto: UpdateOrganizationDto) {
    await this.ensureExists(id);
    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.plan !== undefined) data.plan = dto.plan;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
      select: { id: true, name: true, plan: true, isActive: true },
    });
    return updated;
  }

  /** Soft-delete: marca deletedAt y desactiva. No borra datos. */
  async removeOrganization(id: string) {
    await this.ensureExists(id);
    await this.prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
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

  async costForOrganization(organizationId: string, query: QueryCostsDto) {
    await this.ensureExists(organizationId);
    return this.usage.breakdownByFeature(organizationId, this.toPeriod(query));
  }

  realtimeCosts() {
    return this.usage.realtime();
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
