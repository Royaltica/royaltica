import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { EASE, Reveal, BlockTitle } from './primitives.tsx';
import {
  api,
  type CollectionLevelPlan,
  type WaConversationSummary,
  type WaDraft,
  type WaTemplateInfo,
  type WaThread,
} from '../../../../services/apiClient.ts';

/**
 * WhatsApp de cobranza con DATOS REALES (primera pieza del Módulo 2 conectada
 * al backend). El flujo acordado:
 *
 *   1. Primer contacto de cada nivel → plantilla aprobada por Meta.
 *   2. El cliente contesta o toca un botón → se abre la ventana de 24h.
 *   3. Dentro de la ventana → borrador con IA que una persona revisa y envía.
 *
 * La ventana la calcula el backend (último mensaje del cliente); aquí solo se
 * muestra. Si está cerrada, el backend rechaza el texto libre aunque se
 * intentara desde otro lado.
 */

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function WhatsappPanel() {
  const [plan, setPlan] = React.useState<CollectionLevelPlan | null | undefined>(undefined);
  const [lista, setLista] = React.useState<WaConversationSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selId, setSelId] = React.useState<string | null>(null);

  const cargarLista = React.useCallback(async () => {
    try {
      const l = await api.getWaConversations();
      setLista(l);
      setSelId((prev) => prev ?? l.find((c) => c.hasWhatsapp)?.customerId ?? l[0]?.customerId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la bandeja.');
    }
  }, []);

  React.useEffect(() => {
    api.getLevelPlan().then((r) => setPlan(r.policy)).catch(() => setPlan(null));
    void cargarLista();
  }, [cargarLista]);

  return (
    <div className="space-y-5">
      <Reveal>
        <PlanNiveles plan={plan} onActivado={setPlan} />
      </Reveal>

      {error && <Aviso tono="error" texto={error} />}

      <Reveal delay={0.05}>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <Bandeja lista={lista} selId={selId} onSel={setSelId} />
          {selId ? (
            // key en el Fragment: al cambiar de cliente se reinicia el hilo completo.
            <React.Fragment key={selId}>
              <Hilo customerId={selId} onCambio={cargarLista} />
            </React.Fragment>
          ) : (
            <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-10 text-center text-sm text-brand-ink/45">
              {lista && lista.length === 0
                ? 'Aún no hay clientes. Cárgalos en la pestaña Datos (CSV) para empezar.'
                : 'Elige un cliente.'}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

// ─── Plan por niveles ───────────────────────────────────────────────

const NIVEL_CORTO: Record<string, string> = {
  confirmacion_factura: 'N0',
  aviso_preventivo_pago: 'N1',
  recordatorio_cortesia_pago: 'N2',
  vence_3_dias: 'N3',
  vence_hoy: 'N4',
  aviso_vencida: 'A',
  seguimiento_vencida: 'B',
};

function PlanNiveles({
  plan,
  onActivado,
}: {
  plan: CollectionLevelPlan | null | undefined;
  onActivado: (p: CollectionLevelPlan) => void;
}) {
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (plan === undefined) return null;

  const activar = async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await api.ensureLevelPlan();
      onActivado(r.policy);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar el plan.');
    } finally {
      setCargando(false);
    }
  };

  if (!plan) {
    return (
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-lg font-serif text-brand-ink">El plan por niveles no está activo</h4>
          <p className="text-[13px] text-brand-ink/60 mt-1 max-w-[70ch]">
            Al activarlo, cada factura sigue los niveles 0-4 antes de vencer y las etapas A-D después. El primer
            contacto de cada nivel usa la plantilla aprobada por Meta.
          </p>
          {error && <p className="text-[12px] text-rose-600 mt-2">{error}</p>}
        </div>
        <button
          onClick={activar}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 disabled:opacity-60"
        >
          {cargando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Activar plan por niveles
        </button>
      </div>
    );
  }

  return (
    <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl px-6 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <BlockTitle>Plan activo</BlockTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          {plan.sequenceSteps.map((s) => {
            const corto = s.whatsappTemplateName
              ? NIVEL_CORTO[s.whatsappTemplateName] ?? s.whatsappTemplateName
              : s.channel === 'EMAIL'
                ? 'C'
                : 'D';
            const dia = s.daysAfterDue === 0 ? 'día 0' : s.daysAfterDue < 0 ? `${s.daysAfterDue}d` : `+${s.daysAfterDue}d`;
            return (
              <span
                key={s.id}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                  s.daysAfterDue < 0 || s.daysAfterDue === 0
                    ? 'bg-sky-50 border-sky-200 text-sky-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
                title={s.whatsappTemplateName ?? s.channel}
              >
                {corto} · {s.daysAfterDue <= -90 ? 'al cargar' : dia}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Bandeja ────────────────────────────────────────────────────────

function Bandeja({
  lista,
  selId,
  onSel,
}: {
  lista: WaConversationSummary[] | null;
  selId: string | null;
  onSel: (id: string) => void;
}) {
  return (
    <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-3 h-fit">
      <div className="px-3 pt-2 pb-3">
        <BlockTitle icon={<MessageSquare size={13} />}>Conversaciones</BlockTitle>
      </div>
      {lista === null ? (
        <div className="p-6 flex justify-center">
          <Loader2 size={16} className="animate-spin text-brand-ink/40" />
        </div>
      ) : (
        <ul className="space-y-1">
          {lista.map((c) => {
            const activa = c.customerId === selId;
            return (
              <li key={c.customerId}>
                <button
                  onClick={() => onSel(c.customerId)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl transition-colors ${
                    activa ? 'bg-brand-bone' : 'hover:bg-brand-bone/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-brand-ink truncate">{c.name}</span>
                    {c.windowOpen ? (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {restante(c.windowExpiresAt)}
                      </span>
                    ) : !c.hasWhatsapp ? (
                      <span className="shrink-0 text-[10px] text-brand-ink/35">sin WhatsApp</span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-brand-ink/45 truncate mt-0.5">
                    {c.lastMessage
                      ? `${c.lastMessage.direction === 'INBOUND' ? 'Cliente: ' : 'Tú: '}${c.lastMessage.body}`
                      : 'Sin mensajes todavía'}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Hilo ───────────────────────────────────────────────────────────

function Hilo({ customerId, onCambio }: { customerId: string; onCambio: () => void }) {
  const reduce = useReducedMotion();
  const [hilo, setHilo] = React.useState<WaThread | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [facturaId, setFacturaId] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState('');
  const [borrador, setBorrador] = React.useState<WaDraft | null>(null);
  const [ocupado, setOcupado] = React.useState<null | 'plantilla' | 'ia' | 'enviar' | 'simular'>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const finRef = React.useRef<HTMLDivElement>(null);

  const cargar = React.useCallback(async () => {
    try {
      const h = await api.getWaThread(customerId);
      setHilo(h);
      setFacturaId((prev) => prev ?? h.invoices[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la conversación.');
    }
  }, [customerId]);

  React.useEffect(() => {
    void cargar();
    // La respuesta del cliente llega por el webhook: se refresca solo.
    const t = setInterval(() => void cargar(), 15_000);
    return () => clearInterval(t);
  }, [cargar]);

  React.useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' });
  }, [hilo?.messages.length]);

  if (error) return <Aviso tono="error" texto={error} />;
  if (!hilo) {
    return (
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-10 flex justify-center">
        <Loader2 size={16} className="animate-spin text-brand-ink/40" />
      </div>
    );
  }

  const factura = hilo.invoices.find((i) => i.id === facturaId) ?? null;
  const sugerida = factura ? nivelSugerido(hilo.templates, factura.daysToDue) : null;
  const ventana = hilo.window;
  const sinTelefono = !hilo.customer.phone;

  const correr = async (tipo: NonNullable<typeof ocupado>, fn: () => Promise<string | void>) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      const msg = await fn();
      if (msg) setAviso(msg);
      await cargar();
      onCambio();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Algo falló.');
    } finally {
      setOcupado(null);
    }
  };

  const enviarPlantilla = (t: WaTemplateInfo) =>
    correr('plantilla', async () => {
      if (!factura) return 'Elige una factura pendiente.';
      const r = await api.sendWaTemplate(customerId, factura.id, t.name);
      return r.sent
        ? `Plantilla "${t.label}" enviada.`
        : `Quedó registrada, pero no salió a WhatsApp (modo ${r.mode}: falta configurar el token de Meta en este entorno).`;
    });

  const redactar = () =>
    correr('ia', async () => {
      const d = await api.draftWaReply(customerId);
      setBorrador(d);
      setTexto(d.draft);
      if (d.source === 'fallback') return 'La IA no está disponible en este entorno: se usó un borrador base. Revísalo antes de enviar.';
    });

  const enviarTexto = () =>
    correr('enviar', async () => {
      const r = await api.sendWaText(customerId, texto);
      setTexto('');
      setBorrador(null);
      return r.sent ? 'Mensaje enviado.' : `Quedó registrado, pero no salió a WhatsApp (modo ${r.mode}).`;
    });

  return (
    <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl flex flex-col min-h-[560px]">
      {/* Encabezado */}
      <div className="px-6 pt-5 pb-4 border-b border-brand-ink/8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-serif text-brand-ink">{hilo.customer.name}</h4>
          <p className="text-[12px] text-brand-ink/50 mt-0.5">
            {hilo.customer.contact ? `${hilo.customer.contact} · ` : ''}
            {hilo.customer.phone ?? 'Sin teléfono de WhatsApp'}
          </p>
        </div>
        <VentanaBadge abierta={ventana.open} expira={ventana.expiresAt} />
      </div>

      {hilo.customer.doNotContact && (
        <div className="px-6 pt-4">
          <Aviso tono="error" texto="Este cliente pidió no ser contactado (lista de exclusión). No se le puede escribir." />
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 px-6 py-5 space-y-3 overflow-y-auto max-h-[420px] scrollbar-custom">
        {hilo.messages.length === 0 && (
          <p className="text-center text-[12px] text-brand-ink/40 py-10">
            Todavía no hay mensajes. El primer contacto siempre es una plantilla del nivel que le toca.
          </p>
        )}
        {hilo.messages.map((m) => {
          const sale = m.direction === 'OUTBOUND';
          return (
            <motion.div
              key={m.id}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={`flex ${sale ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                  sale ? 'bg-brand-ink text-brand-paper rounded-br-md' : 'bg-brand-bone text-brand-ink rounded-bl-md'
                }`}
              >
                {(m.kind === 'TEMPLATE' || m.kind === 'BUTTON' || m.kind === 'MEDIA') && (
                  <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${sale ? 'text-brand-paper/55' : 'text-brand-ink/45'}`}>
                    {m.kind === 'TEMPLATE'
                      ? `Plantilla · ${hilo.templates.find((t) => t.name === m.templateName)?.label ?? m.templateName}`
                      : m.kind === 'BUTTON'
                        ? 'Tocó un botón'
                        : 'Archivo'}
                  </p>
                )}
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                <p className={`text-[10px] mt-1 ${sale ? 'text-brand-paper/45' : 'text-brand-ink/35'}`}>
                  {hora(m.createdAt)}
                  {sale && !m.sent && ' · no salió (modo prueba)'}
                  {sale && m.sentByUserId === null && m.kind !== 'BUTTON' && ' · automático'}
                </p>
              </div>
            </motion.div>
          );
        })}
        <div ref={finRef} />
      </div>

      {/* Acciones */}
      <div className="border-t border-brand-ink/8 px-6 py-5 space-y-4">
        {aviso && <Aviso tono="info" texto={aviso} />}

        {/* 1 · Plantilla del nivel */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <BlockTitle>1 · Recordatorio del nivel (plantilla de Meta)</BlockTitle>
            {hilo.invoices.length > 0 && (
              <select
                value={facturaId ?? ''}
                onChange={(e) => setFacturaId(e.target.value)}
                className="text-[12px] border border-brand-ink/12 rounded-lg px-2 py-1 bg-brand-paper text-brand-ink"
              >
                {hilo.invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.folio} · {MXN.format(i.total)} · {textoDias(i.daysToDue)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {hilo.invoices.length === 0 ? (
            <p className="text-[12px] text-brand-ink/45 mt-2">Sin facturas pendientes.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hilo.templates.map((t) => {
                const esSugerida = sugerida?.name === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => enviarPlantilla(t)}
                    disabled={!!ocupado || sinTelefono || hilo.customer.doNotContact}
                    title={vistaPrevia(t, hilo, factura)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                      esSugerida
                        ? 'bg-brand-gold/15 border-brand-gold text-brand-ink'
                        : 'border-brand-ink/12 bg-brand-paper text-brand-ink/70 hover:bg-brand-bone'
                    }`}
                  >
                    {t.label}
                    {esSugerida && ' · le toca hoy'}
                  </button>
                );
              })}
              {ocupado === 'plantilla' && <Loader2 size={14} className="animate-spin text-brand-ink/40 self-center" />}
            </div>
          )}
          {sugerida && (
            <p className="text-[11px] text-brand-ink/45 mt-2 leading-relaxed">
              Vista previa (pasa el cursor sobre otro nivel para verlo): {vistaPrevia(sugerida, hilo, factura)}
            </p>
          )}
        </div>

        {/* 2 · Respuesta libre con IA */}
        <div>
          <BlockTitle>2 · Respuesta personalizada (solo con la ventana abierta)</BlockTitle>
          {!ventana.open ? (
            <div className="mt-2 flex items-start gap-2 text-[12px] text-brand-ink/55">
              <Lock size={13} className="mt-0.5 shrink-0" />
              <span>
                El cliente no ha contestado en las últimas 24 horas. Cuando conteste o toque un botón de la plantilla, aquí
                podrás redactar con IA y enviar un mensaje personalizado.
              </span>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Escribe la respuesta o pide un borrador a la IA…"
                className="w-full text-[13px] leading-relaxed border border-brand-ink/12 rounded-2xl px-4 py-3 bg-brand-paper text-brand-ink focus:outline-none focus:border-brand-ink/30"
              />
              {borrador?.warnings.map((w) => (
                <p key={w} className="flex items-center gap-1.5 text-[11px] text-amber-700">
                  <AlertTriangle size={12} /> {w}
                </p>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={redactar}
                  disabled={!!ocupado}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-paper text-[12px] font-semibold text-brand-ink/75 hover:bg-brand-bone disabled:opacity-50"
                >
                  {ocupado === 'ia' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  Redactar con IA
                </button>
                <button
                  onClick={enviarTexto}
                  disabled={!!ocupado || !texto.trim() || hilo.customer.doNotContact}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 disabled:opacity-50"
                >
                  {ocupado === 'enviar' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Enviar
                </button>
                <span className="text-[11px] text-brand-ink/40">La IA solo propone; siempre lo envía una persona.</span>
              </div>
            </div>
          )}
        </div>

        {/* Solo en local: simular la respuesta del cliente sin Meta */}
        {import.meta.env.DEV && hilo.customer.phone && (
          <div className="pt-3 border-t border-dashed border-brand-ink/10 flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-ink/35">Prueba local</span>
            {['Ya pagué, comparto comprobante', 'Tengo una duda'].map((b) => (
              <button
                key={b}
                disabled={!!ocupado}
                onClick={() =>
                  correr('simular', async () => {
                    await api.simulateWaReplyDev(hilo.customer.phone!, b, 'button');
                    return `Simulado: el cliente tocó "${b}".`;
                  })
                }
                className="px-2.5 py-1.5 rounded-lg border border-dashed border-brand-ink/20 text-[11px] font-semibold text-brand-ink/55 hover:bg-brand-bone disabled:opacity-40"
              >
                Cliente toca “{b}”
              </button>
            ))}
            <button
              disabled={!!ocupado}
              onClick={() =>
                correr('simular', async () => {
                  await api.simulateWaReplyDev(hilo.customer.phone!, '¿Me pueden dar unos días más? La transferencia sale el viernes.', 'text');
                  return 'Simulado: el cliente escribió un mensaje.';
                })
              }
              className="px-2.5 py-1.5 rounded-lg border border-dashed border-brand-ink/20 text-[11px] font-semibold text-brand-ink/55 hover:bg-brand-bone disabled:opacity-40"
            >
              Cliente escribe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────

function VentanaBadge({ abierta, expira }: { abierta: boolean; expira: string | null }) {
  return abierta ? (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
      <Unlock size={12} /> Ventana abierta · cierra en {restante(expira)}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-bone border border-brand-ink/10 text-[11px] font-semibold text-brand-ink/55">
      <Clock size={12} /> Ventana cerrada · solo plantillas
    </span>
  );
}

function Aviso({ tono, texto }: { tono: 'info' | 'error'; texto: string }) {
  return (
    <div
      className={`text-[12px] rounded-xl px-3.5 py-2.5 border ${
        tono === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-sky-50 border-sky-200 text-sky-900'
      }`}
    >
      {texto}
    </div>
  );
}

/**
 * Nivel que le toca hoy a la factura, con la misma regla del motor: el de
 * mayor día que ya llegó, sin proponer niveles de día exacto si no es su día.
 */
function nivelSugerido(templates: WaTemplateInfo[], daysToDue: number | null): WaTemplateInfo | null {
  if (daysToDue == null) return null;
  const atraso = -daysToDue;
  const candidatas = templates
    .filter((t) => t.defaultDaysAfterDue <= atraso && (!t.exactDay || t.defaultDaysAfterDue === atraso))
    .sort((a, b) => b.defaultDaysAfterDue - a.defaultDaysAfterDue);
  return candidatas[0] ?? null;
}

function vistaPrevia(t: WaTemplateInfo, hilo: WaThread, factura: WaThread['invoices'][number] | null): string {
  const valores: Record<string, string> = {
    contacto: hilo.customer.contact ?? hilo.customer.name,
    folio: factura?.folio ?? '—',
    monto: factura ? `${MXN.format(factura.total)} ${factura.currency}` : '—',
    fecha: factura?.dueDate
      ? new Date(factura.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      : '—',
    liga: '(liga de pago)',
  };
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => valores[t.vars[Number(n) - 1]] ?? '');
}

function textoDias(d: number | null): string {
  if (d == null) return 'sin fecha';
  if (d > 0) return `vence en ${d} d`;
  if (d === 0) return 'vence hoy';
  return `vencida hace ${-d} d`;
}

function restante(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0 min';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
