import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { EASE } from './primitives.tsx';
import { planCuenta, useCobranza, type CuentaViva } from './store.tsx';
import { PLANTILLA_DE_PASO, cuandoPaso, FaseDot } from './plan.tsx';
import { api, type WaTemplateInfo, type WaThread } from '../../../../services/apiClient.ts';

/**
 * Subpestaña WhatsApp del expediente (DATOS REALES del backend). Sin nada que
 * elegir ni escribir: el plan del cliente dice en qué etapa va, y aquí solo
 * se genera el mensaje de esa etapa, se aprueba y se envía.
 *
 *   - El cliente no ha contestado → el mensaje es la plantilla aprobada por
 *     Meta de esa etapa (es lo único que WhatsApp permite como primer contacto).
 *   - El cliente contestó (ventana de 24h) → la IA redacta la respuesta.
 *
 * Lo que se envía marca la etapa como hecha y el plan pasa a la siguiente.
 */

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function SubWhatsapp({ cuenta }: { cuenta: CuentaViva }) {
  const { waClienteId } = useCobranza();
  const customerId = waClienteId(cuenta.cliente);

  if (customerId === undefined) return <Cargando />;
  if (customerId === null) {
    return (
      <Nota>
        Este cliente todavía no está en tu base de datos. Su conversación aparecerá aquí en cuanto se cargue tu cartera.
      </Nota>
    );
  }
  return <Conversacion customerId={customerId} cuenta={cuenta} />;
}

type Generado = { tipo: 'plantilla'; texto: string; plantilla: string } | { tipo: 'ia'; texto: string };

function Conversacion({ customerId, cuenta }: { customerId: string; cuenta: CuentaViva }) {
  const reduce = useReducedMotion();
  const { refrescarWhatsapp } = useCobranza();
  const [hilo, setHilo] = React.useState<WaThread | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [generado, setGenerado] = React.useState<Generado | null>(null);
  const [editando, setEditando] = React.useState(false);
  const [ocupado, setOcupado] = React.useState<null | 'generar' | 'enviar' | 'simular'>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const listaRef = React.useRef<HTMLDivElement>(null);

  const { actual, proxima } = planCuenta(cuenta);

  // Recarga el hilo y, con él, el plan de toda la cartera.
  const cargar = React.useCallback(async () => {
    try {
      const [h] = await Promise.all([api.getWaThread(customerId), refrescarWhatsapp()]);
      setHilo(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la conversación.');
    }
  }, [customerId, refrescarWhatsapp]);

  React.useEffect(() => {
    void cargar();
    // Las respuestas del cliente llegan por el webhook: se refresca solo.
    const t = setInterval(() => void cargar(), 15_000);
    return () => clearInterval(t);
  }, [cargar]);

  React.useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo?.messages.length]);

  if (error) return <Nota tono="error">{error}</Nota>;
  if (!hilo) return <Cargando />;

  const contesto = hilo.window.open;
  const plantillaHoy = actual ? PLANTILLA_DE_PASO[actual.id] : undefined;
  const factura = hilo.invoices.find((i) => i.folio === cuenta.folio) ?? hilo.invoices[0] ?? null;

  // ¿Hay algo que mandar hoy? (una sola regla, según el plan y si contestó)
  const motivoSinAccion = cuenta.saldada
    ? 'La cuenta está saldada: no hay nada que enviar.'
    : hilo.customer.doNotContact
      ? 'Este cliente pidió no ser contactado.'
      : !hilo.customer.phone
        ? 'No tiene teléfono de WhatsApp de finanzas. Agrégalo en Datos para poder escribirle.'
        : contesto
          ? null
          : !actual
            ? null // al día: se muestra la siguiente etapa, sin acción
            : !plantillaHoy
              ? `Esta etapa va por ${actual.canal.toLowerCase()}, no por WhatsApp.`
              : !factura
                ? 'No tiene facturas pendientes.'
                : null;
  const puedeActuar = !motivoSinAccion && (contesto || (!!actual && !!plantillaHoy));

  const correr = async (tipo: NonNullable<typeof ocupado>, fn: () => Promise<string | void>) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      const msg = await fn();
      if (msg) setAviso(msg);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Algo falló.');
    } finally {
      setOcupado(null);
    }
  };

  const generar = () =>
    correr('generar', async () => {
      if (contesto) {
        const d = await api.draftWaReply(customerId);
        setGenerado({ tipo: 'ia', texto: d.draft });
        setEditando(false);
        if (d.source === 'fallback') return 'La IA no está disponible en este entorno: se usó un mensaje base.';
        return;
      }
      const tpl = hilo.templates.find((t) => t.name === plantillaHoy);
      if (!tpl || !factura) return;
      setGenerado({ tipo: 'plantilla', plantilla: tpl.name, texto: vistaPrevia(tpl, hilo, factura) });
    });

  const aprobar = () =>
    correr('enviar', async () => {
      if (!generado) return;
      const r =
        generado.tipo === 'plantilla'
          ? await api.sendWaTemplate(customerId, factura!.id, generado.plantilla)
          : // Si la etapa de hoy no había salido, esta respuesta cuenta como su contacto.
            await api.sendWaText(customerId, generado.texto, plantillaHoy);
      setGenerado(null);
      setEditando(false);
      await cargar();
      return r.sent
        ? 'Enviado. El plan pasó a la siguiente etapa.'
        : 'Enviado en modo prueba (sin token de Meta no sale a WhatsApp). El plan pasó a la siguiente etapa.';
    });

  return (
    <div className="px-7 py-6 space-y-4">
      {/* 1 · En qué etapa va (sale del plan) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-brand-cream border border-brand-gold/30">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">Etapa del plan</div>
          {actual ? (
            <div className="flex items-center gap-2 mt-1">
              <FaseDot fase={actual.fase} />
              <span className="text-base font-semibold text-brand-ink">
                {actual.etiqueta} · {actual.nombre}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <Check size={15} className="text-emerald-600" />
              <span className="text-base font-semibold text-brand-ink">Al día</span>
            </div>
          )}
          <div className="text-[11px] text-brand-ink/50 mt-1">
            {actual
              ? cuandoPaso(actual.id, actual.dia)
              : proxima
                ? `Sigue ${proxima.etiqueta} (${proxima.nombre}) en ${proxima.faltan} ${proxima.faltan === 1 ? 'día' : 'días'}`
                : 'Ya no quedan etapas en el plan.'}
          </div>
        </div>
        <span
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
            contesto ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-brand-paper border-brand-ink/10 text-brand-ink/55'
          }`}
        >
          <MessageCircle size={12} />
          {contesto ? 'Contestó' : 'Esperando respuesta'}
        </span>
      </div>

      {/* 2 · La conversación */}
      <div
        ref={listaRef}
        className="rounded-2xl bg-brand-bone/50 border border-brand-ink/6 px-4 py-4 space-y-2.5 max-h-[320px] overflow-y-auto scrollbar-custom"
      >
        {hilo.messages.length === 0 ? (
          <p className="text-center text-[12px] text-brand-ink/40 py-6">Todavía no hay mensajes con este cliente.</p>
        ) : (
          hilo.messages.map((m) => {
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
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                    sale
                      ? 'bg-brand-ink text-brand-paper rounded-br-md'
                      : 'bg-brand-paper border border-brand-ink/8 text-brand-ink rounded-bl-md'
                  }`}
                >
                  {m.kind === 'BUTTON' && <p className="text-[10px] font-semibold text-brand-ink/45 mb-1">Tocó el botón</p>}
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${sale ? 'text-brand-paper/45' : 'text-brand-ink/35'}`}>
                    {hora(m.createdAt)}
                    {sale && etapaDe(m.templateName, hilo) && ` · ${etapaDe(m.templateName, hilo)}`}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {aviso && (
        <div className="flex items-start gap-2 text-[12px] rounded-xl px-3.5 py-2.5 border bg-sky-50 border-sky-200 text-sky-900">
          <Check size={13} className="mt-0.5 shrink-0" />
          {aviso}
        </div>
      )}

      {/* 3 · Generar → aprobar y enviar */}
      {motivoSinAccion ? (
        <p className="text-[12px] text-brand-ink/50">{motivoSinAccion}</p>
      ) : !puedeActuar ? (
        <p className="text-[12px] text-brand-ink/50">Nada que enviar hoy. Cuando llegue la siguiente etapa, aparecerá aquí.</p>
      ) : !generado ? (
        <button
          onClick={generar}
          disabled={!!ocupado}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[13px] font-semibold hover:bg-brand-ink/85 disabled:opacity-60"
        >
          {ocupado === 'generar' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {contesto ? 'Generar respuesta con IA' : 'Generar mensaje'}
        </button>
      ) : (
        <div className="rounded-2xl border border-brand-ink/12 bg-brand-paper px-4 py-4 space-y-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">
            {generado.tipo === 'plantilla' ? 'Mensaje de la etapa · plantilla aprobada por Meta' : 'Respuesta redactada con IA'}
          </div>
          {editando && generado.tipo === 'ia' ? (
            <textarea
              value={generado.texto}
              onChange={(e) => setGenerado({ tipo: 'ia', texto: e.target.value })}
              rows={4}
              maxLength={1000}
              className="w-full text-[13px] leading-relaxed border border-brand-ink/12 rounded-xl px-3 py-2.5 bg-brand-paper text-brand-ink outline-none focus:border-brand-gold/60"
            />
          ) : (
            <p className="text-[13px] text-brand-ink/80 leading-relaxed whitespace-pre-wrap">{generado.texto}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={aprobar}
              disabled={!!ocupado || !generado.texto.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[13px] font-semibold hover:bg-brand-ink/85 disabled:opacity-60"
            >
              {ocupado === 'enviar' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Aprobar y enviar
            </button>
            {generado.tipo === 'ia' && !editando && (
              <button onClick={() => setEditando(true)} className="px-3 py-2 text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink">
                Editar
              </button>
            )}
            <button
              onClick={() => {
                setGenerado(null);
                setEditando(false);
              }}
              className="px-3 py-2 text-[12px] font-semibold text-brand-ink/40 hover:text-brand-ink"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* Solo en local: simular que el cliente contesta (sin pasar por Meta) */}
      {import.meta.env.DEV && hilo.customer.phone && (
        <div className="pt-3 border-t border-dashed border-brand-ink/10 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-ink/30">Prueba local · el cliente</span>
          {[
            { label: 'contesta un botón', texto: 'Tengo una duda', kind: 'button' as const },
            { label: 'dice que ya pagó', texto: 'Ya pagué, comparto comprobante', kind: 'button' as const },
            { label: 'escribe', texto: '¿Me pueden dar unos días más? La transferencia sale el viernes.', kind: 'text' as const },
          ].map((s) => (
            <button
              key={s.label}
              disabled={!!ocupado}
              onClick={() =>
                correr('simular', async () => {
                  await api.simulateWaReplyDev(hilo.customer.phone!, s.texto, s.kind);
                  await cargar();
                })
              }
              className="px-2.5 py-1 rounded-lg border border-dashed border-brand-ink/20 text-[11px] font-semibold text-brand-ink/50 hover:bg-brand-bone disabled:opacity-40"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────

function Nota({ children, tono }: { children: React.ReactNode; tono?: 'error' }) {
  return <p className={`px-7 py-8 text-sm ${tono === 'error' ? 'text-rose-700' : 'text-brand-ink/45'}`}>{children}</p>;
}

function Cargando() {
  return (
    <div className="px-7 py-10 flex justify-center">
      <Loader2 size={16} className="animate-spin text-brand-ink/40" />
    </div>
  );
}

/** "Nivel 2" para un mensaje que salió a nombre de una etapa. */
function etapaDe(templateName: string | null, hilo: WaThread): string | null {
  if (!templateName) return null;
  const label = hilo.templates.find((t) => t.name === templateName)?.label;
  return label ? label.split(' · ')[0] : null;
}

function vistaPrevia(t: WaTemplateInfo, hilo: WaThread, factura: WaThread['invoices'][number]): string {
  const valores: Record<string, string> = {
    contacto: hilo.customer.contact ?? hilo.customer.name,
    folio: factura.folio,
    monto: `${MXN.format(factura.total)} ${factura.currency}`,
    fecha: factura.dueDate
      ? new Date(factura.dueDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })
      : '—',
    liga: '(liga de pago)',
  };
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => valores[t.vars[Number(n) - 1]] ?? '');
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
