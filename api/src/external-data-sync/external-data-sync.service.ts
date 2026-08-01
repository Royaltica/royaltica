import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { FieldMappingService } from './field-mapping.service';
import { GenericCsvConnector } from './connectors/generic-csv.connector';
import { GenericRestConnector } from './connectors/generic-rest.connector';
import type { ExternalDataConnector, ExternalSyncResult } from './external-connector.interface';
import {
  EXTERNAL_SYNC_ENTITY_TYPES,
  type ExternalSyncEntityType,
  type FieldMapping,
} from './field-mapping.types';

/**
 * Orquesta la sincronización de datos externos CxC (clientes + facturas de
 * venta): resuelve el conector (CSV si viene archivo, REST si no) con el
 * mapeo de campos ya resuelto, corre la sincronización y deja rastro en
 * ActivityLogService. Espejo intencional de ErpService (erp/erp.service.ts)
 * pero para el catálogo/facturación de clientes en vez del ERP corporativo.
 */
@Injectable()
export class ExternalDataSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
    private readonly fieldMapping: FieldMappingService,
  ) {}

  async status(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const settings = await this.settings.get(organizationId);
    return {
      externalSyncProvider: settings.externalSyncProvider,
      restConfigured: Boolean(
        settings.externalSyncRestBaseUrl && settings.externalSyncRestAuthHeader,
      ),
      message:
        'El conector CSV siempre está disponible (sube un archivo al importar). ' +
        'El conector REST se activa configurando baseUrl y el header de autenticación.',
    };
  }

  async syncCustomers(
    user: AuthenticatedUser,
    file: { buffer: Buffer } | undefined,
  ): Promise<ExternalSyncResult> {
    const organizationId = this.requireOrg(user);
    const connector = await this.resolveConnector(organizationId, file);
    const result = await connector.syncCustomers(organizationId);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'EXTERNAL_SYNC_CUSTOMERS',
      metadata: { ...result },
    });
    return result;
  }

  async syncReceivables(
    user: AuthenticatedUser,
    file: { buffer: Buffer } | undefined,
  ): Promise<ExternalSyncResult> {
    const organizationId = this.requireOrg(user);
    const connector = await this.resolveConnector(organizationId, file);
    const result = await connector.syncReceivables(organizationId);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'EXTERNAL_SYNC_RECEIVABLES',
      metadata: { ...result },
    });
    return result;
  }

  async getFieldMapping(
    user: AuthenticatedUser,
    entityType: string,
  ): Promise<{ entityType: ExternalSyncEntityType; mapping: FieldMapping; isDefault: boolean }> {
    const organizationId = this.requireOrg(user);
    const type = this.assertEntityType(entityType);
    const stored = await this.fieldMapping.getStored(organizationId, type);
    const mapping = stored ?? (await this.fieldMapping.getEffective(organizationId, type));
    return { entityType: type, mapping, isDefault: stored === null };
  }

  async setFieldMapping(
    user: AuthenticatedUser,
    entityType: string,
    mapping: FieldMapping,
  ): Promise<{ entityType: ExternalSyncEntityType; mapping: FieldMapping }> {
    const organizationId = this.requireOrg(user);
    const type = this.assertEntityType(entityType);
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      throw new BadRequestException('El mapeo debe ser un objeto { campoRoyaltica: campoExterno }.');
    }
    const saved = await this.fieldMapping.upsert(organizationId, type, mapping);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'EXTERNAL_SYNC_FIELD_MAPPING_UPDATED',
      entityType: type,
      metadata: { mapping: saved },
    });
    return { entityType: type, mapping: saved };
  }

  // ── helpers ───────────────────────────────────────────────

  private async resolveConnector(
    organizationId: string,
    file: { buffer: Buffer } | undefined,
  ): Promise<ExternalDataConnector> {
    const [customerMapping, receivableMapping] = await Promise.all([
      this.fieldMapping.getEffective(organizationId, 'CUSTOMER'),
      this.fieldMapping.getEffective(organizationId, 'RECEIVABLE'),
    ]);

    // Un archivo subido en la petición SIEMPRE gana: es la vía universal que
    // funciona sin importar qué sistema use el cliente ni si tiene API.
    if (file?.buffer && file.buffer.length > 0) {
      return new GenericCsvConnector(
        this.prisma,
        file.buffer,
        customerMapping,
        receivableMapping,
      );
    }

    const settings = await this.settings.get(organizationId);
    return new GenericRestConnector(
      this.prisma,
      {
        baseUrl: settings.externalSyncRestBaseUrl,
        authHeader: settings.externalSyncRestAuthHeader,
      },
      customerMapping,
      receivableMapping,
    );
  }

  private assertEntityType(value: string): ExternalSyncEntityType {
    const upper = value?.toUpperCase();
    if (!EXTERNAL_SYNC_ENTITY_TYPES.includes(upper as ExternalSyncEntityType)) {
      throw new BadRequestException(
        `Tipo de entidad inválido: "${value}". Usa CUSTOMER o RECEIVABLE.`,
      );
    }
    return upper as ExternalSyncEntityType;
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
