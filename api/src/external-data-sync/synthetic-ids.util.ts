import { createHash } from 'node:crypto';

/**
 * El esquema de Invoice/Customer nació 100% para México: `Customer.rfc` es
 * NOT NULL/único por org y `Invoice.cfdiUuid` es NOT NULL/único GLOBAL (es el
 * identificador legal del CFDI timbrado por el SAT). Un cliente canadiense
 * (Tradespace) no tiene RFC ni CFDI: para no reabrir ese modelo compartido con
 * CxP en esta primera fundación, generamos valores SINTÉTICOS deterministas
 * (mismo seed ⇒ mismo valor, así los reimportes no rompen la unicidad) que
 * cumplen el FORMATO esperado pero NO son identificadores fiscales reales.
 * Quedan claramente marcados en el folio/descripción de origen para que nadie
 * los confunda con un RFC/UUID de CFDI legítimo.
 */

const hex = (seed: string) => createHash('sha1').update(seed).digest('hex');

/**
 * RFC sintético válido en formato (3 letras + 6 dígitos + 3 alfanumérico,
 * como espera CFDI_UUID_REGEX/RFC_REGEX en el resto de la app) pero NO
 * fiscal. Determinista por seed (ej. `${organizationId}:${provider}:${externalId}`).
 */
export function syntheticRfc(seed: string): string {
  const h = hex(seed);
  const digits = (parseInt(h.slice(0, 8), 16) % 1_000_000)
    .toString()
    .padStart(6, '0');
  const suffix = h.slice(8, 11).toUpperCase();
  return `XAX${digits}${suffix}`;
}

/** UUID-shape sintético (8-4-4-4-12 hex) para Invoice.cfdiUuid. Determinista por seed. */
export function syntheticCfdiUuid(seed: string): string {
  const h = hex(seed + ':cfdi');
  const h2 = createHash('sha1').update(`${seed}:cfdi2`).digest('hex');
  const full = (h + h2).slice(0, 32);
  return [
    full.slice(0, 8),
    full.slice(8, 12),
    full.slice(12, 16),
    full.slice(16, 20),
    full.slice(20, 32),
  ].join('-');
}
