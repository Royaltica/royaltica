/** Resultado de una sincronización de entrada (ERP → Royáltica). */
export interface ErpSyncResult {
  provider: string;
  mode: 'live' | 'stub';
  imported: number;
  skipped: number;
  message: string;
}

/** Resultado de un envío de salida (Royáltica → ERP). */
export interface ErpPushResult {
  provider: string;
  mode: 'live' | 'stub';
  pushed: boolean;
  reference: string | null;
  message: string;
}

/**
 * Contrato genérico de un conector ERP del corporativo. Cada ERP soportado
 * (Aspel, Bind, Odoo) implementa esta interfaz con su propio adaptador.
 *
 * El lado del proveedor NO usa esto: en México el CFDI XML (timbrado por el
 * SAT) es el conector universal y ya se importa en /invoices/bulk. Esto es
 * exclusivamente para el ERP del cliente corporativo.
 */
export interface ErpConnector {
  /** Identificador del ERP (aspel|bind|odoo). */
  readonly provider: string;
  /** True solo si hay credenciales y la integración real está activa. */
  readonly isConfigured: boolean;

  /** Trae facturas/órdenes de compra del ERP a Royáltica. */
  syncInvoices(organizationId: string): Promise<ErpSyncResult>;
  /** Trae el catálogo de proveedores del ERP a Royáltica. */
  syncSuppliers(organizationId: string): Promise<ErpSyncResult>;
  /** Envía la conciliación de un pago de Royáltica al ERP. */
  pushPayment(
    organizationId: string,
    paymentId: string,
  ): Promise<ErpPushResult>;
}
