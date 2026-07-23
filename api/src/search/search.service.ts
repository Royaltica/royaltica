import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

/**
 * Índices Meilisearch usados por Royáltica.
 * Añadir aquí cualquier índice nuevo (facturas, movimientos SPEI, etc.).
 */
export type SearchIndex = 'suppliers' | 'invoices' | 'customers';

export interface SearchOptions {
  /** Filtros al estilo Meilisearch (p. ej. `isApproved = true`). */
  filter?: string | string[];
  /** Página basada en offset+limit. */
  limit?: number;
  offset?: number;
  /** Atributos por los que ordenar (p. ej. `['score:desc']`). */
  sort?: string[];
}

export interface SearchResult<T = Record<string, unknown>> {
  hits: T[];
  total: number;
  processingTimeMs: number;
}

/**
 * Cliente de Meilisearch para búsqueda full-text de proveedores, facturas
 * y clientes. Se conecta a un servicio Meilisearch (recomendado corriendo
 * como plugin de Railway, template "Meilisearch") vía MEILI_HOST +
 * MEILI_MASTER_KEY.
 *
 * Si MEILI_HOST no está configurado, el servicio corre en modo stub:
 * `isConfigured` es false y todas las operaciones son no-ops. El resto
 * del código puede llamar `indexDocument`/`removeDocument` sin miedo.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: import('meilisearch').MeiliSearch | null = null;

  constructor(private readonly config: ConfigService<Env, true>) {}

  async onModuleInit(): Promise<void> {
    const host = this.config.get('MEILI_HOST', { infer: true });
    const apiKey = this.config.get('MEILI_MASTER_KEY', { infer: true });

    if (!host) {
      this.logger.warn(
        'Meilisearch NO configurado (falta MEILI_HOST). Búsqueda en modo stub.',
      );
      return;
    }

    try {
      const { MeiliSearch } = await import('meilisearch');
      this.client = new MeiliSearch({ host, apiKey: apiKey || undefined });
      // Asegurar índices y sus configuraciones (fire-and-forget).
      void this.ensureIndex('suppliers', {
        searchableAttributes: [
          'name',
          'legalName',
          'rfc',
          'contact',
          'category',
          'activity',
        ],
        filterableAttributes: [
          'organizationId',
          'isApproved',
          'category',
          'sat69bListed',
        ],
        sortableAttributes: ['score', 'seniorityYears', 'createdAt'],
      });
      void this.ensureIndex('invoices', {
        searchableAttributes: [
          'folio',
          'uuid',
          'supplierName',
          'concept',
        ],
        filterableAttributes: [
          'organizationId',
          'status',
          'direction',
          'supplierId',
        ],
        sortableAttributes: ['total', 'issueDate', 'dueDate'],
      });
      void this.ensureIndex('customers', {
        searchableAttributes: ['name', 'legalName', 'rfc', 'email'],
        filterableAttributes: ['organizationId'],
      });
      this.logger.log(`Meilisearch inicializado (host: ${host}).`);
    } catch (err) {
      this.logger.warn(
        `No se pudo inicializar Meilisearch: ${(err as Error).message}`,
      );
      this.client = null;
    }
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  private async ensureIndex(
    uid: SearchIndex,
    settings: {
      searchableAttributes?: string[];
      filterableAttributes?: string[];
      sortableAttributes?: string[];
    },
  ): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.createIndex(uid, { primaryKey: 'id' }).catch(() => {
        /* ya existía */
      });
      await this.client.index(uid).updateSettings(settings);
    } catch (err) {
      this.logger.warn(
        `No se pudo asegurar índice ${uid}: ${(err as Error).message}`,
      );
    }
  }

  /** Indexa/actualiza un documento. No-op si Meili no está configurado. */
  async indexDocument(
    index: SearchIndex,
    doc: Record<string, unknown> & { id: string },
  ): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.index(index).addDocuments([doc]);
    } catch (err) {
      this.logger.warn(
        `Fallo indexando ${index}#${doc.id}: ${(err as Error).message}`,
      );
    }
  }

  /** Indexa un batch (más eficiente que uno por uno). */
  async indexBatch(
    index: SearchIndex,
    docs: Array<Record<string, unknown> & { id: string }>,
  ): Promise<void> {
    if (!this.client || docs.length === 0) return;
    try {
      await this.client.index(index).addDocuments(docs);
    } catch (err) {
      this.logger.warn(
        `Fallo indexando batch ${index}(${docs.length}): ${(err as Error).message}`,
      );
    }
  }

  async removeDocument(index: SearchIndex, id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.index(index).deleteDocument(id);
    } catch (err) {
      this.logger.warn(
        `Fallo eliminando ${index}#${id}: ${(err as Error).message}`,
      );
    }
  }

  async search<T = Record<string, unknown>>(
    index: SearchIndex,
    query: string,
    opts: SearchOptions = {},
  ): Promise<SearchResult<T>> {
    if (!this.client) {
      return { hits: [], total: 0, processingTimeMs: 0 };
    }
    const res = await this.client.index(index).search(query, {
      filter: opts.filter,
      limit: opts.limit ?? 20,
      offset: opts.offset ?? 0,
      sort: opts.sort,
    });
    return {
      hits: (res.hits as T[]) ?? [],
      total: res.estimatedTotalHits ?? 0,
      processingTimeMs: res.processingTimeMs ?? 0,
    };
  }
}
