import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BadgeCheck,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Hand,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from 'lucide-react';
import { planCuenta, useCobranza, type CuentaViva } from './store.tsx';
import { PLANTILLA, PLANTILLA_DE_PASO, cuandoPaso, FaseDot } from './plan.tsx';
import { SPRING } from './campanasUi.tsx';
import { api, type WaMessage, type WaSendResult, type WaTemplateInfo, type WaThread } from '../../../../services/apiClient.ts';

/**
 * Subpestaña WhatsApp del expediente. Se ve y se usa como un chat:
 *
 *   1. Arriba, en una línea: en qué etapa va y si el cliente contestó.
 *   2. En medio, la conversación.
 *   3. Abajo, lo único que toca hacer:
 *      · etapa nueva → su plantilla aprobada por Meta, lista para Mandar;
 *      · el cliente contestó → la IA redacta un borrador: Aprobar y luego Mandar
 *        (o escribir uno propio y mandarlo).
 *
 * Con datos de ejemplo todo se simula en pantalla, sin enviar nada.
 */

const MXN = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export function SubWhatsapp({ cuenta }: { cuenta: CuentaViva }) {
  const { waClienteId, refrescarWhatsapp, fuente } = useCobranza();
  const customerId = waClienteId(cuenta.cliente);
  const [reintentando, setReintentando] = React.useState(false);

  // Sin cartera real: conversación de ejemplo para conocer el flujo.
  if (fuente === 'ejemplo') return <Conversacion key={cuenta.id} demo cuenta={cuenta} customerId={null} />;
  if (customerId === undefined) return <Cargando />;
  if (customerId === 'error') {
    return (
      <div className="px-7 py-10 flex flex-col items-center text-center gap-4">
        <span className="w-12 h-12 rounded-2xl bg-brand-ink/[0.05] text-brand-ink/45 flex items-center justify-center">
          <MessageCircle size={20} />
        </span>
        <p className="text-[13px] text-brand-ink/55 max-w-[44ch] leading-relaxed">
          No se pudo conectar con el servidor, así que la conversación no cargó. Revisa que el backend esté encendido.
        </p>
        <button
          type="button"
          onClick={async () => {
            setReintentando(true);
            await refrescarWhatsapp();
            setReintentando(false);
          }}
          disabled={reintentando}
          className={BTN_CHAT_SEC}
        >
          {reintentando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reintentar
        </button>
      </div>
    );
  }
  if (customerId === null) {
    return <Nota>Este cliente todavía no está en tu base de datos. Su conversación aparecerá aquí en cuanto se cargue tu cartera.</Nota>;
  }
  return <Conversacion key={customerId} cuenta={cuenta} customerId={customerId} />;
}

type Borrador = { texto: string; estado: 'borrador' | 'aprobado'; origen: 'ia' | 'base' };
type Ocupado = null | 'redactar' | 'mandar' | 'simular';

function Conversacion({ customerId, cuenta, demo = false }: { key?: string; customerId: string | null; cuenta: CuentaViva; demo?: boolean }) {
  const reduce = useReducedMotion();
  const { refrescarWhatsapp, envioAutomatico } = useCobranza();
  const [hilo, setHilo] = React.useState<WaThread | null>(() => (demo ? hiloDeEjemplo(cuenta) : null));
  const [error, setError] = React.useState<string | null>(null);
  const [borrador, setBorrador] = React.useState<Borrador | null>(null);
  const [editando, setEditando] = React.useState(false);
  const [propio, setPropio] = React.useState('');
  const [ocupado, setOcupado] = React.useState<Ocupado>(null);
  const [aviso, setAviso] = React.useState<{ texto: string; error?: boolean } | null>(null);
  // Con datos de ejemplo la plantilla del día se marca enviada aquí mismo.
  const [plantillasDemo, setPlantillasDemo] = React.useState<string[]>([]);
  const listaRef = React.useRef<HTMLDivElement>(null);

  const { actual, proxima } = planCuenta(cuenta);

  const cargar = React.useCallback(async () => {
    if (demo || !customerId) return;
    try {
      const [h] = await Promise.all([api.getWaThread(customerId), refrescarWhatsapp()]);
      setHilo(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la conversación.');
    }
  }, [customerId, demo, refrescarWhatsapp]);

  React.useEffect(() => {
    if (demo) return;
    void cargar();
    // Las respuestas del cliente llegan por el webhook: se refresca solo.
    const t = setInterval(() => void cargar(), 15_000);
    return () => clearInterval(t);
  }, [cargar, demo]);

  React.useEffect(() => {
    const el = listaRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [hilo?.messages.length, borrador?.estado, borrador?.texto, reduce]);

  // El aviso se va solo.
  React.useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (error) return <Nota tono="error">{error}</Nota>;
  if (!hilo) return <Cargando />;

  const contesto = hilo.window.open;
  const factura = hilo.invoices.find((i) => i.folio === cuenta.folio) ?? hilo.invoices[0] ?? null;
  const nombrePlantilla = actual ? PLANTILLA_DE_PASO[actual.id] : undefined;
  const plantillaHoy =
    nombrePlantilla && !plantillasDemo.includes(nombrePlantilla) ? hilo.templates.find((t) => t.name === nombrePlantilla) : undefined;
  const horasVentana = hilo.window.expiresAt ? Math.max(0, Math.ceil((+new Date(hilo.window.expiresAt) - Date.now()) / 3_600_000)) : null;

  const bloqueo = cuenta.saldada
    ? 'La cuenta está saldada: no hay nada que mandar.'
    : !cuenta.contactable
      ? `Contacto en pausa${cuenta.motivo ? ` (${cuenta.motivo})` : ''}. Reanúdalo para volver a escribirle.`
      : hilo.customer.doNotContact
        ? 'Este cliente pidió no ser contactado.'
        : !hilo.customer.phone
          ? 'Falta el WhatsApp de finanzas. Agrégalo en Datos para poder escribirle.'
          : null;

  const correr = async (tipo: NonNullable<Ocupado>, fn: () => Promise<string | void>) => {
    setOcupado(tipo);
    setAviso(null);
    try {
      const msg = await fn();
      if (msg) setAviso({ texto: msg });
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'Algo falló.', error: true });
    } finally {
      setOcupado(null);
    }
  };

  const resultado = ({ sent, mode, error }: Pick<WaSendResult, 'sent' | 'mode' | 'error'>) => {
    if (sent) return 'Mandado. El plan pasó a la siguiente etapa.';
    if (mode === 'stub') return 'Modo prueba: no salió a WhatsApp porque faltan las credenciales de Meta.';
    if (mode === 'meta') {
      return error
        ? `No salió a WhatsApp y el plan no avanzó. ${error.message}${error.code ? ` (código ${error.code})` : ''}`
        : 'No se pudo conectar con Meta. No salió a WhatsApp; intenta de nuevo en un momento.';
    }
    return 'El proveedor de WhatsApp rechazó el envío. No salió y el plan no avanzó.';
  };

  // Con datos de ejemplo: se agrega el mensaje al chat y listo.
  const agregarDemo = (m: Omit<WaMessage, 'id' | 'createdAt' | 'sent' | 'sentByUserId'>, abrirVentana = false) =>
    setHilo((h) =>
      h && {
        ...h,
        window: abrirVentana
          ? { open: true, lastInboundAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString() }
          : h.window,
        messages: [...h.messages, { ...m, id: `demo-${Date.now()}`, createdAt: new Date().toISOString(), sent: true, sentByUserId: null }],
      },
    );

  const mandarPlantilla = () =>
    correr('mandar', async () => {
      if (!plantillaHoy || !factura) return;
      if (demo) {
        agregarDemo({ direction: 'OUTBOUND', kind: 'TEMPLATE', body: vistaPrevia(plantillaHoy, hilo, factura), templateName: plantillaHoy.name });
        setPlantillasDemo((p) => [...p, plantillaHoy.name]);
        return 'Ejemplo: así se vería mandado. Con tu cartera real sale por WhatsApp.';
      }
      const r = await api.sendWaTemplate(customerId!, factura.id, plantillaHoy.name);
      await cargar();
      return resultado(r);
    });

  const redactar = () =>
    correr('redactar', async () => {
      setEditando(false);
      if (demo) {
        await new Promise((r) => setTimeout(r, 650));
        setBorrador({ texto: borradorDeEjemplo(hilo, factura), estado: 'borrador', origen: 'ia' });
        return;
      }
      const d = await api.draftWaReply(customerId!);
      setBorrador({ texto: d.draft, estado: 'borrador', origen: d.source === 'ai' ? 'ia' : 'base' });
      if (d.source === 'fallback') return 'La IA no está disponible en este entorno: se usó un mensaje base.';
    });

  const mandarTexto = (texto: string, alTerminar: () => void) =>
    correr('mandar', async () => {
      const t = texto.trim();
      if (!t) return;
      if (demo) {
        agregarDemo({ direction: 'OUTBOUND', kind: 'TEXT', body: t, templateName: null });
        alTerminar();
        return 'Ejemplo: así se vería mandado. Con tu cartera real sale por WhatsApp.';
      }
      const r = await api.sendWaText(customerId!, t);
      alTerminar();
      await cargar();
      return resultado(r);
    });

  const simular = (texto: string, kind: 'button' | 'text') =>
    correr('simular', async () => {
      if (demo) {
        agregarDemo({ direction: 'INBOUND', kind: kind === 'button' ? 'BUTTON' : 'TEXT', body: texto, templateName: null }, true);
        return;
      }
      await api.simulateWaReplyDev(hilo.customer.phone!, texto, kind);
      await cargar();
    });

  const pasoVista = actual ?? proxima;
  const contacto = hilo.customer.contact ?? cuenta.finanzas?.nombre ?? hilo.customer.name;

  return (
    <div className="px-5 sm:px-7 py-6 space-y-4 max-w-[960px]">
      {/* 1 · Estado en una línea */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full glass-suave px-3 py-1.5 text-[12px] text-brand-ink/70">
          {actual ? <FaseDot fase={actual.fase} /> : <Check size={12} className="text-emerald-600" />}
          <span className="font-semibold text-brand-ink">{actual ? `${actual.etiqueta} · ${actual.nombre}` : 'Al día'}</span>
          <span className="text-brand-ink/40">
            {actual
              ? cuandoPaso(actual.id, actual.dia)
              : proxima
                ? `sigue ${proxima.etiqueta} en ${proxima.faltan} ${proxima.faltan === 1 ? 'día' : 'días'}`
                : 'sin etapas pendientes'}
          </span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
            contesto ? 'bg-emerald-500/12 text-emerald-800' : 'bg-brand-ink/[0.05] text-brand-ink/50'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${contesto ? 'bg-emerald-500 animate-pulse' : 'bg-brand-ink/25'}`} />
          {contesto ? `Contestó · puedes escribirle ${horasVentana !== null ? `${horasVentana} h más` : ''}` : 'Sin respuesta'}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-brand-ink/45">
          {envioAutomatico ? <Bot size={13} /> : <Hand size={13} />}
          {envioAutomatico ? 'Envío automático 11:00' : 'Con tu aprobación'}
        </span>
      </div>

      {/* 2 · El chat */}
      <div className="rounded-[26px] overflow-hidden ring-1 ring-brand-ink/[0.07] bg-white/50 shadow-[0_18px_40px_-28px_rgba(17,24,39,0.35)]">
        {/* Cabecera del chat */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-brand-ink/[0.06] bg-white/60">
          <Inicial nombre={contacto} />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-brand-ink truncate">{contacto}</div>
            <div className="text-[11.5px] text-brand-ink/45 truncate">
              {hilo.customer.phone ?? 'Sin WhatsApp'}
              {cuenta.finanzas?.puesto ? ` · ${cuenta.finanzas.puesto}` : ''} · {hilo.customer.name}
            </div>
          </div>
          {demo && <span className="rounded-full bg-amber-500/12 text-amber-800 px-2.5 py-1 text-[10.5px] font-semibold">Ejemplo</span>}
        </div>

        {/* Mensajes */}
        <div
          ref={listaRef}
          className="relative h-[380px] overflow-y-auto scrollbar-custom px-4 sm:px-6 py-5 space-y-2 bg-[radial-gradient(circle_at_1px_1px,rgb(17_24_39/0.045)_1px,transparent_0)] [background-size:18px_18px]"
        >
          {hilo.messages.length === 0 && !borrador && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2">
              <MessageCircle size={22} className="text-brand-ink/25" />
              <p className="text-[12.5px] text-brand-ink/45">Todavía no hay mensajes con este cliente.</p>
            </div>
          )}
          {hilo.messages.map((m, i) => {
            const previo = hilo.messages[i - 1];
            const nuevoDia = !previo || dia(previo.createdAt) !== dia(m.createdAt);
            return (
              <React.Fragment key={m.id}>
                {nuevoDia && (
                  <div className="flex justify-center py-1.5">
                    <span className="rounded-full bg-white/80 ring-1 ring-brand-ink/[0.06] px-3 py-1 text-[10.5px] font-semibold text-brand-ink/45">
                      {dia(m.createdAt)}
                    </span>
                  </div>
                )}
                <BurbujaChat m={m} etapa={etapaDe(m.templateName, hilo)} reduce={reduce} />
              </React.Fragment>
            );
          })}

          {/* Borrador de la IA: se ve donde va a quedar, del lado de lo que mandas */}
          <AnimatePresence>
            {borrador && (
              <motion.div
                key="borrador"
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
                transition={SPRING}
                className="flex justify-end pt-1"
              >
                <div
                  className={`w-full max-w-[86%] rounded-[20px] rounded-br-md px-4 py-3 ring-1 transition-colors ${
                    borrador.estado === 'aprobado'
                      ? 'bg-emerald-50/90 ring-emerald-300/70'
                      : 'bg-cyan-50/90 ring-cyan-300/70 [box-shadow:0_0_0_4px_rgb(6_182_212/0.08)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
                    {borrador.estado === 'aprobado' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <BadgeCheck size={12} /> Aprobado · listo para mandar
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-cyan-700">
                        <Sparkles size={12} /> {borrador.origen === 'ia' ? 'Redactado con IA' : 'Mensaje base'} · por aprobar
                      </span>
                    )}
                  </div>
                  {editando ? (
                    <textarea
                      autoFocus
                      value={borrador.texto}
                      onChange={(e) => setBorrador({ ...borrador, texto: e.target.value, estado: 'borrador' })}
                      rows={4}
                      maxLength={1000}
                      className="w-full text-[13px] leading-relaxed glass-campo rounded-2xl px-3 py-2 text-brand-ink outline-none resize-none"
                    />
                  ) : (
                    <p className="text-[13px] leading-relaxed text-brand-ink/85 whitespace-pre-wrap">{borrador.texto}</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3 · Lo que toca hacer */}
        <div className="border-t border-brand-ink/[0.06] bg-white/70 px-4 sm:px-5 py-3.5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={bloqueo ? 'bloqueo' : borrador ? `borrador-${borrador.estado}-${editando}` : plantillaHoy ? 'plantilla' : contesto ? 'escribir' : 'espera'}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {bloqueo ? (
                <PieInfo icono={<Lock size={14} />}>{bloqueo}</PieInfo>
              ) : borrador ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => { setBorrador(null); setEditando(false); }} className={BTN_CHAT_FANTASMA} title="Descartar borrador">
                    <X size={13} /> Descartar
                  </button>
                  <button type="button" onClick={redactar} disabled={!!ocupado} className={BTN_CHAT_FANTASMA}>
                    {ocupado === 'redactar' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Otra versión
                  </button>
                  <button type="button" onClick={() => setEditando((e) => !e)} className={BTN_CHAT_FANTASMA}>
                    {editando ? <Check size={13} /> : <Pencil size={13} />} {editando ? 'Listo' : 'Editar'}
                  </button>
                  <span className="flex-1" />
                  {borrador.estado === 'borrador' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(false);
                        setBorrador({ ...borrador, estado: 'aprobado' });
                      }}
                      disabled={!borrador.texto.trim()}
                      className={BTN_CHAT_APROBAR}
                    >
                      <ThumbsUp size={14} /> Aprobar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBorrador({ ...borrador, estado: 'borrador' })}
                      className={BTN_CHAT_FANTASMA}
                      title="Quitar la aprobación"
                    >
                      <BadgeCheck size={13} className="text-emerald-600" /> Aprobado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void mandarTexto(borrador.texto, () => setBorrador(null))}
                    disabled={borrador.estado !== 'aprobado' || !!ocupado}
                    title={borrador.estado !== 'aprobado' ? 'Apruébalo primero' : undefined}
                    className={BTN_CHAT_MANDAR}
                  >
                    {ocupado === 'mandar' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandar
                  </button>
                </div>
              ) : plantillaHoy && factura && actual ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-brand-ink">Plantilla de {actual.etiqueta} lista</div>
                    <div className="text-[11.5px] text-brand-ink/45">
                      Aprobada por Meta.{envioAutomatico ? ' Si no la mandas, sale sola a las 11:00.' : ' Sale solo cuando la mandes.'}
                    </div>
                  </div>
                  <button type="button" onClick={mandarPlantilla} disabled={!!ocupado} className={BTN_CHAT_MANDAR}>
                    {ocupado === 'mandar' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Mandar
                  </button>
                </div>
              ) : contesto ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mandarTexto(propio, () => setPropio(''));
                  }}
                  className="flex items-end gap-2"
                >
                  <button
                    type="button"
                    onClick={redactar}
                    disabled={!!ocupado}
                    className="shrink-0 inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-cyan-500/12 text-cyan-800 text-[12.5px] font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                    title="La IA redacta una respuesta; tú la apruebas antes de mandarla"
                  >
                    {ocupado === 'redactar' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span className="hidden xl:inline">Redactar con IA</span>
                  </button>
                  <textarea
                    value={propio}
                    onChange={(e) => setPropio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void mandarTexto(propio, () => setPropio(''));
                      }
                    }}
                    rows={1}
                    maxLength={1000}
                    placeholder="Escribe un mensaje…"
                    className="flex-1 min-h-11 max-h-32 resize-none glass-campo rounded-[22px] px-4 py-3 text-[13px] leading-snug text-brand-ink outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!propio.trim() || !!ocupado}
                    aria-label="Mandar"
                    className="shrink-0 w-11 h-11 rounded-full bg-brand-ink text-white flex items-center justify-center hover:bg-black transition-colors disabled:opacity-30"
                  >
                    {ocupado === 'mandar' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              ) : (
                <PieInfo icono={<Clock size={14} />}>
                  {actual && !nombrePlantilla
                    ? `Esta etapa va por ${actual.canal.toLowerCase()}, no por WhatsApp.`
                    : pasoVista && actual
                      ? 'Mensaje de esta etapa mandado. Cuando el cliente conteste podrás escribirle libremente.'
                      : 'Nada que mandar hoy. Cuando llegue la siguiente etapa, su plantilla aparecerá aquí.'}
                </PieInfo>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Aviso del último envío */}
      <AnimatePresence>
        {aviso && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-start gap-2 text-[12px] rounded-2xl px-3.5 py-2.5 ${
              aviso.error ? 'bg-rose-500/10 text-rose-800' : 'bg-emerald-500/10 text-emerald-900'
            }`}
          >
            {aviso.error ? <X size={13} className="mt-0.5 shrink-0" /> : <Check size={13} className="mt-0.5 shrink-0" />}
            {aviso.texto}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Para probar: simular que el cliente contesta (local o ejemplo) */}
      {(demo || import.meta.env.DEV) && hilo.customer.phone && !bloqueo && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-ink/30 mr-1">Probar · el cliente</span>
          {[
            { label: 'toca un botón', texto: 'Tengo una duda', kind: 'button' as const },
            { label: 'dice que ya pagó', texto: 'Ya pagué, comparto comprobante', kind: 'button' as const },
            { label: 'pide días', texto: '¿Me pueden dar unos días más? La transferencia sale el viernes.', kind: 'text' as const },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={!!ocupado}
              onClick={() => void simular(s.texto, s.kind)}
              className="rounded-full px-2.5 py-1 ring-1 ring-dashed ring-brand-ink/15 text-[11px] font-semibold text-brand-ink/50 hover:bg-white/70 hover:text-brand-ink disabled:opacity-40"
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
 * Solo Administrador: cómo salen los recordatorios del plan. Compacto: una
 * píldora con dos opciones; el detalle va en el título (tooltip).
 */
export function ModoEnvio() {
  const { envioAutomatico, cambiarEnvioAutomatico, fuente } = useCobranza();
  const reduce = useReducedMotion();
  const [guardando, setGuardando] = React.useState(false);
  // Con datos de ejemplo se puede probar el cambio sin guardar.
  const [local, setLocal] = React.useState(false);
  const demo = fuente === 'ejemplo' && (envioAutomatico === null || envioAutomatico === undefined);
  const valor = demo ? local : envioAutomatico;
  if (valor === undefined || valor === null) return null;

  const opciones = [
    { auto: false, titulo: 'Con aprobación', Icono: Hand, ayuda: 'Cada plantilla espera a que la mandes desde el WhatsApp del cliente.' },
    { auto: true, titulo: 'Automático', Icono: Bot, ayuda: 'Las plantillas de cada etapa salen solas cada mañana a las 11:00.' },
  ];
  return (
    <div className="inline-flex items-center gap-2">
      <span className="hidden md:inline text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/35">Recordatorios</span>
      <div className="glass inline-flex items-center rounded-full p-1" role="radiogroup" aria-label="Cómo salen los recordatorios por WhatsApp">
        {opciones.map((o) => {
          const activo = valor === o.auto;
          return (
            <button
              key={o.titulo}
              type="button"
              role="radio"
              aria-checked={activo}
              title={o.ayuda}
              disabled={guardando}
              onClick={async () => {
                if (activo) return;
                if (demo) return setLocal(o.auto);
                setGuardando(true);
                try {
                  await cambiarEnvioAutomatico(o.auto);
                } finally {
                  setGuardando(false);
                }
              }}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                activo ? 'text-white' : 'text-brand-ink/50 hover:text-brand-ink'
              }`}
            >
              {activo && (
                <motion.span layoutId={reduce ? undefined : 'modo-envio'} transition={SPRING} className="absolute inset-0 rounded-full bg-brand-ink" />
              )}
              <o.Icono size={13} className={`relative ${activo ? 'text-brand-gold' : ''}`} />
              <span className="relative">{o.titulo}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────

const BTN_CHAT_MANDAR =
  'inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand-ink text-white text-[13px] font-semibold hover:bg-black shadow-[0_10px_26px_-12px_rgba(17,24,39,0.7)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed';
const BTN_CHAT_APROBAR =
  'inline-flex items-center gap-2 h-10 px-5 rounded-full bg-emerald-600 text-white text-[13px] font-semibold hover:bg-emerald-700 shadow-[0_10px_26px_-12px_rgba(5,150,105,0.7)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-40';
const BTN_CHAT_FANTASMA =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink hover:bg-brand-ink/[0.05] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-40';
const BTN_CHAT_SEC =
  'inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/70 ring-1 ring-brand-ink/10 text-[12.5px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink transition-colors disabled:opacity-40';

function BurbujaChat({ m, etapa, reduce }: { m: WaMessage; etapa: string | null; reduce: boolean | null }) {
  const sale = m.direction === 'OUTBOUND';
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex ${sale ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-[20px] px-3.5 py-2.5 ${
          sale
            ? 'bg-brand-ink text-white rounded-br-md shadow-[0_8px_20px_-14px_rgba(17,24,39,0.8)]'
            : 'bg-white text-brand-ink rounded-bl-md ring-1 ring-brand-ink/[0.06] shadow-[0_6px_16px_-12px_rgba(17,24,39,0.35)]'
        }`}
      >
        {(etapa || m.kind === 'BUTTON') && (
          <div className={`text-[10px] font-semibold uppercase tracking-[0.12em] mb-1 ${sale ? 'text-brand-gold' : 'text-cyan-700'}`}>
            {m.kind === 'BUTTON' ? 'Tocó el botón' : `Plantilla · ${etapa}`}
          </div>
        )}
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{m.body}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${sale ? 'text-white/45' : 'text-brand-ink/35'}`}>
          {hora(m.createdAt)}
          {sale && (m.sent ? <CheckCheck size={12} className="text-brand-gold" /> : <Clock size={11} />)}
        </div>
      </div>
    </motion.div>
  );
}

function Inicial({ nombre }: { nombre: string }) {
  const ini = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/12 text-emerald-800 text-[13px] font-bold flex items-center justify-center ring-1 ring-emerald-500/20">
      {ini || '?'}
    </span>
  );
}

function PieInfo({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[12.5px] text-brand-ink/55 py-1.5">
      <span className="w-7 h-7 shrink-0 rounded-full bg-brand-ink/[0.05] text-brand-ink/45 flex items-center justify-center">{icono}</span>
      {children}
    </p>
  );
}

function Nota({ children, tono }: { children: React.ReactNode; tono?: 'error' }) {
  return <p className={`px-7 py-10 text-center text-[13px] ${tono === 'error' ? 'text-rose-700' : 'text-brand-ink/45'}`}>{children}</p>;
}

function Cargando() {
  return (
    <div className="px-7 py-14 flex justify-center">
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
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function dia(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Datos de ejemplo ───────────────────────────────────────────────

const CUERPO_EJEMPLO: Record<string, string> = {
  N0: 'Hola {{1}}, te compartimos la factura {{2}} por {{3}}. ¿Nos confirmas que la recibiste correctamente?',
  N1: 'Hola {{1}}, un aviso amable: la factura {{2}} por {{3}} vence pronto. Cualquier duda, aquí estamos.',
  N2: 'Hola {{1}}, te recordamos la factura {{2}} por {{3}}. Puedes pagarla aquí: {{4}}',
  N3: 'Hola {{1}}, la factura {{2}} por {{3}} vence en 3 días. Te dejamos la liga de pago: {{4}}',
  N4: 'Hola {{1}}, hoy vence la factura {{2}} por {{3}}. Si ya la pagaste, ignora este mensaje. Liga: {{4}}',
  A: 'Hola {{1}}, la factura {{2}} por {{3}} ya venció. ¿Nos ayudas a regularizarla? Liga: {{4}}',
  B: 'Hola {{1}}, seguimos pendientes de la factura {{2}} por {{3}}. ¿Pasó algo con el pago? Queremos ayudarte.',
};

function hiloDeEjemplo(c: CuentaViva): WaThread {
  const templates: WaTemplateInfo[] = PLANTILLA.filter((p) => PLANTILLA_DE_PASO[p.id]).map((p) => ({
    name: PLANTILLA_DE_PASO[p.id]!,
    level: p.id as WaTemplateInfo['level'],
    label: `${p.etiqueta} · ${p.nombre}`,
    exactDay: true,
    defaultDaysAfterDue: p.dia,
    buttons: ['Ya pagué', 'Tengo una duda'],
    body: CUERPO_EJEMPLO[p.id],
    vars: ['contacto', 'folio', 'monto', 'liga'],
  }));
  const saldo = Math.max(0, c.monto - c.pagado);
  const factura = { id: `demo-${c.folio}`, folio: c.folio, total: saldo, currency: 'MXN', dueDate: null, daysToDue: -c.dias };
  const hilo: WaThread = {
    customer: { id: `demo-${c.id}`, name: c.cliente, contact: c.finanzas?.nombre ?? null, phone: c.finanzas?.telefono ?? null, doNotContact: false },
    window: { open: false, expiresAt: null, lastInboundAt: null },
    invoices: [factura],
    templates,
    messages: [],
  };
  // Lo último que ya salió por WhatsApp según su plan, y si contestó.
  const hechos = planCuenta(c).pasos.filter((p) => p.estado === 'hecho' && PLANTILLA_DE_PASO[p.id] && p.canal === 'WhatsApp').slice(-2);
  const base = Date.now() - 3 * 86_400_000;
  hechos.forEach((p, i) => {
    const t = templates.find((x) => x.name === PLANTILLA_DE_PASO[p.id])!;
    const at = base + i * 86_400_000 + 11 * 3_600_000;
    hilo.messages.push({
      id: `demo-out-${p.id}`,
      direction: 'OUTBOUND',
      kind: 'TEMPLATE',
      body: vistaPrevia(t, hilo, factura),
      templateName: t.name,
      sent: true,
      sentByUserId: null,
      createdAt: new Date(at).toISOString(),
    });
    if (p.resultado && /respond|prometi|confirm/i.test(p.resultado)) {
      hilo.messages.push({
        id: `demo-in-${p.id}`,
        direction: 'INBOUND',
        kind: 'TEXT',
        body: /prometi/i.test(p.resultado) ? 'Lo pagamos el viernes, gracias por el recordatorio.' : 'Recibido, gracias. Lo revisamos con tesorería.',
        templateName: null,
        sent: true,
        sentByUserId: null,
        createdAt: new Date(at + 2 * 3_600_000).toISOString(),
      });
    }
  });
  return hilo;
}

function borradorDeEjemplo(hilo: WaThread, factura: WaThread['invoices'][number] | null): string {
  const ultimo = [...hilo.messages].reverse().find((m) => m.direction === 'INBOUND')?.body.toLowerCase() ?? '';
  const nombre = (hilo.customer.contact ?? hilo.customer.name).split(' ')[0];
  const ref = factura ? ` de la factura ${factura.folio} (${MXN.format(factura.total)})` : '';
  if (ultimo.includes('pagu')) return `¡Gracias, ${nombre}! En cuanto nos compartas el comprobante${ref} lo aplicamos y te confirmamos por aquí.`;
  if (ultimo.includes('días') || ultimo.includes('viernes'))
    return `Claro, ${nombre}. Dejamos registrado el pago${ref} para el viernes. Si cambia algo, avísanos por aquí y lo ajustamos.`;
  return `Hola ${nombre}, con gusto te ayudo. ¿Cuál es tu duda sobre el pago${ref}? Estoy al pendiente.`;
}
