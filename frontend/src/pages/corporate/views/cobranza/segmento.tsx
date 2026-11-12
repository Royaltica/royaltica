import React from 'react';
import { ChipCausa, IconoCausa, TarjetaTiposDeudor, tipoSugerido } from './TiposDeudor.tsx';
import { CAUSAS, TIPOS_DEUDOR, tipoDeudor, type TipoDeudor } from './catalogoDeudores.ts';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarClock, ChevronDown, MessageCircle, Scale, UserCog } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle, Figure, Bar, Tag } from './primitives.tsx';
import { SEGMENTOS, diagnosticoAnterior, saldoDe, type Segmento } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';
import { useConfirmar } from './vidrio.tsx';

/**
 * Etiqueta de segmento. Al pasar el cursor (o enfocar con teclado) explica
 * por qué el cliente está ahí y cómo se le cobra. Si un supervisor lo cambió
 * a mano, lo dice y muestra su motivo.
 */
export function SegmentoChip({ cuenta, alinear = 'izquierda' }: { cuenta: CuentaViva; alinear?: 'izquierda' | 'derecha' }) {
  const seg = SEGMENTOS[cuenta.segmento];
  return (
    <span className="relative group inline-flex" tabIndex={0}>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${seg.chip}`}>
        {seg.nombre}
        {cuenta.segmentoManual && <UserCog size={10} aria-label="Cambiado a mano" />}
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full mt-1.5 z-30 w-72 rounded-2xl border border-brand-ink/10 glass-flotante px-4 py-3 text-left opacity-0 translate-y-1 transition duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0 ${
          alinear === 'derecha' ? 'right-0' : 'left-0'
        }`}
      >
        <span className="block text-[12px] font-semibold text-brand-ink">{seg.nombre}</span>
        <span className="block text-[12px] text-brand-ink/65 leading-relaxed mt-1">
          {cuenta.segmentoManual
            ? `Cambiado a mano por supervisor: ${cuenta.segmentoManual.motivo}`
            : cuenta.diagnostico.porque}
        </span>
        <span className="block text-[11px] text-brand-ink/45 leading-relaxed mt-2 pt-2 border-t border-brand-ink/8">{seg.trato}</span>
      </span>
    </span>
  );
}

const ORDEN: Segmento[] = ['puntual', 'tardio', 'olvidadizo', 'nuevo', 'deterioro', 'moroso', 'disputa'];

/**
 * Segmentos (Administrador y Supervisor): un recuadro por segmento con su
 * trato; al darle clic se abre la lista de sus clientes con el porqué y la
 * opción de cambiarlo a mano (con motivo obligatorio).
 */
export function SegmentosPanel({ onVerPlantillas }: { onVerPlantillas?: () => void } = {}) {
  const reduce = useReducedMotion();
  const { cartera, tiposDeudor, guardarTiposDeudor } = useCobranza();
  const importado = !!tiposDeudor;
  // Sin análisis: el tipo que sugiere su historial de pagos (los segmentos de antes).
  const tipoDe = (c: CuentaViva): string | null => (tiposDeudor ? (tiposDeudor.asignaciones[c.id] ?? null) : tipoSugerido(c));
  const ids = tiposDeudor ? tiposDeudor.activos : [...new Set(cartera.map(tipoSugerido).filter(Boolean) as string[])];
  const tipos = (ids.map(tipoDeudor).filter(Boolean) as TipoDeudor[])
    .map((t) => ({ t, suyas: cartera.filter((c) => tipoDe(c) === t.id) }))
    .sort((x, y) => y.suyas.length - x.suyas.length);
  const sinTipo = cartera.filter((c) => !tipoDe(c) || !ids.includes(tipoDe(c)!));
  const [abiertos, setAbiertos] = React.useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const mover = (cuentaId: string, tipo: string) => {
    if (!tiposDeudor) return;
    guardarTiposDeudor({
      ...tiposDeudor,
      activos: tiposDeudor.activos.includes(tipo) ? tiposDeudor.activos : [...tiposDeudor.activos, tipo],
      asignaciones: { ...tiposDeudor.asignaciones, [cuentaId]: tipo },
    });
  };

  return (
    <div className="space-y-5">
      <Reveal>
        <TarjetaTiposDeudor onVerPlantillas={onVerPlantillas} />
      </Reveal>
      <Reveal>
        <p className="text-sm text-brand-ink/55 max-w-[72ch] leading-relaxed">
          {importado
            ? 'Cada cliente está en el tipo que le dio el análisis, y ese tipo decide sus mensajes. Da clic en un tipo para ver sus clientes.'
            : 'Mientras importas el análisis, cada cliente aparece en el tipo que sugiere su historial de pagos. Da clic en un tipo para ver sus clientes.'}
        </p>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {tipos.map(({ t, suyas }, i) => {
          const abierto = abiertos.has(t.id);
          const aTiempo = suyas.length ? Math.round((suyas.reduce((a, c) => a + c.diagnostico.aTiempo, 0) / suyas.length) * 100) : 0;
          const color = CAUSAS[t.causa].color;
          return (
            <Reveal key={t.id} delay={0.04 + i * 0.04}>
              <div
                className="glass rounded-[28px] overflow-hidden transition-shadow duration-300"
                style={abierto ? { boxShadow: `0 0 0 2px rgb(${color} / 0.5), 0 16px 40px -18px rgb(${color} / 0.45)` } : undefined}
              >
                <button onClick={() => alternar(t.id)} aria-expanded={abierto} className="w-full text-left p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <IconoCausa causa={t.causa} />
                      <div className="min-w-0">
                        <h4 className="text-xl font-serif text-brand-ink leading-tight">{t.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <ChipCausa causa={t.causa} />
                          {!importado && (
                            <span className="rounded-full bg-amber-500/12 text-amber-800 px-2.5 py-1 text-[11px] font-semibold">Sugerido</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-serif text-brand-ink leading-none">
                        <Figure value={suyas.length} />
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/35 mt-1.5">clientes</div>
                      <div className="text-[11px] text-brand-ink/50 tabular-nums mt-1">
                        {CURRENCY_FORMATTER.format(suyas.reduce((a, c) => a + saldoDe(c), 0))}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-brand-ink/55 leading-relaxed">
                    <span className="font-semibold text-brand-ink/75">Lo que funciona:</span> {t.pal}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Tag icon={<Scale size={11} />} text={`Tono ${t.tono.toLowerCase()}`} />
                    <Tag icon={<MessageCircle size={11} />} text={t.canal} />
                  </div>

                  {suyas.length > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Bar value={aTiempo} tone="accent" delay={0.2 + i * 0.04} />
                      </div>
                      <span className="text-sm font-semibold text-brand-ink tabular-nums shrink-0">
                        <Figure value={aTiempo} format="porcentaje" /> pagado a tiempo
                      </span>
                    </div>
                  )}

                  <span className="flex items-center gap-1 text-[12px] font-semibold text-brand-ink/55">
                    {abierto ? 'Ocultar clientes' : suyas.length ? `Ver ${suyas.length === 1 ? 'el cliente' : `los ${suyas.length} clientes`}` : 'Sin clientes todavía'}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {abierto && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden border-t border-brand-ink/8"
                    >
                      <ClientesTipo lista={suyas} actual={t.id} activos={ids} editable={importado} onMover={mover} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          );
        })}

        {sinTipo.length > 0 && (
          <Reveal delay={0.04 + tipos.length * 0.04}>
            <div className="rounded-[28px] overflow-hidden border-2 border-dashed border-brand-ink/12 bg-white/30">
              <button onClick={() => alternar('__sin')} aria-expanded={abiertos.has('__sin')} className="w-full text-left p-6 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xl font-serif text-brand-ink/70">Sin tipo</h4>
                  <p className="text-xs text-brand-ink/50 mt-1.5 max-w-[40ch] leading-relaxed">
                    {importado ? 'No venían en el análisis. Asígnales un tipo para que reciban sus mensajes.' : 'Sin historial suficiente para sugerir un tipo.'}
                  </p>
                  <span className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-brand-ink/55">
                    {abiertos.has('__sin') ? 'Ocultar clientes' : `Ver ${sinTipo.length === 1 ? 'el cliente' : `los ${sinTipo.length} clientes`}`}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${abiertos.has('__sin') ? 'rotate-180' : ''}`} />
                  </span>
                </div>
                <div className="text-3xl font-serif text-brand-ink/60 leading-none">{sinTipo.length}</div>
              </button>
              <AnimatePresence initial={false}>
                {abiertos.has('__sin') && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden border-t border-brand-ink/8"
                  >
                    <ClientesTipo lista={sinTipo} actual={null} activos={ids} editable={importado} onMover={mover} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}

/** Clientes de un tipo de deudor; con el análisis importado se pueden mover a otro tipo. */
function ClientesTipo({
  lista,
  actual,
  activos,
  editable,
  onMover,
}: {
  lista: CuentaViva[];
  actual: string | null;
  activos: string[];
  editable: boolean;
  onMover: (cuentaId: string, tipo: string) => void;
}) {
  const reduce = useReducedMotion();
  const { confirmar, nodo } = useConfirmar();
  if (!lista.length) return <p className="px-6 py-4 text-sm text-brand-ink/45">Ningún cliente en este tipo.</p>;
  const otros = TIPOS_DEUDOR.filter((t) => !activos.includes(t.id));
  return (
    <>
      {nodo}
      <ul className="divide-y divide-white/70">
        {lista.map((c, i) => (
          <motion.li
            key={c.id}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : Math.min(i, 8) * 0.03 }}
            className="px-6 py-3 flex flex-wrap items-center gap-3"
          >
            <div className="min-w-[12rem] flex-1">
              <div className="text-[13.5px] font-semibold text-brand-ink truncate">{c.cliente}</div>
              <div className="text-[11.5px] text-brand-ink/45 truncate">
                {c.folio} · {c.agente} · <span className="tabular-nums">{CURRENCY_FORMATTER.format(saldoDe(c))}</span>
                {c.dias > 0 && !c.saldada && <span className="text-rose-600 font-semibold"> · {c.dias} d vencida</span>}
              </div>
            </div>
            <select
              value={actual ?? ''}
              disabled={!editable}
              title={editable ? 'Mover a otro tipo' : 'Importa el análisis para ajustar los tipos'}
              aria-label={`Tipo de deudor de ${c.cliente}`}
              onChange={(e) => {
                const destino = e.target.value;
                const t = tipoDeudor(destino);
                if (!t) return;
                confirmar({
                  titulo: `¿Mover a ${c.cliente} a ${t.name}?`,
                  mensaje: 'Desde hoy recibe las plantillas de ese tipo.',
                  accion: 'Mover',
                  alConfirmar: () => onMover(c.id, destino),
                });
              }}
              className="glass-campo rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-brand-ink outline-none w-full sm:w-auto sm:max-w-[220px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!actual && <option value="">Elige su tipo…</option>}
              <optgroup label="Activos">
                {activos.map((id) => (
                  <option key={id} value={id}>
                    {tipoDeudor(id)?.name}
                  </option>
                ))}
              </optgroup>
              {editable && (
                <optgroup label="Del catálogo">
                  {otros.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.seg === 'B2B' ? 'empresa' : 'persona'})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </motion.li>
        ))}
      </ul>
    </>
  );
}

/** Clientes de un segmento, con su porqué y el cambio manual (motivo obligatorio). */
function ClientesSegmento({ lista }: { lista: CuentaViva[] }) {
  const { cambiarSegmento, cambiosSegmento } = useCobranza();
  const [editando, setEditando] = React.useState<string | null>(null);
  const [nuevo, setNuevo] = React.useState<Segmento>('olvidadizo');
  const [motivo, setMotivo] = React.useState('');
  // Cambio de varios a la vez.
  const [elegidos, setElegidos] = React.useState<string[]>([]);
  const [destinoLote, setDestinoLote] = React.useState<Segmento | ''>('');
  const [motivoLote, setMotivoLote] = React.useState('');
  const [historial, setHistorial] = React.useState<string | null>(null);
  const guardar = (id: string) => {
    if (!motivo.trim()) return;
    cambiarSegmento(id, nuevo, motivo.trim());
    setEditando(null);
    setMotivo('');
  };
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();
  const moverLote = () => {
    if (!destinoLote || !motivoLote.trim()) return;
    const n = elegidos.length;
    confirmar({
      titulo: `¿Mover ${n} ${n === 1 ? 'cliente' : 'clientes'} a ${SEGMENTOS[destinoLote].nombre}?`,
      mensaje: `Su plan cambia al de ese segmento (${SEGMENTOS[destinoLote].calendario.toLowerCase()}). El motivo queda registrado: "${motivoLote.trim()}".`,
      accion: `Mover ${n}`,
      alConfirmar: () => {
        elegidos.forEach((id) => cambiarSegmento(id, destinoLote, motivoLote.trim()));
        setElegidos([]);
        setDestinoLote('');
        setMotivoLote('');
      },
    });
  };
  if (!lista.length) return <p className="px-6 py-4 text-sm text-brand-ink/45">Ningún cliente en este segmento.</p>;
  return (
    <>
      {nodoConfirmar}
    {elegidos.length > 0 && (
      <div className="px-6 py-3 bg-brand-cream border-b border-brand-gold/30 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-brand-ink tabular-nums">{elegidos.length} elegidos</span>
        <select
          value={destinoLote}
          onChange={(e) => setDestinoLote(e.target.value as Segmento)}
          className="px-3 py-1.5 rounded-2xl glass-campo text-[12px] font-semibold outline-none focus:border-brand-gold/60"
          aria-label="Mover a segmento"
        >
          <option value="">Mover a…</option>
          {ORDEN.map((x) => (
            <option key={x} value={x}>
              {SEGMENTOS[x].nombre}
            </option>
          ))}
        </select>
        <input
          value={motivoLote}
          onChange={(e) => setMotivoLote(e.target.value)}
          placeholder="Motivo (obligatorio)"
          className="flex-1 min-w-[150px] px-3 py-1.5 rounded-2xl glass-campo text-[12px] outline-none focus:border-brand-gold/60"
        />
        <button
          onClick={moverLote}
          disabled={!destinoLote || !motivoLote.trim()}
          className="px-3 py-1.5 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold disabled:opacity-40"
        >
          Mover
        </button>
        <button onClick={() => setElegidos([])} className="px-2 text-[12px] text-brand-ink/45">
          Cancelar
        </button>
      </div>
    )}
    <ul className="divide-y divide-white/70">
      {lista.map((c) => {
        const suyos = cambiosSegmento.filter((m) => m.cliente === c.cliente);
        return (
        <li key={c.id} className="px-6 py-3.5">
          <div className="flex flex-wrap items-start gap-3">
            <input
              type="checkbox"
              checked={elegidos.includes(c.id)}
              onChange={() => setElegidos((e) => (e.includes(c.id) ? e.filter((x) => x !== c.id) : [...e, c.id]))}
              className="mt-1 w-4 h-4 accent-[#06B6D4]"
              aria-label={`Elegir ${c.cliente}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-brand-ink">
                {c.cliente}
                {c.segmentoManual ? (
                  <span className="ml-2 audit-badge bg-amber-50 text-amber-700" title={`El cálculo lo pondría en ${SEGMENTOS[c.diagnostico.segmento].nombre}`}>
                    Manual · calculado: {SEGMENTOS[c.diagnostico.segmento].nombre}
                  </span>
                ) : (
                  <span className="ml-2 audit-badge bg-brand-ink/5 text-brand-ink/50">Calculado</span>
                )}
                {c.saldada && <span className="ml-2 audit-badge bg-emerald-50 text-emerald-700">Saldada</span>}
                {c.comportamiento.esperaDescuentos && (
                  <span className="ml-2 audit-badge bg-rose-50 text-rose-700">Espera descuentos</span>
                )}
              </div>
              <div className="text-[11px] text-brand-ink/40 mt-0.5">
                {CURRENCY_FORMATTER.format(saldoDe(c))} por cobrar · {c.agente}
              </div>
              <div className="text-[12px] text-brand-ink/60 mt-1 leading-relaxed">
                {c.segmentoManual ? `Cambiado a mano: ${c.segmentoManual.motivo}` : c.diagnostico.porque}
              </div>
              {suyos.length > 0 && (
                <button
                  onClick={() => setHistorial(historial === c.id ? null : c.id)}
                  className="mt-1 text-[11px] font-semibold text-brand-ink/45 hover:text-brand-ink"
                  aria-expanded={historial === c.id}
                >
                  {historial === c.id ? 'Ocultar historial' : `Historial de cambios (${suyos.length})`}
                </button>
              )}
              {historial === c.id && (
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-brand-ink/55">
                  {suyos.map((m, i) => (
                    <li key={i}>
                      {m.fecha ?? 'hoy'} {m.hora} · {SEGMENTOS[m.de].nombre} → {SEGMENTOS[m.a].nombre} · <span className="italic">{m.motivo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {editando !== c.id && (
              <button
                onClick={() => {
                  setEditando(c.id);
                  setNuevo(c.segmento);
                }}
                className="text-[11px] font-semibold text-brand-ink/50 hover:text-brand-ink"
              >
                Cambiar
              </button>
            )}
          </div>
          {editando === c.id && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <select
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value as Segmento)}
                className="px-3 py-2 rounded-2xl glass-campo text-[12px] font-semibold outline-none focus:border-brand-gold/60"
              >
                {ORDEN.map((x) => (
                  <option key={x} value={x}>
                    {SEGMENTOS[x].nombre}
                  </option>
                ))}
              </select>
              <input
                autoFocus
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (obligatorio)"
                className="flex-1 min-w-[160px] px-3 py-2 rounded-2xl glass-campo text-[12px] outline-none focus:border-brand-gold/60"
              />
              <button
                onClick={() => guardar(c.id)}
                disabled={!motivo.trim()}
                className="px-3 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold disabled:opacity-40"
              >
                Guardar
              </button>
              {c.segmentoManual && (
                <button
                  onClick={() =>
                    confirmar({
                      titulo: `¿Regresar ${c.cliente} a su segmento calculado?`,
                      mensaje: 'Se quita el cambio manual y su segmento vuelve a salir de su historial de pagos.',
                      accion: 'Volver al calculado',
                      alConfirmar: () => {
                        cambiarSegmento(c.id, null, '');
                        setEditando(null);
                      },
                    })
                  }
                  className="px-3 py-2 rounded-xl border border-brand-ink/12 text-[12px] font-semibold text-brand-ink/60"
                >
                  Volver al calculado
                </button>
              )}
              <button onClick={() => setEditando(null)} className="px-2 text-[12px] text-brand-ink/45">
                Cancelar
              </button>
            </div>
          )}
        </li>
        );
      })}
    </ul>
    </>
  );
}
