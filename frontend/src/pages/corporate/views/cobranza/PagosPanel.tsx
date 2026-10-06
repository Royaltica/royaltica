import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, FileCheck2, RefreshCw, Upload } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle, Figure } from './primitives.tsx';
import { ERP_CONECTADO, type EstadoPago, type Fuente, type Pago } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';

/**
 * Conciliación de pagos con dos fuentes:
 *  - ERP: señal rápida. Cada sincronización compara saldos; si un saldo bajó,
 *    registra el pago y la cobranza sigue sobre lo que falta.
 *  - REP (complemento de pago): confirmación fiscal. Se empata por UUID con
 *    la factura; su fecha es la fecha oficial del pago.
 * Un pago real se guarda una sola vez, con sus evidencias. Lo que no cuadra
 * no se aplica a ciegas: va a "Por revisar".
 */
const ESTADOS: Record<EstadoPago, { label: string; chip: string }> = {
  confirmado: { label: 'Confirmado · ERP y REP', chip: 'bg-emerald-50 text-emerald-700' },
  solo_erp: { label: 'Solo ERP · falta REP', chip: 'bg-sky-50 text-sky-700' },
  solo_rep: { label: 'Solo REP · falta en ERP', chip: 'bg-amber-50 text-amber-700' },
  discrepancia: { label: 'No cuadra', chip: 'bg-rose-50 text-rose-700' },
};

const FUENTE_CHIP: Record<Fuente, string> = {
  ERP: 'bg-sky-100 text-sky-800',
  REP: 'bg-emerald-100 text-emerald-800',
};

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);

/** Franja del encabezado: estado de las fuentes de pago. */
export function AvisoPagos({ onIr }: { onIr?: () => void }) {
  const { erp, pagos, noReconocidos } = useCobranza();
  const pendientes = pagos.filter((p) => p.estado === 'solo_erp' && p.metodo === 'PPD').length;
  const revisar = pagos.filter((p) => p.estado === 'discrepancia' || p.estado === 'solo_rep').length + noReconocidos.length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-ink/55">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
        Pagos: {ERP_CONECTADO.nombre} sincronizado {erp.ultima}
      </span>
      <span className="text-brand-ink/35">
        {pendientes} REP pendientes{revisar ? ` · ${revisar} por revisar` : ''}
      </span>
      {onIr && (
        <button onClick={onIr} className="font-semibold text-brand-ink/70 hover:text-brand-ink underline-offset-2 hover:underline">
          Ver pagos →
        </button>
      )}
    </div>
  );
}

export function PagosPanel({ soloLectura = false }: { soloLectura?: boolean }) {
  const {
    pagos,
    cartera,
    noReconocidos,
    erp,
    zipCargado,
    sincronizarErp,
    subirRep,
    resolverDiscrepancia,
    avisarRep,
    marcarEnErp,
    descartarNoReconocido,
  } = useCobranza();
  const [mensaje, setMensaje] = React.useState<{ fuente: Fuente; texto: string } | null>(null);
  const [cargando, setCargando] = React.useState<Fuente | null>(null);
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const reduce = useReducedMotion();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const cuenta = (id: string) => cartera.find((c) => c.id === id)!;
  const cobrado = pagos.reduce((a, p) => a + p.monto, 0);
  const confirmados = pagos.filter((p) => p.estado === 'confirmado' && p.metodo === 'PPD').length;
  const porRevisar = pagos.filter((p) => p.estado === 'discrepancia');
  const repPendientes = pagos.filter((p) => p.estado === 'solo_erp' && p.metodo === 'PPD');
  const soloRep = pagos.filter((p) => p.estado === 'solo_rep');
  const totalRevisar = porRevisar.length + noReconocidos.length + soloRep.length;

  // Breve espera para que la acción se sienta como un proceso real.
  const correr = (fuente: Fuente, accion: () => string) => {
    setCargando(fuente);
    setTimeout(
      () => {
        setMensaje({ fuente, texto: accion() });
        setCargando(null);
      },
      reduce ? 0 : 900,
    );
  };

  return (
    <div className="space-y-5">
      {/* Fuentes: qué hace cada una y su estado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Reveal>
          <TarjetaFuente
            titulo={`ERP · ${ERP_CONECTADO.nombre}`}
            etiqueta="Señal rápida"
            color="sky"
            texto="Cada sincronización compara el saldo de cada factura. Si bajó, registra el pago y la cobranza sigue sobre lo que falta."
            dato={`Última sincronización ${erp.ultima} · siguiente ${ERP_CONECTADO.siguiente}`}
            tiempo="Típicamente al día siguiente de que contabilidad aplica el pago"
            boton={
              soloLectura ? null : (
                <BotonAccion onClick={() => correr('ERP', sincronizarErp)} cargando={cargando === 'ERP'} icon={<RefreshCw size={13} />}>
                  Sincronizar ahora
                </BotonAccion>
              )
            }
            mensaje={mensaje?.fuente === 'ERP' ? mensaje.texto : null}
          />
        </Reveal>
        <Reveal delay={0.05}>
          <TarjetaFuente
            titulo="REP · complemento de pago"
            etiqueta="Confirmación fiscal"
            color="emerald"
            texto="Cada REP se empata por UUID con su factura. Su fecha es la oficial del pago y confirma (o corrige) lo que dijo el ERP."
            dato={zipCargado ? 'Último ZIP: hoy, 4 REP leídos' : 'Último ZIP: 25 sep, 2 REP leídos'}
            tiempo="Hasta el día 10 del mes siguiente al pago"
            boton={
              soloLectura ? null : (
                <>
                  <BotonAccion onClick={() => inputRef.current?.click()} cargando={cargando === 'REP'} icon={<Upload size={13} />}>
                    Subir ZIP de REP
                  </BotonAccion>
                  {/* Mockup: cualquier archivo dispara la simulación. */}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".zip,.xml"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) correr('REP', subirRep);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => correr('REP', subirRep)}
                    className="text-[11px] font-semibold text-brand-ink/45 hover:text-brand-ink"
                  >
                    Usar ZIP de ejemplo
                  </button>
                </>
              )
            }
            mensaje={mensaje?.fuente === 'REP' ? mensaje.texto : null}
          />
        </Reveal>
      </div>

      {/* Cifras */}
      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-brand-paper border border-brand-ink/10 rounded-3xl divide-x divide-brand-ink/8">
          <Kpi label="Cobrado en septiembre" valor={<Figure value={cobrado} format="moneda" />} />
          <Kpi label="Confirmados por REP" valor={<Figure value={confirmados} />} />
          <Kpi label="Por revisar" valor={<Figure value={totalRevisar} />} alerta={totalRevisar > 0} />
          <Kpi label="REP pendientes" valor={<Figure value={repPendientes.length} />} />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Pagos aplicados */}
        <Reveal delay={0.1} className="xl:col-span-3">
          <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-ink/8">
              <BlockTitle>Pagos aplicados</BlockTitle>
              <span className="text-[11px] text-brand-ink/40">Da clic para ver la factura y sus evidencias</span>
            </div>
            <ul className="divide-y divide-brand-ink/6">
              {pagos.map((p) => (
                <FilaPago
                  key={p.id}
                  pago={p}
                  cuenta={cuenta(p.cuentaId)}
                  pagosFactura={pagos.filter((x) => x.cuentaId === p.cuentaId)}
                  abierto={abierto === p.id}
                  onToggle={() => setAbierto(abierto === p.id ? null : p.id)}
                />
              ))}
            </ul>
          </div>
        </Reveal>

        <div className="xl:col-span-2 space-y-5">
          {/* Por revisar */}
          <Reveal delay={0.12}>
            <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
              <BlockTitle icon={<AlertTriangle size={12} />}>Por revisar</BlockTitle>
              {totalRevisar === 0 && (
                <p className="text-sm text-brand-ink/45 mt-3">Nada pendiente: todo lo recibido cuadra.</p>
              )}
              <ul className="mt-3 space-y-3">
                {porRevisar.map((p) => {
                  const c = cuenta(p.cuentaId);
                  return (
                    <li key={p.id} className="rounded-2xl border border-rose-200 bg-rose-50/40 px-4 py-3">
                      <div className="text-sm font-semibold text-brand-ink">{c.cliente} · {c.folio}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[12px]">
                        <Comparar fuente="ERP" monto={p.monto} />
                        <Comparar fuente="REP" monto={p.montoRep ?? 0} />
                      </div>
                      <p className="text-[11px] text-brand-ink/50 mt-2">
                        Diferencia de {fmt(Math.abs(p.monto - (p.montoRep ?? 0)))}. Mientras se decide, se mantiene el monto del ERP.
                      </p>
                      {!soloLectura && (
                        <div className="flex gap-2 mt-2.5">
                          <Accion onClick={() => resolverDiscrepancia(p.id, 'REP')}>Usar REP ({fmt(p.montoRep ?? 0)})</Accion>
                          <Accion onClick={() => resolverDiscrepancia(p.id, 'ERP')}>Mantener ERP</Accion>
                        </div>
                      )}
                    </li>
                  );
                })}
                {noReconocidos.map((n) => (
                  <li key={n.uuid} className="rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                    <div className="text-sm font-semibold text-brand-ink">REP sin factura en Royáltica</div>
                    <p className="text-[12px] text-brand-ink/60 mt-1">
                      {n.nombre} ({n.rfc}) · {fmt(n.monto)} · UUID {n.uuid}. No existe esa factura en la cartera cargada.
                    </p>
                    {!soloLectura && (
                      <div className="flex gap-2 mt-2.5">
                        <Accion onClick={() => descartarNoReconocido(n.uuid)}>Ignorar</Accion>
                        <span className="text-[11px] text-brand-ink/40 self-center">o carga la factura en Datos</span>
                      </div>
                    )}
                  </li>
                ))}
                {soloRep.map((p) => {
                  const c = cuenta(p.cuentaId);
                  return (
                    <li key={p.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 px-4 py-3">
                      <div className="text-sm font-semibold text-brand-ink">{c.cliente}: pagó, pero el ERP no lo tiene</div>
                      <p className="text-[12px] text-brand-ink/60 mt-1">
                        El REP liquida {c.folio} por {fmt(p.monto)}. Se aplicó y se detuvo la cobranza; contabilidad debe registrarlo en {ERP_CONECTADO.nombre}.
                      </p>
                      {!soloLectura && (
                        <div className="flex gap-2 mt-2.5">
                          <Accion onClick={() => marcarEnErp(p.id)}>Ya se aplicó en {ERP_CONECTADO.nombre}</Accion>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>

          {/* REP pendientes */}
          <Reveal delay={0.14}>
            <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
              <BlockTitle icon={<FileCheck2 size={12} />}>REP pendientes</BlockTitle>
              <p className="text-[12px] text-brand-ink/50 mt-1.5 leading-relaxed">
                Pagos de facturas PPD que el ERP ya registró y que aún no tienen complemento de pago emitido.
              </p>
              {repPendientes.length === 0 && <p className="text-sm text-brand-ink/45 mt-3">Todos los pagos tienen su REP.</p>}
              <ul className="mt-3 divide-y divide-brand-ink/6">
                {repPendientes.map((p) => {
                  const c = cuenta(p.cuentaId);
                  return (
                    <li key={p.id} className="py-3 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-brand-ink">{c.cliente}</div>
                        <div className="text-[11px] text-brand-ink/50">
                          {fmt(p.monto)} pagado el {p.fechaPago} · límite {p.limiteRep}{' '}
                          <span className={p.diasRep && p.diasRep <= 7 ? 'text-rose-600 font-semibold' : ''}>({p.diasRep} días)</span>
                        </div>
                      </div>
                      {soloLectura ? null : p.avisado ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                          <Check size={12} /> Avisado
                        </span>
                      ) : (
                        <Accion onClick={() => avisarRep(p.id)}>Avisar a contabilidad</Accion>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ── Piezas ─────────────────────────────────────────────────────────────

function TarjetaFuente({
  titulo,
  etiqueta,
  color,
  texto,
  dato,
  tiempo,
  boton,
  mensaje,
}: {
  titulo: string;
  etiqueta: string;
  color: 'sky' | 'emerald';
  texto: string;
  dato: string;
  tiempo: string;
  boton: React.ReactNode;
  mensaje: string | null;
}) {
  const punto = color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500';
  const chip = color === 'sky' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700';
  return (
    <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-lg font-serif text-brand-ink">
          <span className={`w-2 h-2 rounded-full ${punto}`} />
          {titulo}
        </h4>
        <span className={`audit-badge ${chip}`}>{etiqueta}</span>
      </div>
      <p className="text-[13px] text-brand-ink/65 leading-relaxed mt-2">{texto}</p>
      <div className="text-[11px] text-brand-ink/45 mt-3 space-y-0.5">
        <div>{dato}</div>
        <div>Tiempo: {tiempo}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">{boton}</div>
      <AnimatePresence>
        {mensaje && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="mt-3 text-[12px] text-brand-ink/75 bg-brand-cream border border-brand-gold/30 rounded-xl px-3 py-2"
          >
            {mensaje}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilaPago({
  pago: p,
  cuenta: c,
  pagosFactura,
  abierto,
  onToggle,
}: {
  key?: string;
  pago: Pago;
  cuenta: CuentaViva;
  pagosFactura: Pago[];
  abierto: boolean;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();
  // Una factura PUE no lleva REP: su única fuente es el ERP.
  const estado = p.metodo === 'PUE' ? { label: 'Confirmado · solo ERP', chip: 'bg-emerald-50 text-emerald-700' } : ESTADOS[p.estado];
  const saldo = c.monto - c.pagado;
  return (
    <li>
      <button onClick={onToggle} aria-expanded={abierto} className="w-full text-left px-6 py-4 hover:bg-brand-bone/50 transition-colors">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-brand-ink">
              {c.cliente} <span className="font-normal text-[11px] text-brand-ink/40 font-mono">{c.folio}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {[...new Set(p.evidencias.map((e) => e.fuente))].map((f) => (
                <span key={f} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FUENTE_CHIP[f]}`}>{f}</span>
              ))}
              <span className={`audit-badge ${estado.chip}`}>{estado.label}</span>
              {p.metodo === 'PUE' && <span className="text-[10px] text-brand-ink/45">PUE · no lleva REP</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold text-brand-ink tabular-nums">{fmt(p.monto)}</div>
            <div className="text-[11px] text-brand-ink/45">pagado el {p.fechaPago}</div>
          </div>
          <ChevronDown size={15} className={`text-brand-ink/30 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 space-y-4">
              {/* Factura: total, cada pago y lo que falta */}
              <div>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-brand-ink/55">Factura {c.folio} · total {fmt(c.monto)}</span>
                  <span className={`font-semibold ${saldo <= 1 ? 'text-emerald-700' : 'text-brand-ink'}`}>
                    {saldo <= 1 ? 'Saldada' : `Falta ${fmt(saldo)}`}
                  </span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-brand-ink/8 mt-2">
                  {pagosFactura.map((x) => (
                    <div
                      key={x.id}
                      title={`${fmt(x.monto)} · ${x.fechaPago}`}
                      className={`h-full border-r border-brand-paper ${x.estado === 'confirmado' ? 'bg-emerald-500' : x.estado === 'discrepancia' ? 'bg-rose-400' : 'bg-sky-400'}`}
                      style={{ width: `${(x.monto / c.monto) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 mt-1.5 text-[10px] text-brand-ink/45">
                  <span>{pagosFactura.length} {pagosFactura.length === 1 ? 'pago' : 'pagos'}</span>
                  <span>Pagado {fmt(c.pagado)}</span>
                  <span>{saldo <= 1 ? 'Cobranza detenida' : 'La cobranza sigue sobre el saldo'}</span>
                </div>
              </div>

              {/* Evidencias */}
              <ol className="relative border-l border-brand-ink/10 ml-1.5 space-y-2.5">
                <li className="pl-4 text-[12px]">
                  <span className="absolute -left-[4px] mt-1.5 w-2 h-2 rounded-full bg-brand-ink/30" />
                  <span className="text-brand-ink/45">{p.fechaPago}</span> · <span className="text-brand-ink/75">El cliente paga {fmt(p.monto)}</span>
                </li>
                {p.evidencias.map((e, i) => (
                  <li key={i} className="pl-4 text-[12px]">
                    <span className={`absolute -left-[4px] mt-1.5 w-2 h-2 rounded-full ${e.fuente === 'ERP' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                    <span className="text-brand-ink/45">{e.fecha}</span> ·{' '}
                    <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${FUENTE_CHIP[e.fuente]}`}>{e.fuente}</span>{' '}
                    <span className="text-brand-ink/75">{e.texto}</span>
                  </li>
                ))}
              </ol>
              {p.nota && <p className="text-[12px] text-brand-ink/55 italic">{p.nota}</p>}
              {p.estado === 'solo_erp' && p.metodo === 'PPD' && (
                <p className="text-[12px] text-sky-800 bg-sky-50 rounded-xl px-3 py-2">
                  Esperando REP. Cuando llegue, se empata por UUID y su fecha se vuelve la oficial del pago. Límite: {p.limiteRep}.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Kpi({ label, valor, alerta = false }: { label: string; valor: React.ReactNode; alerta?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</div>
      <div className={`text-xl font-serif mt-1 ${alerta ? 'text-rose-600' : 'text-brand-ink'}`}>{valor}</div>
    </div>
  );
}

function Comparar({ fuente, monto }: { fuente: Fuente; monto: number }) {
  return (
    <div className="rounded-xl bg-brand-paper border border-brand-ink/8 px-3 py-2">
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FUENTE_CHIP[fuente]}`}>{fuente}</span>
      <div className="text-sm font-semibold text-brand-ink tabular-nums mt-1">{fmt(monto)}</div>
    </div>
  );
}

function BotonAccion({ onClick, cargando, icon, children }: { onClick: () => void; cargando: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={cargando}
      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors disabled:opacity-60"
    >
      <span className={cargando ? 'animate-spin' : ''}>{icon}</span>
      {cargando ? 'Procesando…' : children}
    </button>
  );
}

function Accion({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-lg border border-brand-ink/12 bg-brand-paper text-[11px] font-semibold text-brand-ink/70 hover:bg-brand-bone transition-colors"
    >
      {children}
    </button>
  );
}
