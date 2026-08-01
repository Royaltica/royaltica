import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
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
