// ─────────────────────────────────────────────────────────────────────────────
// SAT CFDI Verification Service (frontend)
// ─────────────────────────────────────────────────────────────────────────────
//
// Este servicio NO simula: es un proxy delgado al backend real.
//   Backend:  POST /sat/verify  →  SatService.verifyCfdi()
//   El backend consulta el servicio SOAP público y gratuito del SAT:
//   https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
//
// La ÚNICA fuente de verdad de mock vs. real es el flag del backend
// `SAT_VERIFY_MODE` (mock|live). El frontend solo refleja lo que responde
// el backend — no hay lógica de estatus duplicada aquí.
// ─────────────────────────────────────────────────────────────────────────────

import { api, type SatVerifyResponse } from './apiClient.ts';

export interface SATVerificationResult {
  uuid: string;
  estado: 'Vigente' | 'Cancelado' | 'No Encontrado';
  esCancelable: 'Cancelable sin aceptación' | 'Cancelable con aceptación' | 'No cancelable' | null;
  estatusCancelacion: string | null;
  fechaVerificacion: string;
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  /** Origen del dato: el backend real (`sat-ws`) o modo mock del backend. */
  source: 'mock' | 'sat-ws';
}

export interface CFDIVerificationInput {
  uuid: string;           // Folio fiscal del CFDI (UUID del nodo TimbreFiscalDigital)
  rfcEmisor: string;      // RFC del emisor (proveedor)
  rfcReceptor: string;    // RFC del receptor (tu empresa)
  total: number;          // Total del CFDI
}

/**
 * Verifica un CFDI ante el SAT a través del backend real.
 *
 * El backend degrada a `No Verificado` si el SAT no responde; aquí eso se
 * mapea a `No Encontrado` para el tipo público (que solo maneja los 3 estados
 * oficiales), pero nunca inventa un `Vigente` falso.
 */
export async function verifyCFDI(input: CFDIVerificationInput): Promise<SATVerificationResult> {
  const res: SatVerifyResponse = await api.verifyCfdi({
    cfdiUuid: input.uuid,
    rfcEmisor: input.rfcEmisor,
    rfcReceptor: input.rfcReceptor,
    total: input.total,
  });

  // El backend puede devolver 'No Verificado' (SAT no respondió). El tipo
  // público solo expone los 3 estados oficiales del SAT; 'No Verificado' se
  // trata como 'No Encontrado' a nivel de UI (discrepancia, no aprobación).
  const estado: SATVerificationResult['estado'] =
    res.status === 'Vigente' || res.status === 'Cancelado'
      ? res.status
      : 'No Encontrado';

  return {
    uuid: input.uuid,
    estado,
    esCancelable: res.esCancelable as SATVerificationResult['esCancelable'],
    estatusCancelacion: res.estatusCancelacion,
    fechaVerificacion: res.verifiedAt,
    rfcEmisor: input.rfcEmisor,
    rfcReceptor: input.rfcReceptor,
    total: input.total,
    source: res.mode === 'live' ? 'sat-ws' : 'mock',
  };
}

/**
 * Verifica varios CFDIs en serie (respeta el ritmo del servicio del SAT).
 * En volumen alto conviene mover el batch al backend con una cola.
 */
export async function batchVerifyCFDI(inputs: CFDIVerificationInput[]): Promise<SATVerificationResult[]> {
  const results: SATVerificationResult[] = [];
  for (const input of inputs) {
    results.push(await verifyCFDI(input));
  }
  return results;
}
