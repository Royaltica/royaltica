import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

export interface SpeiOrderResult {
  success: boolean;
  mode: 'live' | 'sandbox' | 'stub';
  claveRastreo?: string;
  referencia?: string;
  error?: string;
}

export interface SpeiOrderInput {
  clabeDestino: string;
  nombreBeneficiario: string;
  rfcBeneficiario?: string;
  monto: number;
  concepto: string;
  referenciaNumerica: number;
}

export interface SpeiStatusResult {
  status: 'PENDING' | 'LIQUIDATED' | 'RETURNED' | 'CANCELLED' | 'UNKNOWN';
  claveRastreo: string;
  timestamp?: string;
  mode: 'live' | 'sandbox' | 'stub';
}

@Injectable()
export class SpeiService implements OnModuleInit {
  private readonly logger = new Logger(SpeiService.name);
  private provider: 'conekta' | 'stp' = 'conekta';
  private apiKey = '';
  private apiUrl = '';
  private clabeCuenta = '';

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.provider = (this.config.get('SPEI_PROVIDER', { infer: true }) || 'conekta') as 'conekta' | 'stp';
    this.apiKey = this.config.get('SPEI_API_KEY', { infer: true }) || '';
    this.apiUrl = this.config.get('SPEI_API_URL', { infer: true }) || '';
    this.clabeCuenta = this.config.get('SPEI_CLABE_ORIGEN', { infer: true }) || '';
    if (!this.isConfigured) {
      this.logger.warn('SPEI NO configurado. Transferencias en modo stub.');
      return;
    }
    this.logger.log(`SPEI inicializado (${this.provider}).`);
  }

  get isConfigured(): boolean { return Boolean(this.apiKey && this.clabeCuenta); }

  async order(input: SpeiOrderInput): Promise<SpeiOrderResult> {
    this.validateClabe(input.clabeDestino);
    if (!this.isConfigured) {
      const claveRastreo = this.generateClaveRastreo();
      this.logger.debug(`[stub] SPEI $${input.monto} -> ${input.clabeDestino}`);
      return { success: true, mode: 'stub', claveRastreo, referencia: String(input.referenciaNumerica) };
    }
    try {
      return this.provider === 'conekta' ? await this.orderViaConekta(input) : await this.orderViaStp(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error SPEI';
      this.logger.error(`SPEI order failed: ${message}`);
      return { success: false, mode: this.apiUrl?.includes('sandbox') ? 'sandbox' : 'live', error: message };
    }
  }

  async getStatus(claveRastreo: string): Promise<SpeiStatusResult> {
    if (!this.isConfigured) return { status: 'LIQUIDATED', claveRastreo, mode: 'stub', timestamp: new Date().toISOString() };
    try {
      return this.provider === 'conekta' ? await this.getStatusViaConekta(claveRastreo) : await this.getStatusViaStp(claveRastreo);
    } catch { return { status: 'UNKNOWN', claveRastreo, mode: 'live' }; }
  }

  private async orderViaConekta(input: SpeiOrderInput): Promise<SpeiOrderResult> {
    const url = `${this.apiUrl || 'https://api.conekta.io'}/transfers`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/vnd.conekta-v2.2.0+json' },
      body: JSON.stringify({ amount: Math.round(input.monto * 100), currency: 'MXN', method: 'spei', destination: { clabe: input.clabeDestino, name: input.nombreBeneficiario }, reference: String(input.referenciaNumerica), description: input.concepto.slice(0, 40) }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Conekta SPEI error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { id: string; tracking_code?: string };
    return { success: true, mode: 'live', claveRastreo: data.tracking_code || data.id, referencia: String(input.referenciaNumerica) };
  }

  private async getStatusViaConekta(claveRastreo: string): Promise<SpeiStatusResult> {
    const url = `${this.apiUrl || 'https://api.conekta.io'}/transfers/${claveRastreo}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/vnd.conekta-v2.2.0+json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Conekta status failed: ${res.status}`);
    const data = (await res.json()) as { status: string; tracking_code: string; created_at: number };
    const map: Record<string, SpeiStatusResult['status']> = { pending: 'PENDING', paid_out: 'LIQUIDATED', expired: 'CANCELLED', refunded: 'RETURNED' };
    return { status: map[data.status] || 'UNKNOWN', claveRastreo: data.tracking_code, timestamp: new Date(data.created_at * 1000).toISOString(), mode: 'live' };
  }

  private async orderViaStp(_input: SpeiOrderInput): Promise<SpeiOrderResult> { throw new Error('STP directo no implementado. Usa conekta.'); }
  private async getStatusViaStp(_cr: string): Promise<SpeiStatusResult> { throw new Error('STP status no implementado.'); }

  private validateClabe(clabe: string): void {
    if (!/^\d{18}$/.test(clabe)) throw new Error(`CLABE invalida: ${clabe}`);
    const w = [3,7,1,3,7,1,3,7,1,3,7,1,3,7,1,3,7];
    const d = clabe.split('').map(Number);
    const sum = w.reduce((a,v,i) => a + ((d[i]*v)%10), 0);
    const exp = (10 - (sum%10))%10;
    if (d[17] !== exp) throw new Error(`CLABE: digito verificador incorrecto (esperado ${exp}, recibido ${d[17]})`);
  }

  private generateClaveRastreo(): string {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return 'RYL' + Array.from({length:8}, () => c.charAt(Math.floor(Math.random()*c.length))).join('');
  }
}
