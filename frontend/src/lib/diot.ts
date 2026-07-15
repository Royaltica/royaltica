import type { DiotEntryApi, DiotApiResult } from '../services/apiClient.ts';

// ─── DIOT Compiler Types (Plantilla SAT 2025) ────────────────────────────────
export interface DiotRow {
  id: string;
  tipo_tercero: '04' | '05' | '15'; // Nacional, Extranjero, Global
  tipo_operacion: '02' | '03' | '06' | '07' | '08' | '85' | '87';
  rfc: string;
  num_id_fiscal?: string;
  nombre_extranjero?: string;
  pais_residencia?: string;
  lugar_jurisdiccion?: string;
  // Valor actos/actividades (campos 8-17)
  valor_frontera_norte: number;
  dev_frontera_norte: number;
  valor_frontera_sur: number;
  dev_frontera_sur: number;
  valor_16: number;
  dev_16: number;
  valor_imp_tangibles_16: number;
  dev_imp_tangibles_16: number;
  valor_imp_intangibles_16: number;
  dev_imp_intangibles_16: number;
  // IVA acreditable (campos 18-27)
  iva_acred_frontera_norte: number;
  iva_acred_prop_frontera_norte: number;
  iva_acred_frontera_sur: number;
  iva_acred_prop_frontera_sur: number;
  iva_acred_16: number;
  iva_acred_prop_16: number;
  iva_acred_imp_tang_16: number;
  iva_acred_prop_imp_tang_16: number;
  iva_acred_imp_intang_16: number;
  iva_acred_prop_imp_intang_16: number;
  // IVA no acreditable (campos 28-46 simplified — 4 groups x 4 fields + 4 extra)
  iva_no_acred: number[];  // 19 values for campos 28-46
  // Campos finales (47-53)
  iva_retenido: number;
  valor_exento_importacion: number;
  valor_exento: number;
  valor_tasa_0: number;
  valor_no_objeto_nacional: number;
  valor_no_objeto_sin_establecimiento: number;
  manifiesto: '01' | '02';
  // Display helpers
  provider_name: string;
}

export interface DiotReport {
  id: string;
  period: string; // "2024-03"
  status: 'draft' | 'generated' | 'submitted';
  generated_date?: string;
  total_providers: number;
  total_base_16: number;
  total_iva_acred: number;
  total_iva_retenido: number;
  rows: DiotRow[];
}

// Helper to build pipe-separated TXT line from DiotRow (54 fields, SAT format)
export function diotRowToTxt(row: DiotRow): string {
  const f = [
    row.tipo_tercero,
    row.tipo_operacion,
    row.rfc || '',
    row.num_id_fiscal || '',
    row.nombre_extranjero || '',
    row.pais_residencia || '',
    row.lugar_jurisdiccion || '',
    row.valor_frontera_norte, row.dev_frontera_norte,
    row.valor_frontera_sur, row.dev_frontera_sur,
    row.valor_16, row.dev_16,
    row.valor_imp_tangibles_16, row.dev_imp_tangibles_16,
    row.valor_imp_intangibles_16, row.dev_imp_intangibles_16,
    row.iva_acred_frontera_norte, row.iva_acred_prop_frontera_norte,
    row.iva_acred_frontera_sur, row.iva_acred_prop_frontera_sur,
    row.iva_acred_16, row.iva_acred_prop_16,
    row.iva_acred_imp_tang_16, row.iva_acred_prop_imp_tang_16,
    row.iva_acred_imp_intang_16, row.iva_acred_prop_imp_intang_16,
    ...row.iva_no_acred,
    row.iva_retenido,
    row.valor_exento_importacion,
    row.valor_exento,
    row.valor_tasa_0,
    row.valor_no_objeto_nacional,
    row.valor_no_objeto_sin_establecimiento,
    row.manifiesto,
  ];
  return f.join('|');
}

// ─── Mapeo de datos REALES del backend (DIOT) → filas de la plantilla SAT ───
// El backend agrega las facturas por RFC del tercero y devuelve base + IVA
// acreditable. El resto de campos de la plantilla van en 0 (no aplican para
// operaciones nacionales estándar tomadas del CFDI).
export function diotEntriesToRows(entries: DiotEntryApi[]): DiotRow[] {
  return entries.map((e, i) => ({
    id: `${e.rfcTercero}-${i}`,
    tipo_tercero: (e.tipoTercero === '05' ? '05' : e.tipoTercero === '15' ? '15' : '04') as '04' | '05' | '15',
    tipo_operacion: (['02', '03', '06', '07', '08', '85', '87'].includes(e.tipoOperacion) ? e.tipoOperacion : '85') as DiotRow['tipo_operacion'],
    rfc: e.rfcTercero,
    valor_frontera_norte: 0, dev_frontera_norte: 0,
    valor_frontera_sur: 0, dev_frontera_sur: 0,
    valor_16: Math.round(e.baseGravable), dev_16: 0,
    valor_imp_tangibles_16: 0, dev_imp_tangibles_16: 0,
    valor_imp_intangibles_16: 0, dev_imp_intangibles_16: 0,
    iva_acred_frontera_norte: 0, iva_acred_prop_frontera_norte: 0,
    iva_acred_frontera_sur: 0, iva_acred_prop_frontera_sur: 0,
    iva_acred_16: Math.round(e.iva), iva_acred_prop_16: 0,
    iva_acred_imp_tang_16: 0, iva_acred_prop_imp_tang_16: 0,
    iva_acred_imp_intang_16: 0, iva_acred_prop_imp_intang_16: 0,
    iva_no_acred: Array(19).fill(0),
    iva_retenido: 0,
    valor_exento_importacion: 0,
    valor_exento: 0,
    valor_tasa_0: 0,
    valor_no_objeto_nacional: 0,
    valor_no_objeto_sin_establecimiento: 0,
    manifiesto: '01' as const,
    provider_name: e.nombre,
  }));
}

// Convierte el resultado del backend en un DiotReport para la UI/plantilla.
export function diotResultToReport(r: DiotApiResult): DiotReport {
  const rows = diotEntriesToRows(r.entries || []);
  const status: DiotReport['status'] = r.submittedAt
    ? 'submitted'
    : rows.length > 0
      ? 'generated'
      : 'draft';
  const genDate = r.generatedAt || r.submittedAt;
  return {
    id: r.id,
    period: r.period,
    status,
    generated_date: genDate ? genDate.split('T')[0] : undefined,
    total_providers: rows.length,
    total_base_16: rows.reduce((s, x) => s + x.valor_16, 0),
    total_iva_acred: rows.reduce((s, x) => s + x.iva_acred_16, 0),
    total_iva_retenido: 0,
    rows,
  };
}
