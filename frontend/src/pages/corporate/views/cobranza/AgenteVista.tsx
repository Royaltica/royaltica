import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, Clock, Loader2, MapPin, Phone, Send, Sparkles } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, Bar } from './primitives.tsx';
import { AGENTES, PLANTILLAS, llenarPlantilla, saldoDe, type Agente, type CuentaCartera } from './mockV1.ts';
import { FaseDot, LineaPlan, textoHoy, CanalIcon } from './plan.tsx';
import { useCobranza, planCuenta } from './store.tsx';

/**
 * Vista del Agente / Ejecutivo. Pensada para alta rotación: se entiende sin
 * capacitación. Dos pestañas nada más:
 *  - Mis cuentas: a quién contactar, qué mensaje toca según el plan
 *    (generarlo y enviarlo) y registrar cómo le fue.
 *  - Recordatorios: el plan de cada cliente (solo lectura).
 */
const RESULTADOS = ['Promesa de pago', 'Contactado', 'No contestó', 'Disputa', 'Escalado a supervisor'] as const;

function situacion(dias: number): { texto: string; clase: string } {
  if (dias < 0) return { texto: `Vence en ${-dias} ${dias === -1 ? 'día' : 'días'}`, clase: 'text-emerald-700' };
  if (dias === 0) return { texto: 'Vence hoy', clase: 'text-amber-700' };
  return { texto: `${dias} ${dias === 1 ? 'día' : 'días'} vencida`, clase: 'text-rose-600' };
}

type Pestana = 'cuentas' | 'recordatorios';

export function AgenteVista() {
  const { cartera, resultadosHoy } = useCobranza();
  const [agente, setAgente] = React.useState<Agente>('Ana Robles');
  const [pestana, setPestana] = React.useState<Pestana>('cuentas');
  const reduce = useReducedMotion();

  const mias = cartera.filter((c) => c.agente === agente);
  const listas = mias.filter((c) => resultadosHoy[c.id]);
  const ahora = mias.filter((c) => c.contactable && !resultadosHoy[c.id]).length;
  const avance = mias.length ? Math.round((listas.length / mias.length) * 100) : 0;

  return (
    <div className="max-w-4xl space-y-6">
      <Reveal>
        <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-brand-ink/55">
                Hola,{' '}
                <select
                  value={agente}
                  onChange={(e) => setAgente(e.target.value as Agente)}
                  className="bg-transparent font-semibold text-brand-ink outline-none cursor-pointer"
                  aria-label="Ver como agente"
                >
                  {AGENTES.map((a) => (
                    <option key={a} value={a}>
                      {a.split(' ')[0]}
                    </option>
                  ))}
                </select>
                . Estas son tus cuentas de hoy.
              </p>
              <p className="text-2xl font-serif text-brand-ink mt-1">{ahora} para contactar ahora</p>
            </div>
            <span className="text-[11px] text-brand-ink/45 tabular-nums">
              {listas.length} de {mias.length} gestionadas
            </span>
          </div>
          <div className="mt-4">
            <Bar value={avance} tone="positivo" />
          </div>
        </div>
      </Reveal>

      {/* Solo dos pestañas */}
      <nav className="flex gap-1 border-b border-brand-ink/10">
        {(
          [
            ['cuentas', 'Mis cuentas'],
            ['recordatorios', 'Recordatorios'],
          ] as [Pestana, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`relative px-4 py-3 text-[13px] font-semibold transition-colors ${
              pestana === id ? 'text-brand-ink' : 'text-brand-ink/40 hover:text-brand-ink/70'
            }`}
          >
            {label}
            {pestana === id && (
              <motion.span
                layoutId={reduce ? undefined : 'agente-pestana'}
                className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-gold rounded-full"
                transition={{ duration: 0.3, ease: EASE }}
              />
            )}
          </button>
        ))}
      </nav>

      {pestana === 'cuentas' ? <MisCuentas cuentas={mias} /> : <RecordatoriosAgente cuentas={mias} />}
    </div>
  );
}

// ── Mis cuentas ────────────────────────────────────────────────────────

function MisCuentas({ cuentas }: { cuentas: CuentaCartera[] }) {
  const { resultadosHoy } = useCobranza();
  const pendientes = cuentas
    .filter((c) => !resultadosHoy[c.id])
    .sort((a, b) => Number(b.contactable) - Number(a.contactable));
  const listas = cuentas.filter((c) => resultadosHoy[c.id]);
  const [abierta, setAbierta] = React.useState<string | null>(pendientes[0]?.id ?? null);

  const alTerminar = (id: string) => {
    const siguiente = pendientes.find((c) => c.id !== id && c.contactable);
    setAbierta(siguiente?.id ?? null);
  };

  if (!cuentas.length) {
    return <p className="text-sm text-brand-ink/45 px-2">No tienes cuentas asignadas hoy.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {pendientes.map((c, i) => (
          <Reveal key={c.id} delay={0.03 + i * 0.03}>
            <TarjetaCuenta
              cuenta={c}
              abierta={abierta === c.id}
              onToggle={() => setAbierta(abierta === c.id ? null : c.id)}
              onTerminar={() => alTerminar(c.id)}
            />
          </Reveal>
        ))}
      </div>

      {listas.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">Gestionadas hoy</div>
          <ul className="space-y-2">
            {listas.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-brand-bone/60 border border-brand-ink/6"
              >
                <span className="flex items-center gap-2 text-sm text-brand-ink/60">
                  <Check size={14} className="text-emerald-600" />
                  {c.cliente}
                </span>
                <span className="text-[11px] font-semibold text-brand-ink/55">{resultadosHoy[c.id]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TarjetaCuenta({
  cuenta: c,
  abierta,
  onToggle,
  onTerminar,
}: {
  cuenta: CuentaCartera;
  abierta: boolean;
  onToggle: () => void;
  onTerminar: () => void;
}) {
  const reduce = useReducedMotion();
  const { envios, enviar, registrar } = useCobranza();
  const [generando, setGenerando] = React.useState(false);
  const [mensaje, setMensaje] = React.useState<string | null>(null);

  const { actual, proxima } = planCuenta(c);
  const envio = envios[c.id];
  // Toca mensaje hoy si el paso vigente aún no tiene resultado (o se acaba de enviar).
  const toca = actual && (!c.resultados[actual.id] || envio) ? actual : null;
  const plantilla = toca ? PLANTILLAS.find((p) => p.id === toca.id) : undefined;
  const esLlamada = toca?.canal === 'Llamada';
  const sit = situacion(c.dias);
  const contacto = c.finanzas;

  const generar = () => {
    if (!plantilla) return;
    setGenerando(true);
    setTimeout(
      () => {
        setMensaje(llenarPlantilla(plantilla.texto, c));
        setGenerando(false);
      },
      reduce ? 0 : 700,
    );
  };

  return (
    <div
      className={`rounded-3xl border bg-brand-paper transition-colors ${
        abierta ? 'border-brand-gold/50 shadow-sm' : 'border-brand-ink/10'
      } ${c.contactable ? '' : 'opacity-60'}`}
    >
      <button onClick={onToggle} className="w-full text-left px-6 py-5" aria-expanded={abierta}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-brand-ink truncate">{c.cliente}</div>
            <div className="text-sm text-brand-ink/60 mt-0.5">
              {contacto ? `${contacto.nombre} · ${contacto.puesto}` : c.registrado}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-semibold text-brand-ink tabular-nums">
              {CURRENCY_FORMATTER.format(saldoDe(c))}
            </div>
            <div className={`text-[11px] font-semibold mt-0.5 ${sit.clase}`}>{sit.texto}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[12px]">
          {contacto && (
            <span className="flex items-center gap-1.5 font-semibold text-brand-ink tabular-nums">
              <Phone size={13} className="text-brand-ink/40" />
              {contacto.telefono}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-brand-ink/55">
            <MapPin size={13} className="text-brand-ink/35" />
            {c.ciudad}
          </span>
          <span className="flex items-center gap-1.5 text-brand-ink/55 tabular-nums">
            <Clock size={13} className="text-brand-ink/35" />
            {c.horaLocal} hora local ({c.zona})
          </span>
          {toca && (
            <span className="flex items-center gap-1.5 text-brand-ink/60">
              <FaseDot fase={toca.fase} />
              Hoy toca: {toca.etiqueta}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${c.contactable ? 'bg-emerald-500' : 'bg-brand-ink/25'}`} />
            <span className={c.contactable ? 'text-emerald-700 font-semibold' : 'text-brand-ink/50'}>
              {c.contactable ? 'Puedes contactar ahora' : c.motivo}
            </span>
            <ChevronDown
              size={15}
              className={`text-brand-ink/35 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {abierta && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 space-y-4 border-t border-brand-ink/8 pt-4">
              {!contacto && (
                <div className="flex items-start gap-2 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  Sin contacto de finanzas. Pide el nombre y teléfono de tesorería y avísale a tu supervisor.
                </div>
              )}

              {/* Paso del plan que toca hoy */}
              {toca && plantilla ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">Paso de hoy según el plan</div>
                      <div className="text-sm font-semibold text-brand-ink mt-0.5 flex items-center gap-2">
                        {toca.etiqueta} · {toca.nombre}
                        <span className="flex items-center gap-1 text-[11px] font-normal text-brand-ink/50">
                          <CanalIcon canal={toca.canal} /> {toca.canal} · Tono {toca.tono}
                        </span>
                      </div>
                    </div>
                    {envio ? (
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                        <Check size={13} /> Enviado {envio.hora} · {envio.origen}
                      </span>
                    ) : esLlamada ? null : (
                      <button
                        onClick={generar}
                        disabled={generando}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-gold/50 text-[12px] font-semibold text-brand-ink hover:bg-brand-cream transition-colors disabled:opacity-60"
                      >
                        {generando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-brand-gold" />}
                        {mensaje ? 'Volver a generar' : 'Generar mensaje'}
                      </button>
                    )}
                  </div>

                  {esLlamada && !envio && (
                    <p className="text-sm text-brand-ink/80 leading-relaxed bg-brand-bone/60 border border-brand-ink/6 rounded-2xl px-4 py-3">
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-1">Guion de llamada</span>
                      {llenarPlantilla(plantilla.texto, c)}
                    </p>
                  )}

                  {mensaje && !envio && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                    >
                      <p className="text-sm text-brand-ink/80 leading-relaxed bg-brand-bone/60 border border-brand-ink/6 rounded-2xl px-4 py-3">
                        {mensaje}
                      </p>
                      <p className="text-[11px] text-brand-ink/40 mt-1.5">
                        Plantilla aprobada. Solo se llenaron los datos del cliente; el texto no se puede editar.
                      </p>
                    </motion.div>
                  )}

                  {!envio && (esLlamada || mensaje) && (
                    <div className="flex justify-end">
                      {esLlamada ? (
                        <a
                          href={contacto ? `tel:${contacto.telefono.replace(/\s/g, '')}` : undefined}
                          onClick={() => enviar(c.id, toca.id, 'Llamada', 'Llamada del agente')}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold ${
                            !c.contactable || !contacto ? 'opacity-40 pointer-events-none' : 'hover:bg-brand-ink/85'
                          }`}
                        >
                          <Phone size={13} /> Llamar a {contacto?.nombre.split(' ')[0] ?? 'cliente'}
                        </a>
                      ) : (
                        <button
                          onClick={() => enviar(c.id, toca.id, toca.canal, 'Enviado por el agente')}
                          disabled={!c.contactable || !contacto}
                          title={!c.contactable ? c.motivo : undefined}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send size={13} /> Enviar por {toca.canal}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-brand-ink/60 bg-brand-bone/60 rounded-2xl px-4 py-3 border border-brand-ink/6">
                  Hoy no toca mensaje: {actual ? `${actual.etiqueta} ya se hizo (${c.resultados[actual.id]}).` : ''}{' '}
                  {proxima ? `Lo siguiente es ${proxima.etiqueta} · ${proxima.nombre}, ${proxima.faltan === 1 ? 'mañana' : `en ${proxima.faltan} días`}.` : ''}
                </p>
              )}

              {/* Resultado */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">¿Cómo te fue?</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {RESULTADOS.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        registrar(c.id, r);
                        onTerminar();
                      }}
                      disabled={!c.contactable}
                      className={`px-3 py-2.5 rounded-xl text-[12px] font-semibold border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        r === 'Escalado a supervisor'
                          ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border-brand-ink/12 text-brand-ink/75 hover:bg-brand-cream hover:border-brand-gold/40'
                      }`}
                    >
                      {r === 'Escalado a supervisor' ? 'Escalar a supervisor' : r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Recordatorios (solo el plan) ───────────────────────────────────────

function RecordatoriosAgente({ cuentas }: { cuentas: CuentaCartera[] }) {
  const [sel, setSel] = React.useState<string | undefined>(cuentas[0]?.id);
  const activa = cuentas.find((c) => c.id === sel) ?? cuentas[0];
  if (!activa) return <p className="text-sm text-brand-ink/45 px-2">No tienes cuentas asignadas hoy.</p>;
  const { pasos } = planCuenta(activa);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden self-start">
        {cuentas.map((c) => {
          const act = planCuenta(c).actual;
          return (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              className={`w-full text-left px-5 py-3.5 border-b border-brand-ink/6 last:border-0 transition-colors ${
                c.id === activa.id ? 'bg-brand-cream' : 'hover:bg-brand-bone'
              }`}
            >
              <div className="text-sm font-semibold text-brand-ink">{c.cliente}</div>
              {act && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-brand-ink/55">
                  <FaseDot fase={act.fase} /> {act.etiqueta} · {act.nombre}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="lg:col-span-3 bg-brand-paper border border-brand-ink/10 rounded-3xl px-7 py-6 space-y-5">
        <div>
          <h3 className="text-[1.4rem] font-serif text-brand-ink leading-tight">{activa.cliente}</h3>
          <div className="flex flex-wrap gap-x-3 text-[11px] text-brand-ink/45 mt-1">
            <span className="font-mono">{activa.folio}</span>
            <span>{CURRENCY_FORMATTER.format(saldoDe(activa))}</span>
            <span className={activa.dias > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-semibold'}>
              Hoy: {textoHoy(activa.dias)}
            </span>
          </div>
        </div>
        <LineaPlan pasos={pasos} />
      </div>
    </div>
  );
}
