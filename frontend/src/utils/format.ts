import type { Invoice, Supplier } from '../types.ts';

export const CURRENCY_FORMATTER = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export const DEFAULT_BUDGET = 5000000;

export const getPriorityInfo = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date('2024-04-27'); // Reference date based on current system time
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 10) return { label: 'Óptimo', color: 'bg-green-500', text: 'text-green-600', bg: 'bg-green-50', score: 1 };
  if (diffDays <= 20) return { label: 'En Tiempo', color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', score: 2 };
  if (diffDays <= 30) return { label: 'Media Alta', color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50', score: 3 };
  return { label: 'Urgente', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50', score: 4 };
};

/**
 * Construye el string de "source" del lead combinando el host + params UTM
 * de la URL. Se guarda en `Lead.source` en el backend, útil para saber
 * de qué campaña / canal vino cada prospecto.
 * Ejemplo: "royaltica.com?utm_source=linkedin&utm_medium=organic".
 */
export function buildLeadSource(): string {
  if (typeof window === 'undefined') return 'unknown';
  const host = window.location.host;
  const params = new URLSearchParams(window.location.search);
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    .map(k => (params.get(k) ? `${k}=${params.get(k)}` : null))
    .filter((s): s is string => s !== null)
    .join('&');
  const ref = document.referrer && !document.referrer.includes(host)
    ? `ref=${new URL(document.referrer).host}`
    : '';
  const extra = [utm, ref].filter(Boolean).join('&');
  return extra ? `${host}?${extra}` : host;
}

// Badge de score 0-100 del proveedor + recálculo (POST /suppliers/:id/score).
/**
 * Checklist real de cumplimiento del proveedor (reemplaza el "Score" 0-100,
 * que no tenía suficientes variables para ser una calificación honesta).
 * Cuenta factores verificables + documentos KYC cargados en el expediente,
 * y muestra "cumplidos/total" (ej. 3/5). Sin datos inventados.
 */
export function getSupplierChecklist(supplier: Supplier): { passed: number; total: number } {
  const factors = [
    supplier.sat69b?.rfcValid === true,
    supplier.sat69b ? !supplier.sat69b.listed : false,
    supplier.isApproved,
  ];
  const docs = supplier.documents.map(d => d.status === 'Validado');
  const all = [...factors, ...docs];
  return { passed: all.filter(Boolean).length, total: all.length };
}

export type ComplianceCheckStatus = 'ok' | 'fail' | 'warn' | 'pending';
export interface ComplianceCheck {
  label: string;
  status: ComplianceCheckStatus;
  detail: string;
}

/**
 * Verificación de cumplimiento POR FACTURA: solo el estatus del CFDI ante el
 * SAT (consulta SOAP en tiempo real), que es lo único único por factura. La
 * verificación 69-B/RFC es del proveedor y vive en su expediente.
 */
export function getComplianceChecks(inv: Invoice): ComplianceCheck[] {
  const sat = inv.satStatus;
  return [
    {
      label: 'Estatus del CFDI ante el SAT',
      status: sat === 'Vigente' ? 'ok' : sat === 'Cancelado' ? 'fail' : (sat === 'No Encontrado' || sat === 'No Verificado') ? 'warn' : 'pending',
      detail:
        sat === 'Vigente' ? 'CFDI vigente. Verificado en tiempo real en el portal del SAT.'
        : sat === 'Cancelado' ? 'El SAT reporta este CFDI como CANCELADO. No debe procederse con el pago.'
        : sat === 'No Encontrado' ? 'El SAT no localizó este folio fiscal. Confirmar el UUID con el proveedor.'
        : sat === 'No Verificado' ? 'No fue posible contactar el servicio del SAT al momento de la auditoría. Reintentar verificación.'
        : 'Pendiente de consulta ante el SAT.',
    },
  ];
}

// Multi-weight calculation logic
export const calculateAuditScore = (inv: Invoice) => {
  // 33.33% per pillar (PO, XML/Integridad, Auth)
  const weightPerPillar = 33.333;

  // Pillar 1 & 2 combined logic or individual
  let poMatch = 1;
  let integrityMatch = 1;

  if (inv.forensicStatus === 'DISCREPANCY') {
    poMatch = 0.5; // Discrepancia leve
  } else if (inv.forensicStatus === 'BLOCKED') {
    poMatch = 0;
    integrityMatch = 0;
  }

  // Auth match: count real signatures
  const sigs = typeof inv.signatures === 'number' ? inv.signatures : 0;
  const authMatch = sigs / 2;

  // Adjusted pillars for the 3 grouped boxes effectively
  // Box 1 (PO+DUPL), Box 2 (Stability), Box 3 (Auth)
  // Let's use 33.33 each
  const score = (poMatch * weightPerPillar) + (integrityMatch * weightPerPillar) + (authMatch * weightPerPillar);
  return Math.min(100, Math.round(score));
};

// Consolidado de validación 100%
export const isInvoiceFullyValidated = (inv: Invoice) => {
  return (inv.status === 'audited' || inv.status === 'approved') && (inv.signatures || 0) >= 2;
};

export const getAIRecommendation = (inv: Invoice, budgetOverride?: number) => {
  const priority = getPriorityInfo(inv.date);
  const amount = inv.amount;
  const totalBudget = budgetOverride || DEFAULT_BUDGET;
  const impact = (amount / totalBudget) * 100;

  const isUrgente = priority.label === 'Urgente' || priority.label === 'Media Alta';
  const isHighImpact = impact > 5;

  if (isHighImpact && isUrgente) {
    return {
      strategy: 'fintech' as const,
      label: 'Recomendación: Factoraje (Fintech)',
      reason: `Esta factura es urgente y tiene un impacto alto (${impact.toFixed(1)}%) en tu presupuesto. Usar factoraje protege tu efectivo para otros gastos operativos inmediatos.`
    };
  } else if (isHighImpact) {
    return {
      strategy: 'fintech' as const,
      label: 'Sugerencia: Financiamiento Externo',
      reason: `Al ser un monto considerable (${impact.toFixed(1)}%), financiar este pago te permite mantener liquidez en caja para aprovechar otras oportunidades de inversión.`
    };
  } else if (isUrgente) {
    return {
      strategy: 'cash' as const,
      label: 'Recomendación: Pago con Caja Propia',
      reason: `Es un pago urgente pero de bajo impacto económico. Liquidar directamente con tus recursos ahorra costos financieros y cumple rápido con el proveedor.`
    };
  } else {
    return {
      strategy: 'cash' as const,
      label: 'Sugerencia: Liquidación Directa',
      reason: `El monto es pequeño y no hay urgencia. Pagar con caja propia es la opción más eficiente para evitar comisiones de financiamiento externas.`
    };
  }
};
