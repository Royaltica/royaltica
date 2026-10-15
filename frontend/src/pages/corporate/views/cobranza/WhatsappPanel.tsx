import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, Clock, Loader2, Lock, Send, Sparkles, Unlock } from 'lucide-react';
import { EASE, BlockTitle } from './primitives.tsx';
import { planCuenta, useCobranza, type CuentaViva } from './store.tsx';
import { PLANTILLA_DE_PASO } from './plan.tsx';
import { api, type WaTemplateInfo, type WaThread, type WaDraft } from '../../../../services/apiClient.ts';

/**
 * Subpestaña WhatsApp del expediente de un cliente (DATOS REALES del
 * backend). No repite el plan: lo usa para preseleccionar la plantilla del
 * paso que le toca hoy, y cada envío/respuesta lo actualiza (el nivel queda
 * hecho y el plan pasa al siguiente). El flujo:
 *
 *   1. Primer contacto → plantilla aprobada por Meta del paso del plan.
 *   2. El cliente contesta o toca un botón → ventana de 24h abierta.
 *   3. Borrador con IA que una persona revisa y envía.
 */

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function SubWhatsapp({ cuenta }: { cuenta: CuentaViva }) {
  const { waClienteId } = useCobranza();
  const customerId = waClienteId(cuenta.cliente);

  if (customerId === undefined) return <Cargando />;
  if (customerId === null) {
    return (
      <p className="px-7 py-8 text-sm text-brand-ink/45">
        Este cliente todavía no está en tu base de datos, así que no tiene conversación de WhatsApp. Aparecerá aquí en
        cuanto se cargue tu cartera.
      </p>
    );
  }
  return <Conversacion customerId={customerId} cuenta={cuenta} />;
}

function Conversacion({ customerId, cuenta }: { customerId: string; cuenta: CuentaViva }) {
  const reduce = useReducedMotion();
  const { refrescarWhatsapp } = useCobranza();
  const [hilo, setHilo] = React.useState<WaThread | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [plantilla, setPlantilla] = React.useState<string | null>(null);
  const [texto, setTexto] = React.useState('');
  const [borrador, setBorrador] = React.useState<WaDraft | null>(null);
  const [ocupado, setOcupado] = React.useState<null | 'plantilla' | 'ia' | 'enviar' | 'simular'>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const listaRef = React.useRef<HTMLDivElement>(null);

  const { pasos, actual } = planCuenta(cuenta);
  // Pasos del plan que se pueden mandar por WhatsApp (los omitidos por la
  // regla del segmento no aparecen: el plan ya decidió no usarlos).
  const pasosWa = pasos.filter((p) => PLANTILLA_DE_PASO[p.id] && p.estado !== 'omitido');
  const sugerido =
    (actual && PLANTILLA_DE_PASO[actual.id] ? actual : pasosWa.find((p) => p.estado === 'programado')) ?? null;
  const sugeridoNombre = sugerido ? PLANTILLA_DE_PASO[sugerido.id] ?? null : null;

  // Recarga el hilo y, con él, el plan de toda la cartera (lo enviado o
  // respondido mueve el nivel del cliente).
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
    if (plantilla === null && sugeridoNombre) setPlantilla(sugeridoNombre);
  }, [plantilla, sugeridoNombre]);

  React.useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hilo?.messages.length]);

  if (error) return <div className="px-7 py-6"><Aviso tono="error" texto={error} /></div>;
  if (!hilo) return <Cargando />;

  // La factura del expediente (la del plan) si está pendiente; si no, la más antigua.
  const factura = hilo.invoices.find((i) => i.folio === cuenta.folio) ?? hilo.invoices[0] ?? null;
  const tpl = hilo.templates.find((t) => t.name === plantilla) ?? null;
  const bloqueado = hilo.customer.doNotContact || !hilo.customer.phone;

  const correr = async (tipo: NonNullable<typeof ocupado>, fn: () => Promise<string | void>) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      const msg = await fn();
      if (msg) setAviso(msg);
      await cargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Algo falló.');
    } finally {
      setOcupado(null);
    }
  };

  const enviarPlantilla = () =>
    correr('plantilla', async () => {
      if (!factura || !tpl) return 'Elige el paso del plan y verifica que haya una factura pendiente.';
      const r = await api.sendWaTemplate(customerId, factura.id, tpl.name);
      // El plan avanza: que se vuelva a sugerir el nivel que sigue.
      setPlantilla(null);
      return r.sent
        ? 'Plantilla enviada.'
        : `Quedó registrada, pero no salió a WhatsApp (modo ${r.mode}: falta el token de Meta en este entorno).`;
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
      // Si el nivel de hoy no ha salido, este mensaje cuenta como su contacto.
      const nivelHoy = actual ? PLANTILLA_DE_PASO[actual.id] : undefined;
      const r = await api.sendWaText(customerId, texto, nivelHoy);
      setTexto('');
      setBorrador(null);
      return r.sent ? 'Mensaje enviado.' : `Quedó registrado, pero no salió a WhatsApp (modo ${r.mode}).`;
    });

  return (
    <div className="px-7 py-6 space-y-5">
      {/* Estado de la conversación */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-brand-ink/50">
          {hilo.customer.contact ? `${hilo.customer.contact} · ` : ''}
          {hilo.customer.phone ?? 'Sin teléfono de WhatsApp'}
        </p>
        <VentanaBadge abierta={hilo.window.open} expira={hilo.window.expiresAt} />
      </div>

      {hilo.customer.doNotContact && (
        <Aviso tono="error" texto="Este cliente pidió no ser contactado (lista de exclusión). No se le puede escribir." />
      )}
      {aviso && <Aviso tono="info" texto={aviso} />}

      {/* Mensajes */}
      <div
        ref={listaRef}
        className="rounded-2xl bg-brand-bone/50 border border-brand-ink/6 px-4 py-4 space-y-2.5 max-h-[340px] overflow-y-auto scrollbar-custom"
      >
        {hilo.messages.length === 0 ? (
          <p className="text-center text-[12px] text-brand-ink/40 py-8">
            Sin mensajes todavía. El primer contacto siempre es la plantilla del paso del plan.
          </p>
        ) : (
          hilo.messages.map((m) => {
            const sale = m.direction === 'OUTBOUND';
            const etiqueta =
              m.kind === 'TEMPLATE'
                ? `Plantilla · ${hilo.templates.find((t) => t.name === m.templateName)?.label ?? m.templateName}`
                : m.kind === 'BUTTON'
                  ? 'Tocó un botón'
                  : m.kind === 'MEDIA'
                    ? 'Archivo'
                    : null;
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
                  {etiqueta && (
                    <p
                      className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${
                        sale ? 'text-brand-paper/55' : 'text-brand-ink/45'
                      }`}
                    >
                      {etiqueta}
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
          })
        )}
      </div>

      {/* Contestó (ventana abierta) → respuesta personalizada; si no → plantilla del plan */}
      {hilo.window.open ? (
        <div className="space-y-2">
          <BlockTitle>Responder</BlockTitle>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Escribe la respuesta o pide un borrador a la IA…"
            className="w-full text-[13px] leading-relaxed border border-brand-ink/12 rounded-2xl px-4 py-3 bg-brand-paper text-brand-ink outline-none focus:border-brand-gold/60"
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
              disabled={!!ocupado || !texto.trim() || bloqueado}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 disabled:opacity-50"
            >
              {ocupado === 'enviar' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Enviar
            </button>
            <span className="text-[11px] text-brand-ink/40">La IA propone; tú decides qué se envía.</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <BlockTitle>Recordatorio según el plan</BlockTitle>
          {pasosWa.length === 0 || !factura ? (
            <p className="text-[12px] text-brand-ink/45">
              {!factura ? 'Sin facturas pendientes.' : 'El plan de este cliente no tiene pasos por WhatsApp.'}
            </p>
          ) : (
            <>
              {actual && !PLANTILLA_DE_PASO[actual.id] && (
                <p className="text-[12px] text-brand-ink/55">
                  Hoy le toca {actual.etiqueta} ({actual.nombre}), que va por {actual.canal.toLowerCase()}. Por WhatsApp
                  solo aplican los pasos con plantilla.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {pasosWa.map((p) => {
                  const nombre = PLANTILLA_DE_PASO[p.id]!;
                  const elegido = plantilla === nombre;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPlantilla(nombre)}
                      aria-pressed={elegido}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        elegido
                          ? 'bg-brand-ink text-brand-paper border-brand-ink'
                          : p.estado === 'actual'
                            ? 'bg-brand-gold/15 border-brand-gold text-brand-ink'
                            : 'border-brand-ink/12 bg-brand-paper text-brand-ink/60 hover:bg-brand-bone'
                      }`}
                    >
                      {p.etiqueta}
                      <span className={elegido ? 'text-brand-paper/60' : 'text-brand-ink/40'}>
                        {' · '}
                        {p.estado === 'actual' ? 'hoy' : p.estado === 'hecho' ? 'hecho' : `en ${p.faltan} d`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {tpl && (
                <div className="rounded-2xl border border-brand-ink/10 px-4 py-3">
                  <p className="text-[13px] text-brand-ink/75 leading-relaxed">{vistaPrevia(tpl, hilo, factura)}</p>
                  {tpl.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {tpl.buttons.map((b) => (
                        <span key={b} className="px-2 py-1 rounded-lg bg-brand-bone text-[11px] font-semibold text-sky-800">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={enviarPlantilla}
                  disabled={!!ocupado || !tpl || bloqueado}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 disabled:opacity-50"
                >
                  {ocupado === 'plantilla' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Enviar plantilla
                </button>
                <span className="flex items-center gap-1.5 text-[11px] text-brand-ink/40">
                  <Lock size={11} /> Cuando conteste, podrás responder con un mensaje personalizado.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Solo en local: simula la respuesta del cliente sin pasar por Meta */}
      {import.meta.env.DEV && hilo.customer.phone && (
        <div className="pt-3 border-t border-dashed border-brand-ink/10 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-ink/35">Prueba local</span>
          {(tpl?.buttons.length ? tpl.buttons : ['Tengo una duda']).map((b) => (
            <BotonSimular
              key={b}
              disabled={!!ocupado}
              onClick={() =>
                correr('simular', async () => {
                  await api.simulateWaReplyDev(hilo.customer.phone!, b, 'button');
                  return `Simulado: el cliente tocó "${b}".`;
                })
              }
            >
              Toca “{b}”
            </BotonSimular>
          ))}
          <BotonSimular
            disabled={!!ocupado}
            onClick={() =>
              correr('simular', async () => {
                await api.simulateWaReplyDev(
                  hilo.customer.phone!,
                  '¿Me pueden dar unos días más? La transferencia sale el viernes.',
                  'text',
                );
                return 'Simulado: el cliente escribió un mensaje.';
              })
            }
          >
            Escribe un mensaje
          </BotonSimular>
        </div>
      )}
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────

function BotonSimular({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="px-2.5 py-1.5 rounded-lg border border-dashed border-brand-ink/20 text-[11px] font-semibold text-brand-ink/55 hover:bg-brand-bone disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function VentanaBadge({ abierta, expira }: { abierta: boolean; expira: string | null }) {
  return abierta ? (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
      <Unlock size={12} /> Contestó · puedes responder {restante(expira)}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-bone border border-brand-ink/10 text-[11px] font-semibold text-brand-ink/55">
      <Clock size={12} /> Esperando respuesta · solo plantillas
    </span>
  );
}

function Aviso({ tono, texto }: { tono: 'info' | 'error'; texto: string }) {
  return (
    <div
      className={`flex items-start gap-2 text-[12px] rounded-xl px-3.5 py-2.5 border ${
        tono === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-sky-50 border-sky-200 text-sky-900'
      }`}
    >
      {tono === 'info' && <Check size={13} className="mt-0.5 shrink-0" />}
      {texto}
    </div>
  );
}

function Cargando() {
  return (
    <div className="px-7 py-10 flex justify-center">
      <Loader2 size={16} className="animate-spin text-brand-ink/40" />
    </div>
  );
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

/** "por 23 h", "por 40 min": cuánto queda de la ventana de 24h. */
function restante(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  return h > 0 ? `por ${h} h` : `por ${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function hora(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
