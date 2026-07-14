// ─────────────────────────────────────────────────────────────────────────────
// SAT CFDI Verification Service
// ─────────────────────────────────────────────────────────────────────────────
//
// PRODUCTION SWAP POINT:
// Replace `mockVerifyCFDI()` with a real call to:
//   POST https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
//   Body (SOAP): <Expresion>?re={rfcEmisor}&rr={rfcReceptor}&tt={total}&id={uuid}</Expresion>
//
// The SAT endpoint is FREE and returns:
//   - Estado: "Vigente" | "Cancelado" | "No Encontrado"
//   - EsCancelable: "Cancelable sin aceptación" | "Cancelable con aceptación" | "No cancelable"
//   - EstatusCancelacion: null | "En proceso" | "Cancelado sin aceptación" | etc.
//
// For high-volume production (>10K/day), switch to a PAC API:
//   Finkok, SW Sapiens, or Edicom (~$0.50 MXN/query)
// ─────────────────────────────────────────────────────────────────────────────

export interface SATVerificationResult {
  uuid: string;
  estado: 'Vigente' | 'Cancelado' | 'No Encontrado';
  esCancelable: 'Cancelable sin aceptación' | 'Cancelable con aceptación' | 'No cancelable' | null;
  estatusCancelacion: string | null;
  fechaVerificacion: string;
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  // Backend integration fields
  source: 'mock' | 'sat-ws' | 'pac-api';
  rawResponse?: string;
}

export interface CFDIVerificationInput {
  uuid: string;           // The CFDI's fiscal folio (UUID from TimbreFiscalDigital node)
  rfcEmisor: string;      // Provider's RFC (13 chars for persona moral, 12 for física)
  rfcReceptor: string;    // Your company's RFC
  total: number;          // Total amount on the CFDI
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK IMPLEMENTATION (deterministic — same UUID always returns same result)
// ─────────────────────────────────────────────────────────────────────────────

function mockVerifyCFDI(input: CFDIVerificationInput): SATVerificationResult {
  // Deterministic: use UUID to decide status (not random!)
  // UUIDs ending in 0-7 → Vigente, 8 → Cancelado, 9 → No Encontrado
  const lastChar = input.uuid.slice(-1).toLowerCase();
  const numericVal = parseInt(lastChar, 16); // 0-15

  let estado: SATVerificationResult['estado'] = 'Vigente';
  let esCancelable: SATVerificationResult['esCancelable'] = 'Cancelable con aceptación';
  let estatusCancelacion: string | null = null;

  if (numericVal >= 14) {
    // ~12.5% chance: Not found
    estado = 'No Encontrado';
    esCancelable = null;
  } else if (numericVal >= 12) {
    // ~12.5% chance: Cancelled
    estado = 'Cancelado';
    esCancelable = 'No cancelable';
    estatusCancelacion = 'Cancelado sin aceptación';
  } else {
    // ~75% chance: Active/Vigente
    estado = 'Vigente';
    esCancelable = numericVal < 4 ? 'Cancelable sin aceptación' : 'Cancelable con aceptación';
  }

  return {
    uuid: input.uuid,
    estado,
    esCancelable,
    estatusCancelacion,
    fechaVerificacion: new Date().toISOString(),
    rfcEmisor: input.rfcEmisor,
    rfcReceptor: input.rfcReceptor,
    total: input.total,
    source: 'mock',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a CFDI against the SAT.
 *
 * PRODUCTION: Replace the body of this function with a fetch to your backend:
 *   const res = await fetch('/api/sat/verify', { method: 'POST', body: JSON.stringify(input) });
 *   return res.json();
 *
 * The backend should call the SAT SOAP endpoint and return a SATVerificationResult.
 */
export async function verifyCFDI(input: CFDIVerificationInput): Promise<SATVerificationResult> {
  // ┌──────────────────────────────────────────────┐
  // │  SWAP THIS BLOCK FOR PRODUCTION              │
  // │                                              │
  // │  const res = await fetch('/api/sat/verify', { │
  // │    method: 'POST',                           │
  // │    headers: { 'Content-Type': 'application/json' }, │
  // │    body: JSON.stringify(input),               │
  // │  });                                         │
  // │  if (!res.ok) throw new Error('SAT verify failed'); │
  // │  return res.json();                           │
  // └──────────────────────────────────────────────┘

  // Simulate network delay (200-600ms like real SAT WS)
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
  return mockVerifyCFDI(input);
}

/**
 * Batch verify multiple CFDIs.
 * In production, your backend should batch these into a single request queue
 * to respect SAT's rate limits (~100 req/min).
 */
export async function batchVerifyCFDI(inputs: CFDIVerificationInput[]): Promise<SATVerificationResult[]> {
  const results: SATVerificationResult[] = [];
  for (const input of inputs) {
    const result = await verifyCFDI(input);
    results.push(result);
    // Small delay between calls to respect rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return results;
}
