import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  ExternalDataConnector,
  ExternalSyncResult,
} from '../external-connector.interface';
import { parseCsv } from '../csv-parser.util';
import {
  applyMapping,
  validateMappedRow,
  type FieldMapping,
} from '../field-mapping.types';
import { syntheticCfdiUuid, syntheticRfc } from '../synthetic-ids.util';

/**
 * Conector genérico por archivo CSV/Excel-exportado-a-CSV. Funciona con
 * CUALQUIER sistema de origen (mínimo común denominador): el usuario
 * exporta un reporte de su sistema ("Soga" o el que sea) y lo sube. El
 * mapeo de columnas → campos de Royáltica lo resuelve FieldMappingService
 * antes de construir este conector (ver ExternalDataSyncService).
 *
 * Idempotente: usa `externalId` (columna mapeada por el admin) como llave de
 * upsert, así que reimportar el mismo archivo actualiza en vez de duplicar.
 */
export class GenericCsvConnector implements ExternalDataConnector {
  readonly provider = 'generic-csv';
  private readonly logger = new Logger('ExternalSync:generic-csv');

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileBuffer: Buffer | undefined,
    private readonly customerMapping: FieldMapping,
    private readonly receivableMapping: FieldMapping,
  ) {}

  /** Solo "configurado" si hay un archivo que procesar en esta invocación. */
  get isConfigured(): boolean {
    return Boolean(this.fileBuffer && this.fileBuffer.length > 0);
  }

  async syncCustomers(organizationId: string): Promise<ExternalSyncResult> {
    if (!this.isConfigured) return this.stub('clientes');

    const { rows } = parseCsv(this.fileBuffer!);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2; // +1 por header, +1 porque las filas humanas empiezan en 1
      const mapped = applyMapping(this.customerMapping, rows[i]);
      const rowErrors = validateMappedRow('CUSTOMER', mapped);
      if (rowErrors.length > 0) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: ${rowErrors.join(' ')}`);
        continue;
      }

      try {
        await this.upsertCustomer(organizationId, mapped);
        imported += 1;
      } catch (err) {
        skipped += 1;
        errors.push(
          `Fila ${rowNumber}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      provider: this.provider,
      mode: 'live',
      imported,
      skipped,
      errors,
      message: `Importación de clientes: ${imported} importados, ${skipped} con error de ${rows.length} filas.`,
    };
  }

  async syncReceivables(organizationId: string): Promise<ExternalSyncResult> {
    if (!this.isConfigured) return this.stub('facturas de venta');

    const { rows } = parseCsv(this.fileBuffer!);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const mapped = applyMapping(this.receivableMapping, rows[i]);
      const rowErrors = validateMappedRow('RECEIVABLE', mapped);
      if (rowErrors.length > 0) {
        skipped += 1;
        errors.push(`Fila ${rowNumber}: ${rowErrors.join(' ')}`);
        continue;
      }

      try {
        await this.upsertReceivable(organizationId, mapped);
        imported += 1;
      } catch (err) {
        skipped += 1;
        errors.push(
          `Fila ${rowNumber}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      provider: this.provider,
      mode: 'live',
      imported,
      skipped,
      errors,
      message: `Importación de facturas de venta: ${imported} importadas, ${skipped} con error de ${rows.length} filas.`,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  private async upsertCustomer(
    organizationId: string,
    row: Record<string, string | undefined>,
  ): Promise<void> {
    const externalId = row.externalId!;
    const name = row.name!;

    await this.prisma.withOrg(organizationId, async (tx) => {
      const existing = await tx.customer.findFirst({
        where: { organizationId, externalId },
        select: { id: true },
      });

      const data = {
        name,
        legalName: row.legalName || name,
        rfc: row.rfc || syntheticRfc(`${organizationId}:generic-csv:${externalId}`),
        email: row.email || null,
        phone: row.phone || null,
        category: row.category || null,
      };

      if (existing) {
        await tx.customer.update({ where: { id: existing.id }, data });
      } else {
        await tx.customer.create({
          data: { organizationId, externalId, ...data },
        });
      }
    });
  }

  private async upsertReceivable(
    organizationId: string,
    row: Record<string, string | undefined>,
  ): Promise<void> {
    const externalId = row.externalId!;
    const customerExternalId = row.customerExternalId!;
    const total = this.assertMoney(row.total!, 'total');
    const dueDate = this.assertDate(row.dueDate!, 'dueDate');
    const date = row.date ? this.assertDate(row.date, 'date') : new Date();
    const subtotal = row.subtotal ? this.assertMoney(row.subtotal, 'subtotal') : total;
    const iva = row.iva ? this.assertMoney(row.iva, 'iva') : 0;

    await this.prisma.withOrg(organizationId, async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { organizationId, externalId: customerExternalId },
        select: { id: true, rfc: true },
      });
      if (!customer) {
        throw new Error(
          `Cliente externo "${customerExternalId}" no encontrado. Importa primero el catálogo de clientes.`,
        );
      }

      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { rfc: true },
      });

      const existing = await tx.invoice.findFirst({
        where: { organizationId, externalId, direction: 'RECEIVABLE' },
        select: { id: true },
      });

      const data = {
        customerId: customer.id,
        folio: row.folio || null,
        total,
        subtotal,
        iva,
        currency: row.currency || 'CAD',
        date,
        dueDate,
        description: row.description || null,
      };

      if (existing) {
        await tx.invoice.update({ where: { id: existing.id }, data });
      } else {
        await tx.invoice.create({
          data: {
            organizationId,
            externalId,
            direction: 'RECEIVABLE',
            cfdiUuid: syntheticCfdiUuid(`${organizationId}:generic-csv:${externalId}`),
            rfcEmisor: org?.rfc ?? syntheticRfc(`${organizationId}:emisor`),
            rfcReceptor: customer.rfc,
            ...data,
          },
        });
      }
    });
  }

  private assertMoney(raw: string, field: string): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`El campo "${field}" no es un monto válido ("${raw}").`);
    }
    return n;
  }

  private assertDate(raw: string, field: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new Error(`El campo "${field}" no es una fecha válida ("${raw}").`);
    }
    return d;
  }

  private stub(entity: string): ExternalSyncResult {
    this.logger.debug(`[stub] sync de ${entity} sin archivo cargado.`);
    return {
      provider: this.provider,
      mode: 'stub',
      imported: 0,
      skipped: 0,
      errors: [],
      message: `Conector ${this.provider} en modo stub: no se subió ningún archivo para importar ${entity}.`,
    };
  }
}
