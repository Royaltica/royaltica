/** Entidades soportadas por el mapeo de campos (espejo de ExternalSyncEntityType en Prisma). */
export type ExternalSyncEntityType = 'CUSTOMER' | 'RECEIVABLE';

export const EXTERNAL_SYNC_ENTITY_TYPES: ExternalSyncEntityType[] = [
  'CUSTOMER',
  'RECEIVABLE',
];

/** { campoRoyaltica: campoExterno }, ej. {"name":"CustomerName","rfc":"TaxId"}. */
export type FieldMapping = Record<string, string>;

/**
 * Mapeo identidad: usado cuando la organización aún no configuró un mapeo
 * propio (GET/PUT /external-data-sync/field-mapping/:entityType). Asume que
 * las columnas del CSV/JSON ya se llaman igual que los campos de Royáltica,
 * lo que cubre el caso más simple (exports "de fábrica") sin bloquear al
 * admin mientras confirma el nombre real de sus columnas.
 */
export const IDENTITY_MAPPING: Record<ExternalSyncEntityType, FieldMapping> = {
  CUSTOMER: {
    externalId: 'externalId',
    name: 'name',
    legalName: 'legalName',
    rfc: 'rfc',
    email: 'email',
    phone: 'phone',
    category: 'category',
  },
  RECEIVABLE: {
    externalId: 'externalId',
    customerExternalId: 'customerExternalId',
    folio: 'folio',
    total: 'total',
    subtotal: 'subtotal',
    iva: 'iva',
    currency: 'currency',
    date: 'date',
    dueDate: 'dueDate',
    description: 'description',
  },
};

/**
 * Campos mínimos por entidad. Deliberadamente genéricos (nada de RFC/CFDI
 * obligatorio): un cliente canadiense no tiene RFC, así que el mínimo real es
 * nombre + ID único del sistema externo + un medio de contacto.
 */
export const REQUIRED_FIELDS: Record<ExternalSyncEntityType, string[]> = {
  CUSTOMER: ['externalId', 'name'],
  RECEIVABLE: ['externalId', 'customerExternalId', 'total', 'dueDate'],
};

/** Al menos uno de estos campos debe venir con valor para un CUSTOMER. */
const CUSTOMER_CONTACT_FIELDS = ['email', 'phone'];

/**
 * Valida una fila YA MAPEADA (claves = campos Royáltica). Devuelve la lista
 * de errores; vacía = fila válida. No lanza: el llamador decide si salta la
 * fila o aborta, según el conector (siempre "salta" en nuestro caso, ver
 * ExternalSyncResult.errors).
 */
export function validateMappedRow(
  entityType: ExternalSyncEntityType,
  row: Record<string, string | undefined>,
): string[] {
  const errors: string[] = [];
  for (const field of REQUIRED_FIELDS[entityType]) {
    if (!row[field] || row[field]!.trim().length === 0) {
      errors.push(`Falta el campo requerido "${field}".`);
    }
  }
  if (
    entityType === 'CUSTOMER' &&
    !CUSTOMER_CONTACT_FIELDS.some((f) => row[f] && row[f]!.trim().length > 0)
  ) {
    errors.push('El cliente necesita al menos un medio de contacto (email o phone).');
  }
  return errors;
}

/** Aplica el mapeo a una fila cruda (claves = columnas del CSV/JSON externo). */
export function applyMapping(
  mapping: FieldMapping,
  rawRow: Record<string, unknown>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [royalticaField, externalField] of Object.entries(mapping)) {
    const raw = rawRow[externalField];
    out[royalticaField] =
      raw === null || raw === undefined ? undefined : String(raw).trim();
  }
  return out;
}
