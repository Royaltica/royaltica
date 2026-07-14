import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.validation';

export interface DisburseInput {
  factorajeRequestId: string;
  supplierName: string;
  clabe: string | null;
  netAmount: number;
  concept: string;
}

export interface DisburseResult {
  /** Referencia de la dispersión en el sistema del proveedor externo. */
  providerRef: string;
  /** Modo en que se resolvió: 'live' (API real) o 'stub' (simulado). */
  mode: 'live' | 'stub';
}

/**
 * Adaptador hacia el proveedor EXTERNO de factoraje (la empresa que
 * dispersa el dinero al proveedor). Royáltica orquesta; no presta.
 *
 * Hoy corre en modo "stub": no hay API contratada, así que `disburse`
 * simula una dispersión exitosa y devuelve una referencia ficticia, de
 * modo que todo el flujo (solicitud → aprobación → dispersión) funcione
 * de extremo a extremo en desarrollo.
 *
 * Cuando exista la API real, basta con:
 *   1. Agregar FACTORAJE_API_URL / FACTORAJE_API_KEY al .env.
 *   2. Implementar la rama `isConfigured` dentro de `disburse()` (un solo
 *      método): hacer el POST al endpoint del proveedor y mapear su
 *      respuesta a { providerRef }. El resto del sistema no cambia.
 */
@Injectable()
export class FactorajeProviderService implements OnModuleInit {
  private readonly logger = new Logger(FactorajeProviderService.name);
  private apiUrl = '';
  private apiKey = '';

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    this.apiUrl = this.config.get('FACTORAJE_API_URL', { infer: true });
    this.apiKey = this.config.get('FACTORAJE_API_KEY', { infer: true });

    if (!this.isConfigured) {
      this.logger.warn(
        'Factoraje externo NO configurado (falta FACTORAJE_API_URL/KEY). Las dispersiones se simulan en modo stub.',
      );
    } else {
      this.logger.log('Proveedor de factoraje configurado (API externa).');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey);
  }

  /**
   * Dispersa el monto neto al proveedor. ÚNICO punto a implementar cuando
   * llegue la API real (ver nota de clase). Hoy simula éxito.
   */
  async disburse(input: DisburseInput): Promise<DisburseResult> {
    if (!this.isConfigured) {
      this.logger.debug(
        `[stub] Dispersión simulada de $${input.netAmount} a ${input.supplierName}.`,
      );
      return { providerRef: `STUB-${randomUUID()}`, mode: 'stub' };
    }

    // ── Implementación real (pendiente de credenciales) ──
    // const res = await fetch(`${this.apiUrl}/disbursements`, {
    //   method: 'POST',
    //   headers: {
    //     'content-type': 'application/json',
    //     authorization: `Bearer ${this.apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     reference: input.factorajeRequestId,
    //     beneficiary: input.supplierName,
    //     clabe: input.clabe,
    //     amount: input.netAmount,
    //     concept: input.concept,
    //   }),
    // });
    // if (!res.ok) throw new Error(`Proveedor de factoraje respondió ${res.status}`);
    // const data = (await res.json()) as { id: string };
    // return { providerRef: data.id, mode: 'live' };
    throw new Error('La integración real de factoraje aún no está implementada.');
  }
}
