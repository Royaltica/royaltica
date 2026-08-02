import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import type { Env } from '../config/env.validation';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Perfil de la organización + su configuración efectiva. */
  async getProfile(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        rfc: true,
        legalName: true,
        plan: true,
        isActive: true,
        createdAt: true,
        locale: true,
        currency: true,
        brandDisplayName: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
        brandAccentColor: true,
      },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const settings = await this.settings.get(organizationId);
    return { ...org, settings };
  }

  async getSettings(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const settings = await this.settings.get(organizationId);
    // locale/currency/branding son columnas propias de Organization (no
    // viven en el JSON `settings`): se anexan aparte para que el frontend
    // pueda leerlas con una sola llamada a GET /organization/settings.
    const org = await this.orgColumns(organizationId);
    return { ...settings, ...org };
  }

  async updateSettings(user: AuthenticatedUser, dto: UpdateSettingsDto) {
    const organizationId = this.requireOrg(user);
    const {
      locale,
      currency,
      brandDisplayName,
      brandLogoUrl,
      brandPrimaryColor,
      brandAccentColor,
      ...settingsPatch
    } = dto;
    const updated = await this.settings.update(organizationId, settingsPatch);

    // locale/currency/branding son columnas propias de Organization (no
    // viven en el JSON `settings`): se persisten aparte cuando vienen en
    // el parche.
    const hasOrgColumnPatch =
      locale !== undefined ||
      currency !== undefined ||
      brandDisplayName !== undefined ||
      brandLogoUrl !== undefined ||
      brandPrimaryColor !== undefined ||
      brandAccentColor !== undefined;

    const org = hasOrgColumnPatch
      ? await this.prisma.organization.update({
          where: { id: organizationId },
          data: {
            ...(locale !== undefined ? { locale } : {}),
            ...(currency !== undefined ? { currency } : {}),
            ...(brandDisplayName !== undefined ? { brandDisplayName } : {}),
            ...(brandLogoUrl !== undefined ? { brandLogoUrl } : {}),
            ...(brandPrimaryColor !== undefined ? { brandPrimaryColor } : {}),
            ...(brandAccentColor !== undefined ? { brandAccentColor } : {}),
          },
          select: this.orgColumnSelect(),
        })
      : await this.orgColumns(organizationId);

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'ORG_SETTINGS_UPDATED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { changed: Object.keys(dto) },
    });

    return { ...updated, ...org };
  }

  /**
   * Checklist operacional para convertir una organización en tenant listo para
   * cliente. No cambia estado: solo resume configuración + señales de datos
   * reales para que onboarding y soporte sepan qué falta.
   */
  async getReadiness(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const [org, settings, users, customers, receivables, policies] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            name: true,
            locale: true,
            currency: true,
            brandDisplayName: true,
            brandLogoUrl: true,
            brandPrimaryColor: true,
          },
        }),
        this.settings.get(organizationId),
        this.prisma.user.count({
          where: { organizationId, isActive: true },
        }),
        this.prisma.customer.count({
          where: { organizationId, deletedAt: null, isActive: true },
        }),
        this.prisma.invoice.count({
          where: {
            organizationId,
            direction: 'RECEIVABLE',
            deletedAt: null,
          },
        }),
        this.prisma.collectionPolicy.count({
          where: { organizationId, isActive: true, deletedAt: null },
        }),
      ]);
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const items = [
      {
        key: 'branding',
        label: 'Branding configurado',
        status: Boolean(
          org.brandDisplayName || org.brandLogoUrl || org.brandPrimaryColor,
        ),
        detail: org.brandDisplayName
          ? `Marca visible: ${org.brandDisplayName}`
          : 'Configura nombre, logo o colores para white label.',
      },
      {
        key: 'locale',
        label: 'Moneda e idioma del tenant',
        status: Boolean(org.locale && org.currency),
        detail: `${org.locale}/${org.currency}`,
      },
      {
        key: 'users',
        label: 'Usuarios activos',
        status: users > 0,
        detail: `${users} usuario(s) activo(s).`,
      },
      {
        key: 'contact_channels',
        label: 'Canales de contacto reales',
        status: this.config.get('RESEND_API_KEY', { infer: true }).length > 0,
        detail:
          this.config.get('RESEND_API_KEY', { infer: true }).length > 0
            ? 'Email real activo.'
            : 'Falta RESEND_API_KEY; emails quedan en stub.',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp configurado',
        status: this.config.get('WHATSAPP_TOKEN', { infer: true }).length > 0,
        detail:
          this.config.get('WHATSAPP_TOKEN', { infer: true }).length > 0
            ? 'WhatsApp real activo.'
            : 'Sin WHATSAPP_TOKEN; recordatorios WhatsApp quedan en stub.',
      },
      {
        key: 'customers',
        label: 'Clientes cargados',
        status: customers > 0,
        detail: `${customers} cliente(s) activo(s).`,
      },
      {
        key: 'receivables',
        label: 'Facturas CxC cargadas',
        status: receivables > 0,
        detail: `${receivables} factura(s) CxC.`,
      },
      {
        key: 'collection_policy',
        label: 'Política de cobranza activa',
        status: policies > 0,
        detail:
          policies > 0
            ? `${policies} política(s) activa(s).`
            : 'Configura guard rails antes de automatizar cobranza.',
      },
      {
        key: 'external_sync',
        label: 'Integración/importación externa',
        status: Boolean(
          settings.externalSyncProvider === 'generic-csv' ||
            (settings.externalSyncProvider === 'generic-rest' &&
              settings.externalSyncRestBaseUrl &&
              settings.externalSyncRestAuthHeader),
        ),
        detail:
          settings.externalSyncProvider === 'generic-rest'
            ? 'REST configurado para datos externos.'
            : settings.externalSyncProvider === 'generic-csv'
              ? 'CSV universal seleccionado.'
              : 'Selecciona CSV o REST para carga repetible de clientes/facturas.',
      },
    ];

    const completed = items.filter((i) => i.status).length;
    return {
      organization: org,
      completed,
      total: items.length,
      percent: Math.round((completed / items.length) * 100),
      items,
    };
  }

  /** Checklist de hardening por ambiente. No revela secretos, solo presencia. */
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

  private orgColumnSelect() {
    return {
      locale: true,
      currency: true,
      brandDisplayName: true,
      brandLogoUrl: true,
      brandPrimaryColor: true,
      brandAccentColor: true,
    } as const;
  }

  /** Columnas propias de Organization que se anexan a la config efectiva. */
  private async orgColumns(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: this.orgColumnSelect(),
    });
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
