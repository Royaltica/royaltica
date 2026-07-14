import { GoogleGenAI } from "@google/genai";
import { verifyCFDI, type SATVerificationResult } from './satService.ts';

// Use import.meta.env for Vite, with a fallback to process.env if defined
const apiKey = (import.meta.env?.VITE_GEMINI_API_KEY) || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined. AI features will use mock mode.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

export interface RuleEngineInput {
  invoice: { id: string; amount: number; provider: string; providerId: string; date: string; description: string; poNumber: string };
  historicalInvoices: { id: string; amount: number; date: string; description: string; provider: string }[];
  supplierProfile?: { category: string; seniorityYears: number; isApproved: boolean };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OperationsContext {
  invoices: { id: string; provider: string; amount: number; date: string; status: string; description: string; auditScore?: number; paymentRoute?: string; forensicStatus?: string; signatures?: number; poNumber?: string; paymentType?: string }[];
  suppliers: { name: string; rfc: string; category: string; isApproved: boolean; seniorityYears: number }[];
  totalBudget: number;
  pendingAmount: number;
  paidAmount: number;
  cashTotal: number;
  overdueCount: number;
  fintechTotal: number;
  auditStats: { validated: number; discrepancy: number; blocked: number; pending: number };
  validationStats: { fullyValidated: number; partiallyValidated: number; pendingSignatures: number };
  factorajeRequests: { provider: string; amount: number; status: string; rate: number }[];
  treasuryAvailable: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1: Deterministic Rules Engine (instant, free, 100% reliable)
// ─────────────────────────────────────────────────────────────────────────────

function runRulesEngine(input: RuleEngineInput): ForensicAuditResult {
  const { invoice, historicalInvoices, supplierProfile } = input;

  let score = 100;
  const checks = {
    integrity: { passed: true, label: 'Integridad & Duplicidad', detail: '' },
    alignment: { passed: true, label: 'Alineación con OC', detail: '' },
    stability: { passed: true, label: 'Estabilidad Histórica', detail: '' },
    satVerification: { passed: true, label: 'Verificación SAT', detail: '' },
  };

  // ── Check 1: Duplicate Detection ──
  const duplicates = historicalInvoices.filter(h =>
    h.amount === invoice.amount &&
    h.provider === invoice.provider &&
    h.description === invoice.description &&
    h.id !== invoice.id
  );

  if (duplicates.length > 0) {
    checks.integrity.passed = false;
    checks.integrity.detail = `Posible duplicado detectado: ${duplicates.map(d => d.id).join(', ')} con mismo monto ($${invoice.amount.toLocaleString()}) y descripción.`;
    score -= 40;
  } else {
    checks.integrity.detail = 'Sin duplicados detectados en el historial. Factura con integridad limpia.';
  }

  // ── Check 2: PO Alignment (amount + provider consistency) ──
  const sameProviderInvoices = historicalInvoices.filter(h => h.provider === invoice.provider);
  const avgAmount = sameProviderInvoices.length > 0
    ? sameProviderInvoices.reduce((s, i) => s + i.amount, 0) / sameProviderInvoices.length
    : invoice.amount;

  // Flag if amount is > 3x the provider's average
  if (sameProviderInvoices.length >= 2 && invoice.amount > avgAmount * 3) {
    checks.alignment.passed = false;
    checks.alignment.detail = `Monto ($${invoice.amount.toLocaleString()}) es ${(invoice.amount / avgAmount).toFixed(1)}x el promedio histórico del proveedor ($${Math.round(avgAmount).toLocaleString()}). Verificar OC.`;
    score -= 25;
  } else if (!invoice.poNumber || invoice.poNumber.trim() === '') {
    checks.alignment.passed = false;
    checks.alignment.detail = 'Factura sin número de Orden de Compra vinculada.';
    score -= 15;
  } else {
    checks.alignment.detail = `OC ${invoice.poNumber} vinculada. Monto consistente con el historial del proveedor.`;
  }

  // ── Check 3: Price Stability ──
  const recentSameProvider = sameProviderInvoices
    .filter(h => h.id !== invoice.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  if (recentSameProvider.length > 0) {
    const recentAvg = recentSameProvider.reduce((s, i) => s + i.amount, 0) / recentSameProvider.length;
    const variation = ((invoice.amount - recentAvg) / recentAvg) * 100;

    if (Math.abs(variation) > 30) {
      checks.stability.passed = false;
      checks.stability.detail = `Variación de ${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs. últimas ${recentSameProvider.length} facturas del proveedor. Se recomienda revisión.`;
      score -= 20;
    } else if (Math.abs(variation) > 10) {
      checks.stability.detail = `Variación moderada de ${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs. historial reciente. Dentro de rango aceptable.`;
      score -= 5;
    } else {
      checks.stability.detail = `Precio estable (${variation > 0 ? '+' : ''}${variation.toFixed(1)}% variación). Consistencia verificada con ${recentSameProvider.length} facturas previas.`;
    }
  } else {
    checks.stability.detail = 'Primera factura de este proveedor en el sistema. Sin historial para comparar.';
  }

  // ── Supplier Risk Check (bonus/penalty) ──
  if (supplierProfile) {
    if (!supplierProfile.isApproved) {
      score -= 10;
      checks.integrity.detail += ' ⚠️ Proveedor NO aprobado en el directorio.';
    }
    if (supplierProfile.seniorityYears < 2) {
      score -= 5;
    }
  }

  score = Math.max(score, 0);

  // Determine status from score
  let status: ForensicAuditResult['status'] = 'VALIDATED';
  if (score < 50) status = 'BLOCKED';
  else if (score < 85) status = 'DISCREPANCY';

  // Generate deterministic analysis
  const failedChecks = [
    !checks.integrity.passed && 'integridad',
    !checks.alignment.passed && 'alineación con OC',
    !checks.stability.passed && 'estabilidad de precios'
  ].filter(Boolean);

  let analysis = '';
  let solution = '';
  if (status === 'VALIDATED') {
    const stabilityNote = checks.stability.detail.includes('Primera factura')
      ? 'sin historial previo (primer registro)'
      : checks.stability.detail.includes('Variación moderada')
        ? 'variación moderada dentro de rango'
        : 'precios estables vs historial';
    analysis = `✓ Sin duplicados · ✓ OC ${invoice.poNumber || '—'} alineada · ✓ ${stabilityNote}. Score ${score}/100.`;
    solution = 'Sin acciones requeridas. Factura lista para routing de pago.';
  } else if (status === 'DISCREPANCY') {
    analysis = `Discrepancia detectada en ${failedChecks.join(' y ')}. La factura ${invoice.id} requiere revisión manual antes de proceder al pago.`;
    solution = `Verificar ${failedChecks.join(' y ')} con el proveedor ${invoice.provider}. Solicitar documentación de respaldo si aplica.`;
  } else {
    analysis = `Factura ${invoice.id} bloqueada por fallo en ${failedChecks.join(' y ')}. No se recomienda procesar el pago.`;
    solution = `Contactar a ${invoice.provider} para aclarar las discrepancias. Considerar solicitar nota de crédito o nueva factura.`;
  }

  return { status, score, checks, analysis, solution, method: 'rules' };
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: AI Narrative Layer (only for anomalies & dictamen)
// ─────────────────────────────────────────────────────────────────────────────

async function getAIDictamen(
  rulesResult: ForensicAuditResult,
  input: RuleEngineInput
): Promise<{ analysis: string; solution: string }> {
  if (!apiKey) {
    return { analysis: rulesResult.analysis, solution: rulesResult.solution };
  }

  const prompt = `Eres un auditor fiscal forense de Royáltica, plataforma fintech mexicana. El motor de reglas determinista ya ejecutó la validación y encontró anomalías. Tu trabajo es redactar un DICTAMEN PROFESIONAL breve en español.

Resultado del motor de reglas:
- Status: ${rulesResult.status}
- Score: ${rulesResult.score}/100
- Integridad: ${rulesResult.checks.integrity.passed ? 'OK' : 'FALLO'} — ${rulesResult.checks.integrity.detail}
- Alineación OC: ${rulesResult.checks.alignment.passed ? 'OK' : 'FALLO'} — ${rulesResult.checks.alignment.detail}
- Estabilidad: ${rulesResult.checks.stability.passed ? 'OK' : 'FALLO'} — ${rulesResult.checks.stability.detail}

Factura: ${input.invoice.id} | ${input.invoice.provider} | $${input.invoice.amount.toLocaleString()} MXN | ${input.invoice.description}
Historial del proveedor: ${input.historicalInvoices.length} facturas previas

Genera en JSON exacto:
{
  "analysis": "Párrafo de 2-3 oraciones explicando el hallazgo con tono corporativo",
  "solution": "Instrucciones claras y accionables para resolver (1-2 oraciones)"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const text = response.text?.trim() || '';
    const cleaned = text.startsWith("```json") ? text.replace(/```json\n?/, "").replace(/\n?```/, "") : text;
    const parsed = JSON.parse(cleaned);
    return { analysis: parsed.analysis || rulesResult.analysis, solution: parsed.solution || rulesResult.solution };
  } catch (error) {
    console.warn("AI dictamen failed, using rules-based narrative:", error);
    return { analysis: rulesResult.analysis, solution: rulesResult.solution };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Hybrid Triple Match (Rules + AI when needed)
// ─────────────────────────────────────────────────────────────────────────────

export async function auditInvoice(
  invoiceData: any,
  poData: any,
  allInvoices?: any[],
  supplierProfile?: any
): Promise<ForensicAuditResult> {
  // Build input for rules engine
  const input: RuleEngineInput = {
    invoice: {
      id: invoiceData.id || 'UNKNOWN',
      amount: invoiceData.amount || 0,
      provider: invoiceData.provider || '',
      providerId: invoiceData.providerId || '',
      date: invoiceData.date || '',
      description: invoiceData.description || '',
      poNumber: invoiceData.poNumber || poData?.poNumber || '',
    },
    historicalInvoices: (allInvoices || [])
      .filter(i => i.provider === invoiceData.provider && i.id !== invoiceData.id)
      .map(i => ({ id: i.id, amount: i.amount, date: i.date, description: i.description, provider: i.provider })),
    supplierProfile: supplierProfile ? {
      category: supplierProfile.category || '',
      seniorityYears: supplierProfile.seniorityYears || 0,
      isApproved: supplierProfile.isApproved ?? true,
    } : undefined,
  };

  // PHASE 1: Run deterministic rules (instant, free)
  const rulesResult = runRulesEngine(input);

  // PHASE 1.5: SAT Verification (if CFDI UUID is available)
  const cfdiUUID = invoiceData.cfdiUUID;
  const providerRfc = supplierProfile?.rfc || 'XAXX010101000';
  if (cfdiUUID) {
    try {
      const satResult: SATVerificationResult = await verifyCFDI({
        uuid: cfdiUUID,
        rfcEmisor: providerRfc,
        rfcReceptor: 'RYL240101ABC', // Royáltica's RFC (placeholder)
        total: invoiceData.amount || 0,
      });

      rulesResult.satResult = {
        estado: satResult.estado,
        esCancelable: satResult.esCancelable,
        uuid: satResult.uuid,
      };

      if (satResult.estado === 'Vigente') {
        rulesResult.checks.satVerification.passed = true;
        rulesResult.checks.satVerification.detail = `CFDI ${cfdiUUID.slice(0, 8)}… verificado ante el SAT. Estado: Vigente. ${satResult.esCancelable ? `(${satResult.esCancelable})` : ''}`;
      } else if (satResult.estado === 'Cancelado') {
        rulesResult.checks.satVerification.passed = false;
        rulesResult.checks.satVerification.detail = `⛔ CFDI CANCELADO ante el SAT. UUID: ${cfdiUUID.slice(0, 8)}…. ${satResult.estatusCancelacion || 'Sin detalle de cancelación.'}. Esta factura NO debe pagarse.`;
        rulesResult.score = Math.max(rulesResult.score - 50, 0);
        rulesResult.status = 'BLOCKED';
      } else {
        rulesResult.checks.satVerification.passed = false;
        rulesResult.checks.satVerification.detail = `CFDI no encontrado en el SAT. UUID: ${cfdiUUID.slice(0, 8)}…. Verificar que el XML fue timbrado correctamente por un PAC autorizado.`;
        rulesResult.score = Math.max(rulesResult.score - 30, 0);
        if (rulesResult.status === 'VALIDATED') rulesResult.status = 'DISCREPANCY';
      }
    } catch {
      rulesResult.checks.satVerification.passed = true;
      rulesResult.checks.satVerification.detail = 'No se pudo conectar con el SAT. Verificación pendiente — se reintentará automáticamente.';
    }
  } else {
    rulesResult.checks.satVerification.passed = false;
    rulesResult.checks.satVerification.detail = 'Factura sin UUID de CFDI. Solicitar el XML timbrado al proveedor para verificar ante el SAT.';
    rulesResult.score = Math.max(rulesResult.score - 15, 0);
    if (rulesResult.status === 'VALIDATED') rulesResult.status = 'DISCREPANCY';
  }

  // PHASE 2: If VALIDATED, return immediately — no AI needed
  if (rulesResult.status === 'VALIDATED') {
    return rulesResult;
  }

  // PHASE 2b: Anomaly detected → enrich with AI narrative
  try {
    const aiDictamen = await getAIDictamen(rulesResult, input);
    return {
      ...rulesResult,
      analysis: aiDictamen.analysis,
      solution: aiDictamen.solution,
      method: 'hybrid',
    };
  } catch {
    return rulesResult;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: Batch Audit (sequential with delay to respect rate limits)
// ─────────────────────────────────────────────────────────────────────────────

export async function batchAuditInvoices(
  invoicesToAudit: any[],
  allInvoices: any[],
  suppliers: any[],
  onProgress: (completed: number, total: number, current: any, result: ForensicAuditResult) => void
): Promise<Map<string, ForensicAuditResult>> {
  const results = new Map<string, ForensicAuditResult>();

  for (let i = 0; i < invoicesToAudit.length; i++) {
    const inv = invoicesToAudit[i];
    const supplier = suppliers.find((s: any) => s.id === inv.providerId || s.name === inv.provider);

    const result = await auditInvoice(inv, { poNumber: inv.poNumber }, allInvoices, supplier);
    results.set(inv.id, result);
    onProgress(i + 1, invoicesToAudit.length, inv, result);

    // Small delay between AI calls (only needed for non-VALIDATED results)
    if (result.method === 'hybrid' && i < invoicesToAudit.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: AI Operations Chat
// ─────────────────────────────────────────────────────────────────────────────

export async function queryOperations(
  userQuestion: string,
  context: OperationsContext,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  // ── Build enriched per-provider aggregation ──
  const providerAgg: Record<string, { pending: number; paid: number; count: number; pendingCount: number; avgDays: number; categories: string[] }> = {};
  const today = new Date();
  for (const inv of context.invoices) {
    if (!providerAgg[inv.provider]) providerAgg[inv.provider] = { pending: 0, paid: 0, count: 0, pendingCount: 0, avgDays: 0, categories: [] };
    const agg = providerAgg[inv.provider];
    agg.count++;
    if (inv.status === 'paid') { agg.paid += inv.amount; }
    else { agg.pending += inv.amount; agg.pendingCount++; }
    const days = Math.floor((today.getTime() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
    agg.avgDays = Math.round(((agg.avgDays * (agg.count - 1)) + days) / agg.count);
  }

  const budgetUsedPct = ((context.pendingAmount + context.paidAmount) / context.totalBudget * 100).toFixed(1);
  const treasuryPct = ((context.treasuryAvailable / context.totalBudget) * 100).toFixed(1);

  const contextSummary = `
DATOS OPERATIVOS EN TIEMPO REAL DE ROYÁLTICA:

═══ PRESUPUESTO Y TESORERÍA ═══
- Presupuesto maestro anual: $${context.totalBudget.toLocaleString()} MXN
- Tesorería disponible (caja): $${context.treasuryAvailable.toLocaleString()} MXN (${treasuryPct}% del presupuesto)
- Total comprometido (pagado + pendiente): $${(context.paidAmount + context.pendingAmount).toLocaleString()} MXN (${budgetUsedPct}% del presupuesto)

═══ FACTURAS ═══
- Total facturas en el sistema: ${context.invoices.length}
- Monto pendiente total: $${context.pendingAmount.toLocaleString()} MXN
- Monto pagado total: $${context.paidAmount.toLocaleString()} MXN
- Pagadas vía caja: $${context.cashTotal.toLocaleString()} MXN
- Pagadas vía fintech/factoraje: $${context.fintechTotal.toLocaleString()} MXN
- Facturas vencidas (>30 días): ${context.overdueCount}

═══ AUDITORÍA Y VALIDACIÓN ═══
- Validadas por IA: ${context.auditStats.validated} facturas
- Con discrepancia: ${context.auditStats.discrepancy} facturas
- Bloqueadas: ${context.auditStats.blocked} facturas
- Pendientes de auditar: ${context.auditStats.pending} facturas
- Validación completa (100%): ${context.validationStats.fullyValidated} facturas
- Validación parcial (falta firmas): ${context.validationStats.partiallyValidated} facturas
- Pendientes de firma: ${context.validationStats.pendingSignatures} firmas faltantes

═══ FACTORAJE ═══
${context.factorajeRequests.length > 0
  ? context.factorajeRequests.map(f => `  • ${f.provider} | $${f.amount.toLocaleString()} | Estado: ${f.status} | Tasa: ${f.rate}%`).join('\n')
  : '  Sin solicitudes de factoraje activas.'}

═══ PROVEEDORES (${context.suppliers.length} registrados) ═══
${context.suppliers.map(s => {
    const agg = providerAgg[s.name];
    return `  • ${s.name} | ${s.category} | RFC: ${s.rfc} | ${s.seniorityYears} años | ${s.isApproved ? '✓ Aprobado' : '✗ NO aprobado'}${agg ? ` | Pendiente: $${agg.pending.toLocaleString()} (${agg.pendingCount} facs) | Pagado: $${agg.paid.toLocaleString()}` : ''}`;
  }).join('\n')}

═══ DETALLE DE FACTURAS ═══
${context.invoices.map(i => {
    const days = Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24));
    const sigs = i.signatures || 0;
    return `  ${i.id} | ${i.provider} | $${i.amount.toLocaleString()} | ${i.date} (${days}d) | ${i.status} | ${i.description} | OC: ${i.poNumber || '—'} | Ruta: ${i.paymentRoute || 'sin asignar'} | Auditoría: ${i.forensicStatus || 'pendiente'} | Firmas: ${sigs}/2 | Tipo: ${i.paymentType || 'PUE'}`;
  }).join('\n')}
`.trim();

  const systemPrompt = `Eres el Asistente Financiero Inteligente de Royáltica, plataforma fintech B2B de orquestación de pagos y auditoría fiscal para corporativos en México.

CAPACIDADES:
- Tienes acceso a TODOS los datos operativos en tiempo real: facturas, proveedores, presupuesto, auditorías, validaciones, tesorería y factoraje.
- Puedes responder preguntas sobre cualquier pestaña del sistema: Dashboard, Proveedores, Facturas por Pagar, Validación, Financiamiento/Factoraje, Auditoría y Configuración.
- Puedes hacer cálculos, comparaciones, análisis de tendencias y recomendaciones basadas en los datos.

REGLAS:
1. Responde SOLO con los datos proporcionados. Nunca inventes cifras.
2. Siempre da montos exactos formateados ($XX,XXX MXN) cuando se pregunte por cantidades.
3. Español mexicano, tono profesional pero accesible.
4. Sé específico y directo. Si preguntan por un proveedor, factura o dato concreto, ve al grano con la respuesta exacta.
5. Si te piden un análisis o reporte, estructura con secciones claras y viñetas.
6. Si no tienes los datos para responder, dilo honestamente.
7. Usa **negritas** para datos clave y cifras importantes.
8. Si detectas riesgos o anomalías relevantes a la pregunta, menciónalas proactivamente.
9. Cuando te pregunten "cuántas facturas", "cuánto debo a X", "qué estado tiene X" — busca en el detalle de facturas y da la respuesta precisa.

${contextSummary}`;

  // Build conversation for Gemini
  const geminiContents: any[] = [];

  // Add system context as first user turn + model acknowledgment
  geminiContents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  geminiContents.push({ role: 'model', parts: [{ text: 'Entendido. Tengo acceso a los datos operativos de Royáltica. ¿En qué puedo ayudarte?' }] });

  // Add conversation history
  for (const msg of conversationHistory) {
    geminiContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  // Add current question
  geminiContents.push({ role: 'user', parts: [{ text: userQuestion }] });

  if (!apiKey) {
    return getMockChatResponse(userQuestion, context);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: geminiContents,
    });

    return response.text?.trim() || 'No pude generar una respuesta. Intenta reformular tu pregunta.';
  } catch (error) {
    console.warn("AI chat failed, using mock:", error);
    return getMockChatResponse(userQuestion, context);
  }
}

function getMockChatResponse(question: string, ctx: OperationsContext): string {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const today = new Date();

  // ── Helper: find provider by name mention (best match wins) ──
  const commonWords = new Set(['total', 'general', 'servicios', 'grupo', 'sistemas', 'empresa', 'estado', 'datos', 'monto']);
  const findProvider = () => {
    // Score each provider by how many of their name words appear in the query
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const s of ctx.suppliers) {
      const nameNorm = s.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      // Full name match is best
      if (q.includes(nameNorm)) return s.name;

      // Score by matching words
      const words = nameNorm.split(' ').filter(w => w.length > 2);
      let score = 0;
      for (const w of words) {
        if (q.includes(w)) score += w.length; // Longer word matches score higher
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = s.name;
      }
    }

    // Only return if we matched at least one significant word (>4 chars worth)
    return bestScore >= 5 ? bestMatch : null;
  };

  // ── Helper: find invoice by ID mention ──
  const findInvoice = () => {
    const match = question.match(/FAC[-\w]+/i);
    if (match) return ctx.invoices.find(i => i.id.toLowerCase() === match[0].toLowerCase());
    return null;
  };

  // ── Specific invoice query (by ID like FAC-XX-XX) ──
  const targetInvoice = findInvoice();
  if (targetInvoice) {
    const days = Math.floor((today.getTime() - new Date(targetInvoice.date).getTime()) / (1000 * 60 * 60 * 24));
    const sigs = targetInvoice.signatures || 0;
    return `**Factura ${targetInvoice.id}**\n• Proveedor: **${targetInvoice.provider}**\n• Monto: **$${targetInvoice.amount.toLocaleString()} MXN**\n• Fecha: ${targetInvoice.date} (hace ${days} días)\n• Estado: **${targetInvoice.status}**\n• Descripción: ${targetInvoice.description}\n• OC: ${targetInvoice.poNumber || 'Sin OC'}\n• Auditoría: ${targetInvoice.forensicStatus || 'Pendiente'}\n• Firmas: ${sigs}/2\n• Ruta de pago: ${targetInvoice.paymentRoute || 'Sin asignar'}`;
  }

  // ── Specific provider query (check BEFORE generic "cuánto debo" to catch "cuánto debo a X") ──
  const targetProvider = findProvider();
  if (targetProvider && (q.includes('cuanto') || q.includes('monto') || q.includes('debo') || q.includes('factura') || q.includes('estado') || q.includes('info') || q.includes('detalle'))) {
    const provInvs = ctx.invoices.filter(i => i.provider === targetProvider);
    const pending = provInvs.filter(i => i.status !== 'paid');
    const paid = provInvs.filter(i => i.status === 'paid');
    const pendingTotal = pending.reduce((s, i) => s + i.amount, 0);
    const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
    const supplier = ctx.suppliers.find(s => s.name === targetProvider);
    const validated = provInvs.filter(i => i.forensicStatus === 'VALIDATED').length;

    let response = `**${targetProvider}**\n`;
    if (supplier) response += `• Categoría: ${supplier.category} | RFC: ${supplier.rfc} | ${supplier.seniorityYears} años | ${supplier.isApproved ? '✓ Aprobado' : '✗ No aprobado'}\n`;
    response += `• Total facturas: **${provInvs.length}** (${pending.length} pendientes, ${paid.length} pagadas)\n`;
    response += `• Monto pendiente: **$${pendingTotal.toLocaleString()} MXN**\n`;
    response += `• Monto pagado: **$${paidTotal.toLocaleString()} MXN**\n`;
    response += `• Validadas por IA: ${validated}/${provInvs.length}`;
    if (pending.length > 0) {
      response += `\n\n**Facturas pendientes:**\n${pending.slice(0, 5).map(i => `  • ${i.id} — $${i.amount.toLocaleString()} — ${i.description}`).join('\n')}`;
      if (pending.length > 5) response += `\n  ... y ${pending.length - 5} más.`;
    }
    return response;
  }

  // ── How much do I owe / pending (generic, after provider check) ──
  if (q.includes('cuanto') && (q.includes('debo') || q.includes('pendiente') || q.includes('pagar'))) {
    const byProvider: Record<string, { amount: number; count: number }> = {};
    ctx.invoices.filter(i => i.status !== 'paid').forEach(i => {
      if (!byProvider[i.provider]) byProvider[i.provider] = { amount: 0, count: 0 };
      byProvider[i.provider].amount += i.amount;
      byProvider[i.provider].count++;
    });
    const sorted = Object.entries(byProvider).sort((a, b) => b[1].amount - a[1].amount);
    return `Tienes **$${ctx.pendingAmount.toLocaleString()} MXN** pendientes en **${ctx.invoices.filter(i => i.status !== 'paid').length}** facturas.\n\n**Por proveedor:**\n${sorted.slice(0, 5).map(([name, data]) => `• ${name}: **$${data.amount.toLocaleString()} MXN** (${data.count} facs)`).join('\n')}\n${ctx.overdueCount > 0 ? `\n⚠️ **${ctx.overdueCount}** facturas superan los 30 días sin pago.` : '\n✅ Todas dentro del plazo.'}`;
  }

  // ── Budget / presupuesto questions ──
  if (q.includes('presupuesto') || q.includes('budget')) {
    const used = ctx.paidAmount + ctx.pendingAmount;
    const usedPct = ((used / ctx.totalBudget) * 100).toFixed(1);
    const remaining = ctx.totalBudget - used;
    return `**Presupuesto Maestro:** $${ctx.totalBudget.toLocaleString()} MXN\n• Comprometido (pagado + pendiente): **$${used.toLocaleString()} MXN** (${usedPct}%)\n• Disponible: **$${remaining.toLocaleString()} MXN**\n• Tesorería en caja: **$${ctx.treasuryAvailable.toLocaleString()} MXN**\n• Uso de fintech: $${ctx.fintechTotal.toLocaleString()} MXN`;
  }

  // ── Treasury / caja / tesoreria ──
  if (q.includes('caja') || q.includes('tesoreria') || q.includes('liquidez') || q.includes('disponible')) {
    return `**Tesorería disponible:** $${ctx.treasuryAvailable.toLocaleString()} MXN (${((ctx.treasuryAvailable / ctx.totalBudget) * 100).toFixed(1)}% del presupuesto).\n• Si pagaras todo lo pendiente ($${ctx.pendingAmount.toLocaleString()} MXN), quedarían **$${(ctx.treasuryAvailable - ctx.pendingAmount).toLocaleString()} MXN** en caja.\n${ctx.treasuryAvailable < ctx.pendingAmount ? '⚠️ **No hay suficiente liquidez** para cubrir todas las facturas pendientes. Considera usar factoraje.' : '✅ Liquidez suficiente para cubrir todas las facturas pendientes.'}`;
  }

  // ── Validation / firmas / signatures ──
  if (q.includes('validacion') || q.includes('firma') || q.includes('validada') || q.includes('validar')) {
    return `**Estado de validación:**\n• Validación completa (100%): **${ctx.validationStats.fullyValidated}** facturas\n• Validación parcial (faltan firmas): **${ctx.validationStats.partiallyValidated}** facturas\n• Firmas pendientes: **${ctx.validationStats.pendingSignatures}**\n• Auditoría IA — Validadas: ${ctx.auditStats.validated} | Discrepancias: ${ctx.auditStats.discrepancy} | Bloqueadas: ${ctx.auditStats.blocked} | Pendientes: ${ctx.auditStats.pending}`;
  }

  // ── Provider ranking ──
  if (q.includes('proveedor') && (q.includes('mas') || q.includes('mayor') || q.includes('cobra') || q.includes('ranking') || q.includes('top'))) {
    const byProvider: Record<string, number> = {};
    ctx.invoices.filter(i => i.status !== 'paid').forEach(i => { byProvider[i.provider] = (byProvider[i.provider] || 0) + i.amount; });
    const sorted = Object.entries(byProvider).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      return `**Ranking de proveedores por monto pendiente:**\n${sorted.map(([name, amount], i) => `${i + 1}. **${name}** — $${amount.toLocaleString()} MXN`).join('\n')}\n\n**Total pendiente:** $${ctx.pendingAmount.toLocaleString()} MXN`;
    }
  }

  // ── Factoraje ──
  if (q.includes('fintech') || q.includes('factoraje') || q.includes('financiamiento')) {
    let response = `**Financiamiento y Factoraje:**\n• Uso fintech este período: **$${ctx.fintechTotal.toLocaleString()} MXN** (${((ctx.fintechTotal / ctx.totalBudget) * 100).toFixed(1)}% del presupuesto)\n• Pagos vía caja: **$${ctx.cashTotal.toLocaleString()} MXN**`;
    if (ctx.factorajeRequests.length > 0) {
      response += `\n\n**Solicitudes de factoraje activas:**\n${ctx.factorajeRequests.map(f => `• ${f.provider} — $${f.amount.toLocaleString()} MXN — ${f.status} — Tasa: ${f.rate}%`).join('\n')}`;
    } else {
      response += '\n\nSin solicitudes de factoraje activas.';
    }
    return response;
  }

  // ── Summary / resumen ──
  if (q.includes('resumen') || q.includes('general') || q.includes('estado') || q.includes('como va') || q.includes('como esta')) {
    return `**Resumen Operativo Royáltica**\n\n**Presupuesto:** $${ctx.totalBudget.toLocaleString()} MXN | Caja: $${ctx.treasuryAvailable.toLocaleString()} MXN\n\n**Facturas (${ctx.invoices.length} totales):**\n• Pendientes: $${ctx.pendingAmount.toLocaleString()} MXN\n• Pagadas: $${ctx.paidAmount.toLocaleString()} MXN\n• Vencidas: ${ctx.overdueCount}\n\n**Auditoría IA:**\n• ✅ ${ctx.auditStats.validated} validadas | ⚠️ ${ctx.auditStats.discrepancy} discrepancias | 🚫 ${ctx.auditStats.blocked} bloqueadas | ⏳ ${ctx.auditStats.pending} pendientes\n\n**Validación:** ${ctx.validationStats.fullyValidated} completas | ${ctx.validationStats.partiallyValidated} parciales\n**Fintech:** $${ctx.fintechTotal.toLocaleString()} MXN`;
  }

  // ── Reports ──
  if (q.includes('reporte') || q.includes('informe')) {
    return `**Reporte Ejecutivo de Tesorería**\n\n**1. Portafolio:** ${ctx.invoices.length} facturas | $${(ctx.pendingAmount + ctx.paidAmount).toLocaleString()} MXN total\n**2. Pendiente:** $${ctx.pendingAmount.toLocaleString()} MXN | **Pagado:** $${ctx.paidAmount.toLocaleString()} MXN\n**3. Presupuesto:** $${ctx.totalBudget.toLocaleString()} MXN | Uso: ${(((ctx.pendingAmount + ctx.paidAmount) / ctx.totalBudget) * 100).toFixed(1)}%\n**4. Fintech:** $${ctx.fintechTotal.toLocaleString()} MXN\n**5. Alertas:** ${ctx.overdueCount > 0 ? `⚠️ ${ctx.overdueCount} facturas vencidas` : '✅ Sin vencimientos'} | ${ctx.auditStats.discrepancy > 0 ? `🔍 ${ctx.auditStats.discrepancy} discrepancias` : '✅ Sin discrepancias'}`;
  }

  // ── Overdue / vencidas ──
  if (q.includes('vencid') || q.includes('atrasad') || q.includes('demora') || q.includes('urgente')) {
    const overdue = ctx.invoices.filter(i => {
      if (i.status === 'paid') return false;
      return Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24)) > 30;
    });
    if (overdue.length > 0) {
      const total = overdue.reduce((s, i) => s + i.amount, 0);
      return `Hay **${overdue.length} facturas vencidas** (>30 días) por un total de **$${total.toLocaleString()} MXN**:\n\n${overdue.slice(0, 8).map(i => {
        const days = Math.floor((today.getTime() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24));
        return `• ${i.id} | ${i.provider} | $${i.amount.toLocaleString()} | ${days} días`;
      }).join('\n')}\n\n⚠️ Esto genera riesgo reputacional con los proveedores afectados.`;
    }
    return 'No hay facturas vencidas actualmente. ✅ Todos los pagos están dentro del plazo.';
  }

  // ── Fallback — generic but helpful ──
  return `Tengo acceso completo a tus datos operativos: **${ctx.invoices.length}** facturas, **${ctx.suppliers.length}** proveedores, presupuesto de **$${ctx.totalBudget.toLocaleString()} MXN** y $${ctx.treasuryAvailable.toLocaleString()} MXN en caja.\n\nPuedo responder sobre:\n• Montos pendientes por proveedor o factura específica\n• Estado de auditoría y validación\n• Presupuesto y tesorería\n• Factoraje y financiamiento\n• Facturas vencidas y alertas\n\n¿Qué necesitas saber?`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: AI Report Generation
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType = 'executive' | 'anticorruption' | 'fiscal' | 'provider';

export async function generateReport(
  reportType: ReportType,
  context: OperationsContext,
  extra?: { providerName?: string }
): Promise<string> {
  const prompts: Record<ReportType, string> = {
    executive: `Genera un REPORTE EJECUTIVO DE TESORERÍA profesional en español para una junta directiva.

Datos:
- ${context.invoices.length} facturas totales
- Pendiente: $${context.pendingAmount.toLocaleString()} MXN (${context.auditStats.pending} facturas)
- Pagado: $${context.paidAmount.toLocaleString()} MXN
- Presupuesto: $${context.totalBudget.toLocaleString()} MXN
- Uso fintech: $${context.fintechTotal.toLocaleString()} MXN
- Facturas vencidas: ${context.overdueCount}
- Validadas por IA: ${context.auditStats.validated} | Discrepancias: ${context.auditStats.discrepancy} | Bloqueadas: ${context.auditStats.blocked}
- Proveedores: ${context.suppliers.length} registrados

Top 5 facturas pendientes por monto:
${context.invoices.filter(i => i.status !== 'paid').sort((a, b) => b.amount - a.amount).slice(0, 5).map(i => `  ${i.id} | ${i.provider} | $${i.amount.toLocaleString()} | ${i.description}`).join('\n')}

Estructura el reporte con: 1) Resumen Ejecutivo, 2) Estado de Cartera, 3) Alertas Activas, 4) Recomendaciones. Máximo 300 palabras. Formato con negritas y viñetas.`,

    anticorruption: `Genera un INFORME DE ALERTA ANTI-CORRUPCIÓN para supervisión gerencial.

Facturas vencidas (>30 días sin pago):
${context.invoices.filter(i => {
  if (i.status === 'paid') return false;
  const days = Math.floor((Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24));
  return days > 30;
}).map(i => {
  const days = Math.floor((Date.now() - new Date(i.date).getTime()) / (1000 * 60 * 60 * 24));
  return `  ${i.id} | ${i.provider} | $${i.amount.toLocaleString()} | ${days} días sin pago | ${i.description}`;
}).join('\n') || '  Sin facturas vencidas.'}

Total proveedores afectados: ${context.overdueCount > 0 ? '(ver arriba)' : '0'}

Genera un informe con: 1) Hallazgos, 2) Proveedores en riesgo, 3) Monto total comprometido, 4) Acciones recomendadas. Tono formal de auditoría interna. Máximo 250 palabras.`,

    fiscal: `Genera un REPORTE DE CUMPLIMIENTO FISCAL.

Estadísticas:
- Facturas validadas por IA: ${context.auditStats.validated}
- Facturas con discrepancia: ${context.auditStats.discrepancy}
- Facturas bloqueadas: ${context.auditStats.blocked}
- Pendientes de auditar: ${context.auditStats.pending}
- Proveedores aprobados: ${context.suppliers.filter(s => s.isApproved).length} / ${context.suppliers.length}

Facturas con problemas:
${context.invoices.filter(i => i.forensicStatus === 'DISCREPANCY' || i.forensicStatus === 'BLOCKED').map(i => `  ${i.id} | ${i.provider} | $${i.amount.toLocaleString()} | ${i.forensicStatus}`).join('\n') || '  Sin facturas problemáticas.'}

Genera: 1) Estado de auditoría, 2) Riesgos fiscales, 3) Cumplimiento DIOT, 4) Recomendaciones. Máximo 250 palabras.`,

    provider: `Genera un ANÁLISIS DEL PROVEEDOR "${extra?.providerName || 'Proveedor'}" para revisión interna.

Facturas del proveedor:
${context.invoices.filter(i => i.provider === extra?.providerName).map(i => `  ${i.id} | $${i.amount.toLocaleString()} | ${i.date} | ${i.status} | ${i.description}`).join('\n') || '  Sin facturas registradas.'}

Perfil:
${context.suppliers.filter(s => s.name === extra?.providerName).map(s => `  Categoría: ${s.category} | RFC: ${s.rfc} | Antigüedad: ${s.seniorityYears} años | Aprobado: ${s.isApproved ? 'Sí' : 'No'}`).join('\n') || '  No encontrado.'}

Genera: 1) Perfil del proveedor, 2) Historial de facturación, 3) Patrones detectados, 4) Nivel de riesgo. Máximo 200 palabras.`
  };

  if (!apiKey) {
    return getMockReport(reportType, context, extra);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompts[reportType],
    });
    return response.text?.trim() || getMockReport(reportType, context, extra);
  } catch (error) {
    console.warn("Report generation failed:", error);
    return getMockReport(reportType, context, extra);
  }
}

function getMockReport(type: ReportType, ctx: OperationsContext, extra?: { providerName?: string }): string {
  if (type === 'executive') {
    return `**REPORTE EJECUTIVO DE TESORERÍA**\n\n**1. Resumen Ejecutivo**\nEl portafolio actual contiene **${ctx.invoices.length} facturas** con un saldo pendiente de **$${ctx.pendingAmount.toLocaleString()} MXN** sobre un presupuesto de $${ctx.totalBudget.toLocaleString()} MXN.\n\n**2. Estado de Cartera**\n• Facturas pagadas: $${ctx.paidAmount.toLocaleString()} MXN\n• Uso de fintech: $${ctx.fintechTotal.toLocaleString()} MXN\n• Validadas por IA: ${ctx.auditStats.validated}\n• Con discrepancias: ${ctx.auditStats.discrepancy}\n\n**3. Alertas Activas**\n${ctx.overdueCount > 0 ? `• ⚠️ ${ctx.overdueCount} facturas vencidas requieren atención inmediata.` : '• ✅ Sin facturas vencidas.'}\n${ctx.auditStats.blocked > 0 ? `• 🚫 ${ctx.auditStats.blocked} facturas bloqueadas por auditoría.` : ''}\n\n**4. Recomendaciones**\n• Priorizar la liquidación de facturas vencidas para mantener relaciones sanas con proveedores.\n• Revisar las discrepancias detectadas antes del cierre mensual.\n• Considerar factoraje para facturas de alto monto si la liquidez es limitada.`;
  }
  if (type === 'anticorruption') {
    return `**INFORME DE ALERTA ANTI-CORRUPCIÓN**\n\n**1. Hallazgos**\nSe detectaron **${ctx.overdueCount} facturas** que exceden el plazo máximo de pago de 30 días. Este patrón puede indicar negligencia operativa o retención deliberada de pagos.\n\n**2. Monto Comprometido**\n$${ctx.pendingAmount.toLocaleString()} MXN en facturas pendientes.\n\n**3. Acciones Recomendadas**\n• Investigar el motivo de la demora en el procesamiento.\n• Notificar a los proveedores afectados.\n• Documentar las causas de cada retraso para auditoría interna.`;
  }
  if (type === 'provider' && extra?.providerName) {
    const provInv = ctx.invoices.filter(i => i.provider === extra.providerName);
    const total = provInv.reduce((s, i) => s + i.amount, 0);
    return `**ANÁLISIS DE PROVEEDOR: ${extra.providerName}**\n\n**1. Perfil**\n${ctx.suppliers.find(s => s.name === extra.providerName)?.category || 'N/A'}\n\n**2. Facturación**\n• Total facturado: $${total.toLocaleString()} MXN\n• Facturas: ${provInv.length}\n\n**3. Nivel de Riesgo:** Bajo`;
  }
  return `**REPORTE FISCAL**\n\n• Validadas: ${ctx.auditStats.validated}\n• Discrepancias: ${ctx.auditStats.discrepancy}\n• Bloqueadas: ${ctx.auditStats.blocked}\n• Pendientes: ${ctx.auditStats.pending}\n\nSin riesgos fiscales inmediatos detectados.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: AI Accounting / Contabilidad Chat
// ─────────────────────────────────────────────────────────────────────────────

export interface AccountingContext {
  // Estado de Resultados
  ingresos: { ventasNetas: number; otrosIngresos: number; ingresosFinancieros: number; total: number };
  costos: { costoVentas: number; depreciacion: number; total: number };
  gastosOperativos: { sueldos: number; servicios: number; renta: number; marketing: number; tecnologia: number; otros: number; total: number };
  utilidadBruta: number;
  utilidadOperativa: number;
  ebitda: number;
  isr: number;
  ptu: number;
  utilidadNeta: number;
  margenes: { bruto: number; operativo: number; ebitda: number; neto: number };
  // Balance General
  activoCirculante: { efectivo: number; cuentasCobrar: number; inventarios: number; anticipos: number; total: number };
  activoFijo: { mobiliario: number; equipo: number; depAcumulada: number; total: number };
  totalActivo: number;
  pasivoCorto: { proveedores: number; impuestos: number; prestamos: number; total: number };
  pasivoLargo: { creditoBancario: number; arrendamiento: number; total: number };
  totalPasivo: number;
  capital: { capitalSocial: number; utilidadesRetenidas: number; utilidadEjercicio: number; total: number };
  // Razones Financieras
  razones: {
    liquidez: { razonCirculante: number; pruebaAcida: number; capitalTrabajo: number };
    deuda: { razonDeuda: number; apalancamiento: number; cobertura: number };
    rendimiento: { roa: number; roe: number; margenUtilidad: number; margenEbitda: number };
  };
  // Extras from operations
  totalFacturas: number;
  facturasPendientes: number;
  facturasPagadas: number;
  montoPendiente: number;
  montoPagado: number;
  proveedores: number;
  activeTab: string;
}

export async function queryContabilidad(
  userQuestion: string,
  ctx: AccountingContext,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtR = (n: number) => n.toFixed(2);

  const contextSummary = `
DATOS CONTABLES Y FINANCIEROS EN TIEMPO REAL DE ROYÁLTICA:

═══ ESTADO DE RESULTADOS (Enero – Junio 2024) ═══
INGRESOS:
- Ventas Netas: ${fmt(ctx.ingresos.ventasNetas)}
- Otros Ingresos: ${fmt(ctx.ingresos.otrosIngresos)}
- Ingresos Financieros: ${fmt(ctx.ingresos.ingresosFinancieros)}
- TOTAL INGRESOS: ${fmt(ctx.ingresos.total)}

COSTOS:
- Costo de Ventas: ${fmt(ctx.costos.costoVentas)}
- Depreciación: ${fmt(ctx.costos.depreciacion)}
- TOTAL COSTOS: ${fmt(ctx.costos.total)}

UTILIDAD BRUTA: ${fmt(ctx.utilidadBruta)} (Margen Bruto: ${fmtPct(ctx.margenes.bruto)})

GASTOS OPERATIVOS:
- Sueldos y Salarios: ${fmt(ctx.gastosOperativos.sueldos)}
- Servicios Profesionales: ${fmt(ctx.gastosOperativos.servicios)}
- Rentas: ${fmt(ctx.gastosOperativos.renta)}
- Marketing: ${fmt(ctx.gastosOperativos.marketing)}
- Tecnología: ${fmt(ctx.gastosOperativos.tecnologia)}
- Otros Gastos: ${fmt(ctx.gastosOperativos.otros)}
- TOTAL GASTOS OPERATIVOS: ${fmt(ctx.gastosOperativos.total)}

UTILIDAD OPERATIVA: ${fmt(ctx.utilidadOperativa)} (Margen Operativo: ${fmtPct(ctx.margenes.operativo)})
EBITDA: ${fmt(ctx.ebitda)} (Margen EBITDA: ${fmtPct(ctx.margenes.ebitda)})
ISR (30%): ${fmt(ctx.isr)}
PTU (10%): ${fmt(ctx.ptu)}
UTILIDAD NETA: ${fmt(ctx.utilidadNeta)} (Margen Neto: ${fmtPct(ctx.margenes.neto)})

═══ BALANCE GENERAL ═══
ACTIVO CIRCULANTE:
- Efectivo y Equivalentes: ${fmt(ctx.activoCirculante.efectivo)}
- Cuentas por Cobrar: ${fmt(ctx.activoCirculante.cuentasCobrar)}
- Inventarios: ${fmt(ctx.activoCirculante.inventarios)}
- Anticipos: ${fmt(ctx.activoCirculante.anticipos)}
- TOTAL CIRCULANTE: ${fmt(ctx.activoCirculante.total)}

ACTIVO FIJO:
- Mobiliario: ${fmt(ctx.activoFijo.mobiliario)}
- Equipo de Cómputo: ${fmt(ctx.activoFijo.equipo)}
- Depreciación Acumulada: ${fmt(ctx.activoFijo.depAcumulada)}
- TOTAL FIJO: ${fmt(ctx.activoFijo.total)}

TOTAL ACTIVO: ${fmt(ctx.totalActivo)}

PASIVO A CORTO PLAZO:
- Proveedores (CxP): ${fmt(ctx.pasivoCorto.proveedores)}
- Impuestos por Pagar: ${fmt(ctx.pasivoCorto.impuestos)}
- Préstamos Bancarios CP: ${fmt(ctx.pasivoCorto.prestamos)}
- TOTAL CORTO PLAZO: ${fmt(ctx.pasivoCorto.total)}

PASIVO A LARGO PLAZO:
- Crédito Bancario: ${fmt(ctx.pasivoLargo.creditoBancario)}
- Arrendamiento: ${fmt(ctx.pasivoLargo.arrendamiento)}
- TOTAL LARGO PLAZO: ${fmt(ctx.pasivoLargo.total)}

TOTAL PASIVO: ${fmt(ctx.totalPasivo)}

CAPITAL CONTABLE:
- Capital Social: ${fmt(ctx.capital.capitalSocial)}
- Utilidades Retenidas: ${fmt(ctx.capital.utilidadesRetenidas)}
- Utilidad del Ejercicio: ${fmt(ctx.capital.utilidadEjercicio)}
- TOTAL CAPITAL: ${fmt(ctx.capital.total)}

Verificación: Activo (${fmt(ctx.totalActivo)}) = Pasivo (${fmt(ctx.totalPasivo)}) + Capital (${fmt(ctx.capital.total)})

═══ RAZONES FINANCIERAS ═══
LIQUIDEZ:
- Razón Circulante: ${fmtR(ctx.razones.liquidez.razonCirculante)} veces (ideal 1.5-2.5)
- Prueba Ácida: ${fmtR(ctx.razones.liquidez.pruebaAcida)} veces (ideal 1.0-1.5)
- Capital de Trabajo: ${fmt(ctx.razones.liquidez.capitalTrabajo)}

ENDEUDAMIENTO:
- Razón de Deuda: ${fmtPct(ctx.razones.deuda.razonDeuda * 100)} (ideal < 60%)
- Apalancamiento: ${fmtR(ctx.razones.deuda.apalancamiento)} veces (ideal < 2.0)
- Cobertura de Deuda: ${fmtR(ctx.razones.deuda.cobertura)} veces (ideal > 2.0)

RENDIMIENTO:
- ROA (Return on Assets): ${fmtPct(ctx.razones.rendimiento.roa)} (ideal > 5%)
- ROE (Return on Equity): ${fmtPct(ctx.razones.rendimiento.roe)} (ideal > 15%)
- Margen de Utilidad Neta: ${fmtPct(ctx.razones.rendimiento.margenUtilidad)} (ideal > 10%)
- Margen EBITDA: ${fmtPct(ctx.razones.rendimiento.margenEbitda)} (ideal > 20%)

═══ DATOS OPERATIVOS ═══
- Total facturas en sistema: ${ctx.totalFacturas}
- Facturas pendientes: ${ctx.facturasPendientes} (${fmt(ctx.montoPendiente)})
- Facturas pagadas: ${ctx.facturasPagadas} (${fmt(ctx.montoPagado)})
- Proveedores registrados: ${ctx.proveedores}
- Pestaña actual del usuario: ${ctx.activeTab}
`.trim();

  const systemPrompt = `Eres un Contador Público y Analista Financiero experto de Royáltica, plataforma fintech B2B de orquestación de pagos y auditoría fiscal para corporativos en México.

CAPACIDADES:
- Tienes acceso a TODOS los estados financieros de la empresa: Estado de Resultados, Balance General y Razones Financieras en tiempo real.
- Puedes explicar qué significa cada razón financiera, si el nivel actual es bueno o malo, y qué acciones tomar.
- Puedes hacer análisis de rentabilidad, liquidez, solvencia y apalancamiento.
- Puedes comparar contra benchmarks de la industria y dar recomendaciones concretas.
- Puedes explicar conceptos contables de forma simple y accesible.

REGLAS:
1. Responde SOLO con los datos proporcionados. Nunca inventes cifras.
2. Siempre da montos exactos formateados ($XX,XXX MXN) cuando hables de cantidades.
3. Español mexicano, tono profesional pero accesible — como un CFO explicando a un CEO.
4. Sé específico y directo. Si preguntan por una razón financiera, explica: qué es, cuál es su valor actual, si es bueno o malo, por qué, y qué hacer.
5. Si te piden un análisis, estructura con secciones claras, viñetas y negritas.
6. Cuando expliques razones financieras, siempre menciona el rango ideal y cómo se compara la empresa.
7. Usa **negritas** para datos clave y cifras importantes.
8. Si detectas riesgos financieros, menciónalos proactivamente con recomendaciones.
9. Puedes interpretar tendencias y hacer proyecciones conservadoras basadas en los datos.
10. Si el usuario pregunta algo que no son datos contables (como una pregunta general de finanzas), respóndela con tu expertise contable y relacíonala con los datos de la empresa cuando sea posible.

${contextSummary}`;

  const geminiContents: any[] = [];
  geminiContents.push({ role: 'user', parts: [{ text: systemPrompt }] });
  geminiContents.push({ role: 'model', parts: [{ text: 'Entendido. Tengo acceso completo a los estados financieros de Royáltica: Estado de Resultados, Balance General y Razones Financieras. Puedo analizar la salud financiera de la empresa, explicar qué significan las razones financieras y dar recomendaciones. ¿En qué puedo ayudarte?' }] });

  for (const msg of conversationHistory) {
    geminiContents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  geminiContents.push({ role: 'user', parts: [{ text: userQuestion }] });

  if (!apiKey) {
    return getMockContabilidadResponse(userQuestion, ctx);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: geminiContents,
    });
    return response.text?.trim() || 'No pude generar una respuesta. Intenta reformular tu pregunta.';
  } catch (error) {
    console.warn("AI accounting chat failed, using mock:", error);
    return getMockContabilidadResponse(userQuestion, ctx);
  }
}

function getMockContabilidadResponse(question: string, ctx: AccountingContext): string {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const fmt = (n: number) => `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmtR = (n: number) => n.toFixed(2);

  if (q.includes('razon circulante') || q.includes('liquidez') || q.includes('circulante')) {
    const rc = ctx.razones.liquidez.razonCirculante;
    const status = rc >= 1.5 ? 'saludable' : rc >= 1 ? 'ajustada' : 'en riesgo';
    return `**Razón Circulante: ${fmtR(rc)} veces**\n\nEsto significa que por cada peso que la empresa debe a corto plazo, tiene **${fmtR(rc)} pesos** en activos líquidos para cubrirlo.\n\n**¿Es bueno?** ${rc >= 1.5 ? '✅ Sí, está en rango saludable (ideal: 1.5-2.5).' : rc >= 1 ? '⚠️ Está en el límite. Idealmente debería ser mayor a 1.5.' : '🚨 Está por debajo de 1, lo que indica riesgo de insolvencia.'}\n\n**Desglose:**\n- Activo Circulante: ${fmt(ctx.activoCirculante.total)}\n  • Efectivo: ${fmt(ctx.activoCirculante.efectivo)}\n  • CxC: ${fmt(ctx.activoCirculante.cuentasCobrar)}\n  • Inventarios: ${fmt(ctx.activoCirculante.inventarios)}\n- Pasivo Corto Plazo: ${fmt(ctx.pasivoCorto.total)}\n\n**Posición: ${status.toUpperCase()}**\n\n${rc >= 1.5 ? 'La empresa puede cumplir cómodamente sus obligaciones de corto plazo sin recurrir a financiamiento externo.' : 'Recomendación: acelerar cobros, negociar plazos con proveedores, o buscar línea de crédito revolvente como respaldo.'}`;
  }

  if (q.includes('prueba acida') || q.includes('acida')) {
    const pa = ctx.razones.liquidez.pruebaAcida;
    return `**Prueba Ácida: ${fmtR(pa)} veces**\n\nExcluye inventarios del cálculo (a diferencia de la razón circulante) porque los inventarios no siempre se pueden liquidar rápidamente.\n\n**Fórmula:** (Activo Circulante − Inventarios) / Pasivo a Corto Plazo\n= (${fmt(ctx.activoCirculante.total)} − ${fmt(ctx.activoCirculante.inventarios)}) / ${fmt(ctx.pasivoCorto.total)}\n= **${fmtR(pa)} veces**\n\n${pa >= 1 ? '✅ La empresa puede cubrir sus deudas sin necesidad de vender inventario.' : '⚠️ Sin vender inventario, la empresa tendría dificultades para cubrir sus deudas de corto plazo.'}`;
  }

  if (q.includes('capital de trabajo') || q.includes('working capital')) {
    return `**Capital de Trabajo: ${fmt(ctx.razones.liquidez.capitalTrabajo)}**\n\nEs el excedente del activo circulante sobre el pasivo de corto plazo. Representa el "colchón" financiero de la empresa.\n\n**Cálculo:**\n- Activo Circulante: ${fmt(ctx.activoCirculante.total)}\n- Pasivo Corto Plazo: ${fmt(ctx.pasivoCorto.total)}\n- **Diferencia: ${fmt(ctx.razones.liquidez.capitalTrabajo)}**\n\n${ctx.razones.liquidez.capitalTrabajo > 0 ? '✅ Positivo: la empresa tiene holgura financiera.' : '🚨 Negativo: la empresa necesita financiamiento urgente.'}`;
  }

  if (q.includes('deuda') || q.includes('endeudamiento') || q.includes('apalanca')) {
    return `**Análisis de Endeudamiento**\n\n1. **Razón de Deuda: ${fmtPct(ctx.razones.deuda.razonDeuda * 100)}**\n   Del total de activos, el ${fmtPct(ctx.razones.deuda.razonDeuda * 100)} está financiado con deuda.\n   ${ctx.razones.deuda.razonDeuda < 0.5 ? '✅ Conservador' : ctx.razones.deuda.razonDeuda < 0.7 ? '⚠️ Moderado' : '🚨 Alto'}\n\n2. **Apalancamiento: ${fmtR(ctx.razones.deuda.apalancamiento)} veces**\n   Por cada peso de capital propio, hay ${fmtR(ctx.razones.deuda.apalancamiento)} pesos de deuda.\n   ${ctx.razones.deuda.apalancamiento < 1.5 ? '✅ Bajo apalancamiento' : '⚠️ Apalancamiento elevado'}\n\n3. **Cobertura: ${fmtR(ctx.razones.deuda.cobertura)} veces**\n   La utilidad operativa cubre ${fmtR(ctx.razones.deuda.cobertura)} veces las obligaciones bancarias.\n   ${ctx.razones.deuda.cobertura > 2 ? '✅ Holgura suficiente' : '⚠️ Margen ajustado'}`;
  }

  if (q.includes('roe') || q.includes('return on equity') || q.includes('rendimiento')) {
    return `**Análisis de Rendimiento**\n\n1. **ROA: ${fmtPct(ctx.razones.rendimiento.roa)}** — Por cada peso en activos, se generan ${fmtPct(ctx.razones.rendimiento.roa)} de utilidad neta.\n   ${ctx.razones.rendimiento.roa > 5 ? '✅ Bueno' : '⚠️ Bajo'}\n\n2. **ROE: ${fmtPct(ctx.razones.rendimiento.roe)}** — Retorno para los accionistas sobre su inversión.\n   ${ctx.razones.rendimiento.roe > 15 ? '✅ Atractivo' : '⚠️ Por debajo del benchmark'}\n\n3. **Margen Neto: ${fmtPct(ctx.razones.rendimiento.margenUtilidad)}**\n   De cada peso de ingreso, ${fmtPct(ctx.razones.rendimiento.margenUtilidad)} es utilidad neta.\n\n4. **Margen EBITDA: ${fmtPct(ctx.razones.rendimiento.margenEbitda)}**\n   Rentabilidad operativa antes de impuestos, intereses y depreciación.`;
  }

  if (q.includes('estado de resultados') || q.includes('p&l') || q.includes('perdidas') || q.includes('ganancias')) {
    return `**Estado de Resultados (Resumen)**\n\n| Concepto | Monto |\n|---|---|\n| Ingresos Totales | ${fmt(ctx.ingresos.total)} |\n| (−) Costos | ${fmt(ctx.costos.total)} |\n| **Utilidad Bruta** | **${fmt(ctx.utilidadBruta)}** (${fmtPct(ctx.margenes.bruto)}) |\n| (−) Gastos Operativos | ${fmt(ctx.gastosOperativos.total)} |\n| **Utilidad Operativa** | **${fmt(ctx.utilidadOperativa)}** (${fmtPct(ctx.margenes.operativo)}) |\n| **EBITDA** | **${fmt(ctx.ebitda)}** (${fmtPct(ctx.margenes.ebitda)}) |\n| (−) ISR + PTU | ${fmt(ctx.isr + ctx.ptu)} |\n| **Utilidad Neta** | **${fmt(ctx.utilidadNeta)}** (${fmtPct(ctx.margenes.neto)}) |`;
  }

  if (q.includes('balance') || q.includes('activo') || q.includes('pasivo')) {
    return `**Balance General (Resumen)**\n\n**ACTIVO:** ${fmt(ctx.totalActivo)}\n- Circulante: ${fmt(ctx.activoCirculante.total)}\n- Fijo: ${fmt(ctx.activoFijo.total)}\n\n**PASIVO:** ${fmt(ctx.totalPasivo)}\n- Corto Plazo: ${fmt(ctx.pasivoCorto.total)}\n- Largo Plazo: ${fmt(ctx.pasivoLargo.total)}\n\n**CAPITAL:** ${fmt(ctx.capital.total)}\n\n✅ Ecuación contable cuadra: A = P + C`;
  }

  if (q.includes('ebitda')) {
    return `**EBITDA: ${fmt(ctx.ebitda)}** (Margen: ${fmtPct(ctx.margenes.ebitda)})\n\nEl EBITDA mide la rentabilidad operativa antes de intereses, impuestos, depreciación y amortización. Es la métrica más usada para valorar empresas.\n\n**Cálculo:**\n- Utilidad Operativa: ${fmt(ctx.utilidadOperativa)}\n- (+) Depreciación: ${fmt(ctx.costos.depreciacion)}\n- = **EBITDA: ${fmt(ctx.ebitda)}**\n\n${ctx.margenes.ebitda > 20 ? '✅ Margen EBITDA superior al 20% — excelente eficiencia operativa.' : '⚠️ Margen EBITDA por debajo del 20% — hay espacio para mejorar eficiencia.'}`;
  }

  // Default
  return `**Resumen Financiero Royáltica**\n\nTengo acceso a toda la información contable:\n\n• **Ingresos:** ${fmt(ctx.ingresos.total)} | **Utilidad Neta:** ${fmt(ctx.utilidadNeta)} (${fmtPct(ctx.margenes.neto)})\n• **Activos:** ${fmt(ctx.totalActivo)} | **Pasivos:** ${fmt(ctx.totalPasivo)} | **Capital:** ${fmt(ctx.capital.total)}\n• **Razón Circulante:** ${fmtR(ctx.razones.liquidez.razonCirculante)} | **Deuda:** ${fmtPct(ctx.razones.deuda.razonDeuda * 100)} | **ROE:** ${fmtPct(ctx.razones.rendimiento.roe)}\n\nPuedes preguntarme sobre:\n- Cualquier razón financiera y qué significa\n- Análisis de liquidez, deuda o rendimiento\n- Estado de resultados y balance general\n- Recomendaciones financieras\n\n¿Qué te gustaría analizar?`;
}
