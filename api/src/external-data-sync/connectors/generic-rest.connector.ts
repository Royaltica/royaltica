import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type {
  ExternalDataConnector,
  ExternalSyncResult,
} from '../external-connector.interface';
import {
  applyMapping,
  validateMappedRow,
  type FieldMapping,
} from '../field-mapping.types';
import { syntheticCfdiUuid, syntheticRfc } from '../synthetic-ids.util';

export interface GenericRestConfig {
  baseUrl: string | null;
  /** Header de auth ya armado (ej. "Bearer xxx"), ver SettingsService.externalSyncRestAuthHeader. */
  authHeader: string | null;
  // TODO(Tradespace): confirmar las rutas reales una vez que se identifique
  // el sistema ("Soga") y se sepa si expone REST. Por ahora son defaults
  // razonables/adivinados, NO validados contra ninguna API real.
  customersPath?: string;
  receivablesPath?: string;
}

/**
 * Conector REST configurable — ESQUELETO listo para activarse en cuanto
 * Tradespace confirme los detalles de su sistema. Hoy no hay ninguna
 * confirmación de:
 *   - Qué producto es realmente ("Soga" nunca se confirmó: ¿Zoho? ¿Sage?
 *     ¿otro?).
 *   - Si expone REST en absoluto (podría ser solo exportación CSV/Excel, en
 *     cuyo caso el camino real es GenericCsvConnector, no este).
 *   - El shape de auth (API key vs Bearer vs OAuth), paginación
 *     (offset/cursor/page), y los endpoints exactos.
 *
 * Mientras tanto: `isConfigured` es false si falta baseUrl o authHeader, así
 * que este conector jamás intenta una llamada real sin que un admin haya
 * llenado Configuración → Sincronización externa con datos reales. El mapeo
 * de campos se aplica igual que en GenericCsvConnector (misma fuente de
 * verdad: FieldMappingService), así que activar REST más adelante NO
 * requiere tocar la lógica de negocio, solo reemplazar `fetchJson` por la
 * llamada HTTP real y ajustar las rutas/paginación según lo que confirme
 * Tradespace.
 */
export class GenericRestConnector implements ExternalDataConnector {
  readonly provider = 'generic-rest';
  private readonly logger = new Logger('ExternalSync:generic-rest');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: GenericRestConfig,
    private readonly customerMapping: FieldMapping,
    private readonly receivableMapping: FieldMapping,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.config.baseUrl && this.config.authHeader);
  }

  async syncCustomers(organizationId: string): Promise<ExternalSyncResult> {
    if (!this.isConfigured) return this.stub('clientes');

    // TODO(Tradespace): reemplazar por la ruta/paginación reales.
    const path = this.config.customersPath ?? '/customers';
    const records = await this.fetchAllPages(path);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += 1) {
      const mapped = applyMapping(this.customerMapping, records[i]);
      const rowErrors = validateMappedRow('CUSTOMER', mapped);
      if (rowErrors.length > 0) {
        skipped += 1;
        errors.push(`Registro ${i + 1}: ${rowErrors.join(' ')}`);
        continue;
      }
      try {
        await this.upsertCustomer(organizationId, mapped);
        imported += 1;
      } catch (err) {
        skipped += 1;
        errors.push(
          `Registro ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      provider: this.provider,
      mode: 'live',
      imported,
      skipped,
      errors,
      message: `Importación de clientes vía REST: ${imported} importados, ${skipped} con error de ${records.length} registros.`,
    };
  }

  async syncReceivables(organizationId: string): Promise<ExternalSyncResult> {
    if (!this.isConfigured) return this.stub('facturas de venta');

    // TODO(Tradespace): reemplazar por la ruta/paginación reales.
    const path = this.config.receivablesPath ?? '/invoices';
    const records = await this.fetchAllPages(path);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += 1) {
      const mapped = applyMapping(this.receivableMapping, records[i]);
      const rowErrors = validateMappedRow('RECEIVABLE', mapped);
      if (rowErrors.length > 0) {
        skipped += 1;
        errors.push(`Registro ${i + 1}: ${rowErrors.join(' ')}`);
        continue;
      }
      try {
        await this.upsertReceivable(organizationId, mapped);
        imported += 1;
      } catch (err) {
        skipped += 1;
        errors.push(
          `Registro ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      provider: this.provider,
      mode: 'live',
      imported,
      skipped,
      errors,
      message: `Importación de facturas de venta vía REST: ${imported} importadas, ${skipped} con error de ${records.length} registros.`,
    };
  }

  // ── helpers ───────────────────────────────────────────────

  /**
   * TODO(Tradespace): esta implementación asume UNA sola página con GET
   * simple. En cuanto se confirme el mecanismo real de paginación
   * (offset/limit, cursor, `?page=`, Link header, etc.) esto debe iterar
   * hasta agotar las páginas. Se deja como método propio (en vez de inline)
   * para que ese cambio quede aislado a un solo lugar.
   */
  private async fetchAllPages(
    path: string,
  ): Promise<Record<string, unknown>[]> {
    const url = `${this.config.baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        headers: {
          // TODO(Tradespace): confirmar si el header real es Authorization,
          // X-Api-Key, o algo custom. Hoy se manda tal cual como Authorization.
          Authorization: this.config.authHeader ?? '',
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} consultando ${url}.`);
      }
      const body: unknown = await res.json();
      // TODO(Tradespace): confirmar el shape real de la respuesta (¿array
      // plano? ¿{ data: [...] }? ¿{ items: [...], nextPage }?).
      if (Array.isArray(body)) return body as Record<string, unknown>[];
      if (body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)) {
        return (body as { data: Record<string, unknown>[] }).data;
      }
      return [];
    } catch (err) {
      this.logger.warn(
        `Falló la consulta a ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

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
        rfc:
          row.rfc || syntheticRfc(`${organizationId}:generic-rest:${externalId}`),
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
    const subtotal = row.subtotal
      ? this.assertMoney(row.subtotal, 'subtotal')
      : total;
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
            cfdiUuid: syntheticCfdiUuid(
              `${organizationId}:generic-rest:${externalId}`,
            ),
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
    this.logger.debug(`[stub] sync de ${entity} sin conector REST configurado.`);
    return {
      provider: this.provider,
      mode: 'stub',
      imported: 0,
      skipped: 0,
      errors: [],
      message: `Conector ${this.provider} en modo stub: configura baseUrl y el header de autenticación en Configuración → Sincronización externa para activarlo.`,
    };
  }
}
