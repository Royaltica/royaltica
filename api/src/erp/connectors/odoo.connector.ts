import { BaseErpConnector } from './base-erp.connector';

/**
 * Adaptador para Odoo. Open source, API JSON-RPC/REST excelente. Para
 * clientes que adopten Odoo junto con Royáltica.
 */
export class OdooConnector extends BaseErpConnector {
  constructor(apiUrl: string, apiKey: string) {
    super('odoo', apiUrl, apiKey);
  }
}
