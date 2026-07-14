import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface ActivityRecord {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Bitácora general de actividad. La escritura nunca debe romper la
 * operación de negocio: si falla, solo se advierte en el log.
 */
@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: ActivityRecord): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (entry.metadata ?? {}) as Prisma.InputJsonValue,
          ipAddress: entry.ipAddress,
        },
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo registrar actividad (${entry.action}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
