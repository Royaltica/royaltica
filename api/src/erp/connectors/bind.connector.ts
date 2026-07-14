import { BaseErpConnector } from './base-erp.connector';

/**
 * Adaptador para Bind ERP. API REST moderna, mexicano, sin conflicto con la
 * alianza Aspel–Xepelin. Buen candidato como primer ERP por calidad de API.
 */
export class BindErpConnector extends BaseErpConnector {
  constructor(apiUrl: string, apiKey: string) {
    super('bind', apiUrl, apiKey);
  }
}
