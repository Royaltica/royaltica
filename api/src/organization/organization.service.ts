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
      },
    });
    if (!org) throw new NotFoundException('Organización no encontrada.');

    const settings = await this.settings.get(organizationId);
    return { ...org, settings };
  }

  async getSettings(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    return this.settings.get(organizationId);
  }

  async updateSettings(user: AuthenticatedUser, dto: UpdateSettingsDto) {
    const organizationId = this.requireOrg(user);
    const { locale, currency, ...settingsPatch } = dto;
    const updated = await this.settings.update(organizationId, settingsPatch);

    // locale/currency son columnas propias de Organization (no viven en el
    // JSON `settings`): se persisten aparte cuando vienen en el parche.
    let org = { locale: undefined as string | undefined, currency: undefined as string | undefined };
    if (locale !== undefined || currency !== undefined) {
      org = await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          ...(locale !== undefined ? { locale } : {}),
          ...(currency !== undefined ? { currency } : {}),
        },
        select: { locale: true, currency: true },
      });
    } else {
      org = await this.prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { locale: true, currency: true },
      });
    }

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'ORG_SETTINGS_UPDATED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { changed: Object.keys(dto) },
    });

    return { ...updated, locale: org.locale, currency: org.currency };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
