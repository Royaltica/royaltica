import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CollectionPolicy, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateCollectionPolicyDto } from './dto/create-collection-policy.dto';
import { UpdateCollectionPolicyDto } from './dto/update-collection-policy.dto';

/** Política serializada para la API (DateTime[] → ISO strings). */
const serialize = (p: CollectionPolicy) => ({
  ...p,
  blackoutDates: p.blackoutDates.map((d) => d.toISOString()),
});

@Injectable()
export class CollectionPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateCollectionPolicyDto) {
    const organizationId = this.requireOrg(user);
    this.assertWindow(dto.allowedContactStartHour, dto.allowedContactEndHour);

    const policy = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionPolicy.create({
        data: {
          organizationId,
          name: dto.name,
          isActive: dto.isActive ?? true,
          maxContactsPerWeek: dto.maxContactsPerWeek,
          allowedContactStartHour: dto.allowedContactStartHour,
          allowedContactEndHour: dto.allowedContactEndHour,
          timezone: dto.timezone,
          gracePeriodDays: dto.gracePeriodDays,
          escalationThresholdDays: dto.escalationThresholdDays,
          preferredChannel: dto.preferredChannel,
          pauseMessage: dto.pauseMessage,
          blackoutDates: (dto.blackoutDates ?? []).map((d) => new Date(d)),
        },
      }),
    );

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_POLICY_CREATED',
      entityType: 'CollectionPolicy',
      entityId: policy.id,
      metadata: { name: policy.name, preferredChannel: policy.preferredChannel },
    });

    return serialize(policy);
  }

  async findAll(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionPolicy.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map(serialize);
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    const policy = await this.prisma.withOrg(organizationId, (tx) =>
      tx.collectionPolicy.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
    if (!policy) throw new NotFoundException('Política de cobranza no encontrada.');
    return serialize(policy);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCollectionPolicyDto,
  ) {
    const organizationId = this.requireOrg(user);

    const updated = await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await this.getOwnedTx(tx, organizationId, id);

      const startHour =
        dto.allowedContactStartHour ?? existing.allowedContactStartHour;
      const endHour = dto.allowedContactEndHour ?? existing.allowedContactEndHour;
      this.assertWindow(startHour, endHour);

      const data: Prisma.CollectionPolicyUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      if (dto.maxContactsPerWeek !== undefined)
        data.maxContactsPerWeek = dto.maxContactsPerWeek;
      if (dto.allowedContactStartHour !== undefined)
        data.allowedContactStartHour = dto.allowedContactStartHour;
      if (dto.allowedContactEndHour !== undefined)
        data.allowedContactEndHour = dto.allowedContactEndHour;
      if (dto.timezone !== undefined) data.timezone = dto.timezone;
      if (dto.gracePeriodDays !== undefined)
        data.gracePeriodDays = dto.gracePeriodDays;
      if (dto.escalationThresholdDays !== undefined)
        data.escalationThresholdDays = dto.escalationThresholdDays;
      if (dto.preferredChannel !== undefined)
        data.preferredChannel = dto.preferredChannel;
      if (dto.pauseMessage !== undefined) data.pauseMessage = dto.pauseMessage;
      if (dto.blackoutDates !== undefined)
        data.blackoutDates = dto.blackoutDates.map((d) => new Date(d));

      return tx.collectionPolicy.update({ where: { id }, data });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_POLICY_UPDATED',
      entityType: 'CollectionPolicy',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });

    return serialize(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    await this.prisma.withOrg(organizationId, async (tx) => {
      await this.getOwnedTx(tx, organizationId, id);
      await tx.collectionPolicy.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'COLLECTION_POLICY_DELETED',
      entityType: 'CollectionPolicy',
      entityId: id,
    });

    return { deleted: true, id };
  }

  // ── helpers ───────────────────────────────────────────────

  private async getOwnedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<CollectionPolicy> {
    const policy = await tx.collectionPolicy.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!policy) throw new NotFoundException('Política de cobranza no encontrada.');
    return policy;
  }

  /** La ventana de contacto debe tener al menos una hora de ancho. */
  private assertWindow(startHour: number, endHour: number): void {
    if (endHour <= startHour) {
      throw new BadRequestException(
        'allowedContactEndHour debe ser mayor que allowedContactStartHour.',
      );
    }
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
