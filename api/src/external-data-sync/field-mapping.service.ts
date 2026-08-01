import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  IDENTITY_MAPPING,
  type ExternalSyncEntityType,
  type FieldMapping,
} from './field-mapping.types';

/**
 * Fila cruda de "ExternalSyncFieldMapping" tal como vive en Postgres.
 * Se accede vía SQL tipada ($queryRaw/$executeRaw) en vez del delegate de
 * Prisma Client (prisma.externalSyncFieldMapping): este sandbox no tiene
 * acceso de red para correr `prisma generate` contra el schema nuevo (ver
 * constraints de la tarea), y la tabla es simple (una fila JSON por
 * organización+entidad) así que SQL directa es igual de clara y evita
 * depender de que el cliente generado ya conozca el modelo nuevo.
 */
interface FieldMappingRow {
  id: string;
  organizationId: string;
  entityType: ExternalSyncEntityType;
  mapping: FieldMapping;
}

@Injectable()
export class FieldMappingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mapeo EFECTIVO de una organización/entidad: el guardado en BD, o el
   * mapeo identidad (ver field-mapping.types.ts) si aún no configuró uno.
   */
  async getEffective(
    organizationId: string,
    entityType: ExternalSyncEntityType,
  ): Promise<FieldMapping> {
    const stored = await this.getStored(organizationId, entityType);
    return stored ?? IDENTITY_MAPPING[entityType];
  }

  /** Mapeo guardado explícitamente (null si la organización no configuró uno). */
  async getStored(
    organizationId: string,
    entityType: ExternalSyncEntityType,
  ): Promise<FieldMapping | null> {
    return this.prisma.withOrg(organizationId, async (tx) => {
      const rows = await tx.$queryRaw<FieldMappingRow[]>`
        SELECT "id", "organizationId", "entityType", "mapping"
        FROM "ExternalSyncFieldMapping"
        WHERE "organizationId" = ${organizationId}
          AND "entityType" = ${entityType}::"ExternalSyncEntityType"
        LIMIT 1
      `;
      return rows[0]?.mapping ?? null;
    });
  }

  /** Crea o reemplaza el mapeo de una organización/entidad (upsert manual). */
  async upsert(
    organizationId: string,
    entityType: ExternalSyncEntityType,
    mapping: FieldMapping,
  ): Promise<FieldMapping> {
    const mappingJson = JSON.stringify(mapping) as unknown as Prisma.JsonValue;
    await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ExternalSyncFieldMapping"
        WHERE "organizationId" = ${organizationId}
          AND "entityType" = ${entityType}::"ExternalSyncEntityType"
        LIMIT 1
      `;
      if (existing.length > 0) {
        await tx.$executeRaw`
          UPDATE "ExternalSyncFieldMapping"
          SET "mapping" = ${mappingJson}::jsonb, "updatedAt" = now()
          WHERE "id" = ${existing[0].id}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "ExternalSyncFieldMapping"
            ("id", "organizationId", "entityType", "mapping", "createdAt", "updatedAt")
          VALUES
            (${randomUUID()}, ${organizationId}, ${entityType}::"ExternalSyncEntityType", ${mappingJson}::jsonb, now(), now())
        `;
      }
    });
    return mapping;
  }
}
