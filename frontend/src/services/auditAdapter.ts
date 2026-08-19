import { api, isRealId, type AuditResult } from './apiClient.ts';

/**
 * Forma que consumen las vistas de auditoría (CorporateDashboard, AuditsView).
 * Se conserva este shape (heredado del prototipo original con Gemini
 * client-side) para no tener que tocar la UI, pero ahora se rellena SIEMPRE
 * a partir de `AuditResult` — la respuesta real de `POST /invoices/:id/audit`
 * (InvoiceAuditService en el backend), nunca de un cálculo hecho en el
 * navegador.
 */
export interface ForensicAuditResult {
  status: 'VALIDATED' | 'DISCREPANCY' | 'BLOCKED';
  score: number;
  checks: {
    integrity: { passed: boolean; label: string; detail: string };
    alignment: { passed: boolean; label: string; detail: string };
    stability: { passed: boolean; label: string; detail: string };
    satVerification: { passed: boolean; label: string; detail: string };
  };
  analysis: string;
  solution: string;
  method: 'rules' | 'hybrid' | 'ai-only';
  satResult?: { estado: string; esCancelable: string | null; uuid: string };
}

interface BackendCheck {
  code: string;
  label: string;
  passed: boolean;
  pointsDeducted: number;
  blocking: boolean;
  detail: string;
}

interface BackendAnalysis {
  engineVersion: string;
  generatedAt: string;
  score: number;
  status: string;
  checks: BackendCheck[];
  sat: {
    status: string;
    esCancelable: string | null;
    estatusCancelacion: string | null;
    verifiedAt: string;
    mode: string;
  };
  ai: {
    provider: string;
    summary: string;
    riskLevel: 'low' | 'medium' | 'high';
    additionalConcerns: string[];
  } | null;
}

function findCheck(checks: BackendCheck[], code: string): BackendCheck | undefined {
  return checks.find((c) => c.code === code);
}

function placeholder(label: string): { passed: boolean; label: string; detail: string } {
  return { passed: true, label, detail: 'No evaluado en esta auditoría.' };
}

/**
 * Convierte la respuesta REAL del backend (`POST /invoices/:id/audit`,
 * InvoiceAuditService) al shape que espera la UI de auditoría. Reemplaza el
 * cálculo que antes se hacía en el navegador llamando a Gemini directo con
 * una API key expuesta (`services/geminiService.ts`, ya eliminado).
 */
export function toForensicAuditResult(
  result: AuditResult,
  invoiceUuid?: string,
): ForensicAuditResult {
  const raw = (result.analysis ?? {}) as Partial<BackendAnalysis>;
  const checks = raw.checks ?? [];

  const duplicate = findCheck(checks, 'DUPLICATE_LIKELY');
  const rfcEmisor = findCheck(checks, 'RFC_EMISOR_MATCH');
  const rfcReceptor = findCheck(checks, 'RFC_RECEPTOR_MATCH');
  const amountOutlier = findCheck(checks, 'AMOUNT_OUTLIER');
  const efos = findCheck(checks, 'SAT_69B_EFOS');
  const math = findCheck(checks, 'MATH_CONSISTENCY');

  const alignmentPassed = (rfcEmisor?.passed ?? true) && (rfcReceptor?.passed ?? true);
  const alignmentDetail =
    [rfcEmisor, rfcReceptor]
      .filter((c): c is BackendCheck => !!c && !c.passed)
      .map((c) => c.detail)
      .join(' ') ||
    rfcEmisor?.detail ||
    rfcReceptor?.detail ||
    'Sin datos de RFC para comparar.';

  const failedChecks = checks.filter((c) => !c.passed);
  const analysisText =
    raw.ai?.summary ||
    (failedChecks.length === 0
      ? `Sin discrepancias detectadas. ${math?.detail ?? ''}`.trim()
      : `Se detectaron ${failedChecks.length} discrepancia(s): ${failedChecks
          .map((c) => c.detail)
          .join(' ')}`);

  const solutionText =
    result.forensicStatus === 'VALIDATED'
      ? 'Sin acciones requeridas. Factura lista para routing de pago.'
      : `Revisar: ${failedChecks.map((c) => c.label).join(', ') || 'verificación general'}.`;

  return {
    status: result.forensicStatus,
    score: result.forensicScore,
    checks: {
      integrity: duplicate
        ? { passed: duplicate.passed, label: duplicate.label, detail: duplicate.detail }
        : placeholder('Sin duplicados'),
      alignment: {
        passed: alignmentPassed,
        label: 'RFC emisor/receptor coinciden',
        detail: alignmentDetail,
      },
      stability: amountOutlier
        ? { passed: amountOutlier.passed, label: amountOutlier.label, detail: amountOutlier.detail }
        : placeholder('Monto dentro del histórico'),
      satVerification: {
        passed: raw.sat ? raw.sat.status === 'Vigente' : (efos?.passed ?? true),
        label: 'Verificación SAT',
        detail: raw.sat
          ? `Estado ante el SAT: ${raw.sat.status}.${efos && !efos.passed ? ' ' + efos.detail : ''}`
          : efos?.detail || 'Sin verificar.',
      },
    },
    analysis: analysisText,
    solution: solutionText,
    method: raw.ai ? 'hybrid' : 'rules',
    satResult: raw.sat
      ? { estado: raw.sat.status, esCancelable: raw.sat.esCancelable, uuid: invoiceUuid ?? '' }
      : undefined,
  };
}

/**
 * Resultado "demo" para facturas de ejemplo (sin UUID real en el backend) —
 * nunca se les puede correr una auditoría real porque no existen en la base
 * de datos.
 */
function demoAuditResult(): ForensicAuditResult {
  const note = {
    passed: true,
    label: 'Modo demo',
    detail: 'Esta es una factura de ejemplo — conecta una factura real para auditoría con IA.',
  };
  return {
    status: 'DISCREPANCY',
    score: 0,
    checks: { integrity: note, alignment: note, stability: note, satVerification: note },
    analysis:
      'Esta es una factura de ejemplo (modo demo). La auditoría forense real (reglas + IA + verificación SAT) corre sobre facturas conectadas al backend.',
    solution: 'Registra o importa una factura real para obtener una auditoría forense real.',
    method: 'rules',
  };
}

/**
 * Corre la auditoría REAL en el backend (POST /invoices/:id/audit —
 * InvoiceAuditService: reglas deterministas + verificación SAT en vivo +
 * lista 69-B + narrativa de Gemini vía Vertex AI del lado del servidor) y
 * adapta la respuesta al shape que usa la UI. Antes esto se calculaba en el
 * navegador llamando a Gemini directo con una API key expuesta
 * (services/geminiService.ts, eliminado).
 */
export async function runRealAudit(inv: {
  id: string;
  cfdiUUID?: string;
}): Promise<ForensicAuditResult> {
  if (!isRealId(inv.id)) return demoAuditResult();
  const result = await api.auditInvoice(inv.id);
  return toForensicAuditResult(result, inv.cfdiUUID);
}
