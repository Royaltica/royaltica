import { Logger } from '@nestjs/common';
import type {
  ErpConnector,
  ErpPushResult,
  ErpSyncResult,
} from '../erp-connector.interface';

/**
 * Base de los adaptadores ERP. Implementa el comportamiento en modo "stub":
 * mientras no haya credenciales (ERP_API_URL/KEY), cada operación responde
 * sin tocar ninguna API real y deja claro que está en modo simulado.
 *
 * Cuando exista la API de un ERP concreto, su subclase sobreescribe los
 * métodos `*Live()` (no toda la lógica). El despacho stub/live ya está aquí.
 */
export abstract class BaseErpConnector implements ErpConnector {
  protected readonly logger: Logger;

  constructor(
    public readonly provider: string,
    protected readonly apiUrl: string,
    protected readonly apiKey: string,
  ) {
    this.logger = new Logger(`Erp:${provider}`);
  }

  get isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  }

  async syncInvoices(organizationId: string): Promise<ErpSyncResult> {
    if (!this.isConfigured) return this.stubSync('facturas');
    return this.syncInvoicesLive(organizationId);
  }

  async syncSuppliers(organizationId: string): Promise<ErpSyncResult> {
    if (!this.isConfigured) return this.stubSync('proveedores');
    return this.syncSuppliersLive(organizationId);
  }

  async pushPayment(
    organizationId: string,
    paymentId: string,
  ): Promise<ErpPushResult> {
    if (!this.isConfigured) {
      return {
        provider: this.provider,
        mode: 'stub',
        pushed: false,
        reference: null,
        message: `Conector ${this.provider} en modo stub: no se envió el pago ${paymentId}. Configura ERP_API_URL/ERP_API_KEY para activarlo.`,
      };
    }
    return this.pushPaymentLive(organizationId, paymentId);
  }

  // ── A implementar por cada ERP cuando exista su API ──────────
  protected syncInvoicesLive(_organizationId: string): Promise<ErpSyncResult> {
    return Promise.reject(
      new Error(`syncInvoices real no implementado para ${this.provider}.`),
    );
  }
  protected syncSuppliersLive(_organizationId: string): Promise<ErpSyncResult> {
    return Promise.reject(
      new Error(`syncSuppliers real no implementado para ${this.provider}.`),
    );
  }
  protected pushPaymentLive(
    _organizationId: string,
    _paymentId: string,
  ): Promise<ErpPushResult> {
    return Promise.reject(
      new Error(`pushPayment real no implementado para ${this.provider}.`),
    );
  }

  private stubSync(entity: string): ErpSyncResult {
    this.logger.debug(`[stub] sync de ${entity} simulado (${this.provider}).`);
    return {
      provider: this.provider,
      mode: 'stub',
      imported: 0,
      skipped: 0,
      message: `Conector ${this.provider} en modo stub: no se importaron ${entity}. Configura ERP_API_URL/ERP_API_KEY para activarlo.`,
    };
  }
}
