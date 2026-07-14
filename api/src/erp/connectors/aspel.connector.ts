import { BaseErpConnector } from './base-erp.connector';

/**
 * Adaptador para Aspel (SAE/COI). API histórica, vía ODBC/REST limitada —
 * la integración real es más laboriosa que ERPs modernos.
 *
 * Nota de negocio: la alianza Aspel–Xepelin afecta el factoraje dentro de
 * Aspel, NO la lectura de datos vía API. Sincronizar facturas/proveedores/
 * pagos sigue siendo válido.
 */
export class AspelConnector extends BaseErpConnector {
  constructor(apiUrl: string, apiKey: string) {
    super('aspel', apiUrl, apiKey);
  }
}
