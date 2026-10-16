import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import { EASE } from './primitives.tsx';
import { planCuenta, useCobranza, type CuentaViva } from './store.tsx';
import { PLANTILLA_DE_PASO, cuandoPaso, FaseDot } from './plan.tsx';
import { api, type WaTemplateInfo, type WaThread } from '../../../../services/apiClient.ts';

/**
 * Subpestaña WhatsApp del expediente (DATOS REALES del backend). La usan
 * igual el Administrador y el Agente. Sin nada que elegir ni escribir:
 *
 *   1. Cada etapa nueva del plan empieza con SU plantilla aprobada por Meta,
 *      ya lista: solo se aprueba y se envía.
 *   2. Cuando el cliente contesta (ventana de 24h), la IA redacta la
 *      respuesta; se aprueba y se envía.
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

function Conversacion({ customerId, cuenta }: { customerId: string; cuenta: CuentaViva }) {
  const reduce = useReducedMotion();
  const { refrescarWhatsapp, envioAutomatico } = useCobranza();
  const [hilo, setHilo] = React.useState<WaThread | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [respuesta, setRespuesta] = React.useState<string | null>(null);
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
  const factura = hilo.invoices.find((i) => i.folio === cuenta.folio) ?? hilo.invoices[0] ?? null;
  // La etapa de hoy sigue pendiente (no ha salido) y va por WhatsApp → su plantilla primero.
  const plantillaHoy = actual ? hilo.templates.find((t) => t.name === PLANTILLA_DE_PASO[actual.id]) : undefined;

  const bloqueo = cuenta.saldada
    ? 'La cuenta está saldada: no hay nada que enviar.'
    : hilo.customer.doNotContact
      ? 'Este cliente pidió no ser contactado.'
      : !hilo.customer.phone
        ? 'No tiene teléfono de WhatsApp de finanzas. Agrégalo en Datos para poder escribirle.'
        : null;

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

  const resultado = (sent: boolean) =>
    sent
      ? 'Enviado. El plan pasó a la siguiente etapa.'
      : 'Enviado en modo prueba (sin token de Meta no sale a WhatsApp). El plan pasó a la siguiente etapa.';

  const enviarPlantilla = () =>
    correr('enviar', async () => {
      if (!plantillaHoy || !factura) return;
      const r = await api.sendWaTemplate(customerId, factura.id, plantillaHoy.name);
      await cargar();
      return resultado(r.sent);
    });

  const generarRespuesta = () =>
    correr('generar', async () => {
      const d = await api.draftWaReply(customerId);
      setRespuesta(d.draft);
      setEditando(false);
      if (d.source === 'fallback') return 'La IA no está disponible en este entorno: se usó un mensaje base.';
    });

  const enviarRespuesta = () =>
    correr('enviar', async () => {
      if (!respuesta) return;
      const r = await api.sendWaText(customerId, respuesta);
      setRespuesta(null);
      setEditando(false);
      await cargar();
      return r.sent ? 'Respuesta enviada.' : 'Respuesta enviada en modo prueba (sin token de Meta no sale a WhatsApp).';
    });

  return (
    <div className="px-7 py-6 space-y-5">
      {/* 1 · En qué etapa va (sale del plan) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-brand-cream border border-brand-gold/30">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">Etapa del plan</div>
          <div className="flex items-center gap-2 mt-1">
            {actual ? <FaseDot fase={actual.fase} /> : <Check size={15} className="text-emerald-600" />}
            <span className="text-base font-semibold text-brand-ink">
              {actual ? `${actual.etiqueta} · ${actual.nombre}` : 'Al día'}
            </span>
          </div>
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
          {contesto ? 'Contestó' : 'Sin respuesta'}
        </span>
      </div>

      {/* 2 · Lo que toca hacer (una sola cosa a la vez) */}
      {aviso && (
        <div className="flex items-start gap-2 text-[12px] rounded-xl px-3.5 py-2.5 border bg-sky-50 border-sky-200 text-sky-900">
          <Check size={13} className="mt-0.5 shrink-0" />
          {aviso}
        </div>
      )}

      {bloqueo ? (
        <Linea>{bloqueo}</Linea>
      ) : actual && plantillaHoy && factura ? (
        // Etapa nueva: primero SU plantilla, ya lista.
        <Tarjeta titulo={`Plantilla de ${actual.etiqueta} · lista para enviar`}>
          <p className="text-[13px] text-brand-ink/80 leading-relaxed whitespace-pre-wrap">
            {vistaPrevia(plantillaHoy, hilo, factura)}
          </p>
          {plantillaHoy.buttons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plantillaHoy.buttons.map((b) => (
                <span key={b} className="px-2 py-1 rounded-lg bg-brand-bone text-[11px] font-semibold text-sky-800">
                  {b}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Boton onClick={enviarPlantilla} cargando={ocupado === 'enviar'} disabled={!!ocupado} icono={<Send size={14} />}>
              Aprobar y enviar
            </Boton>
            {envioAutomatico && (
              <span className="text-[11px] text-brand-ink/45">Si no la envías, sale sola en el próximo envío automático (11:00).</span>
            )}
          </div>
        </Tarjeta>
      ) : actual && !plantillaHoy && !contesto ? (
        <Linea>Esta etapa va por {actual.canal.toLowerCase()}, no por WhatsApp.</Linea>
      ) : contesto ? (
        // Ya contestó: ahora sí, respuesta personalizada con IA.
        respuesta === null ? (
          <Boton onClick={generarRespuesta} cargando={ocupado === 'generar'} disabled={!!ocupado} icono={<Sparkles size={14} />}>
            Generar respuesta con IA
          </Boton>
        ) : (
          <Tarjeta titulo="Respuesta redactada con IA">
            {editando ? (
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full text-[13px] leading-relaxed border border-brand-ink/12 rounded-xl px-3 py-2.5 bg-brand-paper text-brand-ink outline-none focus:border-brand-gold/60"
              />
            ) : (
              <p className="text-[13px] text-brand-ink/80 leading-relaxed whitespace-pre-wrap">{respuesta}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Boton
                onClick={enviarRespuesta}
                cargando={ocupado === 'enviar'}
                disabled={!!ocupado || !respuesta.trim()}
                icono={<Send size={14} />}
              >
                Aprobar y enviar
              </Boton>
              {!editando && (
                <button onClick={() => setEditando(true)} className="px-3 py-2 text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink">
                  Editar
                </button>
              )}
              <button
                onClick={() => {
                  setRespuesta(null);
                  setEditando(false);
                }}
                className="px-3 py-2 text-[12px] font-semibold text-brand-ink/40 hover:text-brand-ink"
              >
                Descartar
              </button>
            </div>
          </Tarjeta>
        )
      ) : (
        <Linea>
          {actual
            ? 'Mensaje de esta etapa enviado. Esperando respuesta del cliente.'
            : 'Nada que enviar hoy. Cuando llegue la siguiente etapa, su plantilla aparecerá aquí.'}
        </Linea>
      )}

      {/* 3 · La conversación */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">Conversación</div>
        <div
          ref={listaRef}
          className="rounded-2xl bg-brand-bone/50 border border-brand-ink/6 px-4 py-4 space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-custom"
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
      </div>

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

/**
 * Solo Administrador: cómo salen los recordatorios del plan. Pensado para la
 * empresa pequeña donde una persona hace todo (automático) o la que prefiere
 * revisar cada mensaje antes de que salga (con aprobación).
 */
export function ModoEnvio() {
  const { envioAutomatico, cambiarEnvioAutomatico } = useCobranza();
  const [guardando, setGuardando] = React.useState(false);
  if (envioAutomatico === undefined || envioAutomatico === null) return null;

  const opciones = [
    { auto: false, titulo: 'Con mi aprobación', texto: 'Cada plantilla espera a que la apruebes en el WhatsApp del cliente.' },
    { auto: true, titulo: 'Automáticos', texto: 'Las plantillas de cada etapa salen solas cada mañana (11:00).' },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 rounded-3xl bg-brand-paper border border-brand-ink/10">
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">Recordatorios por WhatsApp</div>
        <p className="text-[12px] text-brand-ink/55 mt-1">
          {opciones.find((o) => o.auto === envioAutomatico)!.texto}
        </p>
      </div>
      <div className="flex p-1 rounded-xl bg-brand-bone border border-brand-ink/8" role="radiogroup" aria-label="Modo de envío">
        {opciones.map((o) => {
          const activo = envioAutomatico === o.auto;
          return (
            <button
              key={o.titulo}
              role="radio"
              aria-checked={activo}
              disabled={guardando}
              onClick={async () => {
                if (activo) return;
                setGuardando(true);
                try {
                  await cambiarEnvioAutomatico(o.auto);
                } finally {
                  setGuardando(false);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                activo ? 'bg-brand-ink text-brand-paper' : 'text-brand-ink/55 hover:text-brand-ink'
              }`}
            >
              {o.titulo}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-ink/12 bg-brand-paper px-4 py-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{titulo}</div>
      {children}
    </div>
  );
}

function Boton({
  children,
  icono,
  cargando,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icono: React.ReactNode; cargando: boolean }) {
  return (
    <button
      {...props}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[13px] font-semibold hover:bg-brand-ink/85 disabled:opacity-60"
    >
      {cargando ? <Loader2 size={14} className="animate-spin" /> : icono}
      {children}
    </button>
  );
}

function Linea({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-brand-ink/55 px-1">{children}</p>;
}

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
