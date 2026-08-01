/**
 * Resultado de una sincronización de entrada (sistema externo → Royáltica).
 * A diferencia de ErpSyncResult (erp/erp-connector.interface.ts), acá SIEMPRE
 * hay `errors`: los datos de un CSV/API de un tercero llegan sucios y una fila
 * mala no debe tumbar el resto del lote (éxito parcial es lo normal).
 */
export interface ExternalSyncResult {
  provider: string;
  mode: 'live' | 'stub';
  imported: number;
  skipped: number;
  errors: string[];
  message: string;
}

/**
 * Contrato genérico de un conector de datos externos para el lado de
 * cobranza (CxC): trae el catálogo de clientes y las facturas de venta de un
 * sistema de terceros (Tradespace lo llamó informalmente "Soga" en la
 * llamada de requerimientos; aún no se confirma qué producto es ni si tiene
 * API). Espejo intencional de erp/erp-connector.interface.ts (ErpConnector),
 * pero para CxC en vez de CxP: NO reemplaza ni depende de ese módulo.
 *
 * Implementaciones actuales:
 * - GenericCsvConnector: sube un archivo CSV/Excel exportado a mano. Funciona
 *   con CUALQUIER sistema (mínimo común denominador) y no requiere que
 *   Tradespace confirme nada.
 * - GenericRestConnector: shape listo para una API REST configurable
 *   (baseUrl + header de auth + rutas). Hoy es un esqueleto en modo stub: se
 *   activa cuando Tradespace confirme endpoints/paginación/autenticación.
 */
export interface ExternalDataConnector {
  /** Identificador del conector (generic-csv|generic-rest|...). */
  readonly provider: string;
  /** True solo si el conector tiene lo mínimo para operar en modo real. */
  readonly isConfigured: boolean;

  /** Importa/actualiza el catálogo de clientes de la organización. */
  syncCustomers(organizationId: string): Promise<ExternalSyncResult>;
  /** Importa/actualiza facturas de venta (Invoice.direction=RECEIVABLE). */
  syncReceivables(organizationId: string): Promise<ExternalSyncResult>;
}
