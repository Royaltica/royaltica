import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, Download, FileCheck2, Landmark, Loader2, Plus, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE, Reveal, BlockTitle, Figure } from './primitives.tsx';
import { ERP_CONECTADO, type EstadoPago, type Fuente, type Pago } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';
import {
  api,
  type BankImportSummary,
  type BankReviewQueue,
  type BankTransactionItem,
  type ExternalSyncStatus,
  type Receivable,
} from '../../../../services/apiClient.ts';
import { BTN_PRI, BTN_SEC, CONTROL, ETIQUETA, Ventana, useAviso } from './clientes.tsx';
import { PanelSub, Subpestanas, useConfirmar } from './vidrio.tsx';

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
  solo_erp: { label: 'Falta REP', chip: 'bg-sky-50 text-sky-700' },
  solo_rep: { label: 'Solo REP · falta en ERP', chip: 'bg-amber-50 text-amber-700' },
  discrepancia: { label: 'No cuadra', chip: 'bg-rose-50 text-rose-700' },
};

const FUENTE_CHIP: Record<Fuente, string> = {
  ERP: 'bg-sky-100 text-sky-800',
  REP: 'bg-emerald-100 text-emerald-800',
  CSV: 'bg-violet-100 text-violet-800',
};

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);

/** Franja del encabezado: estado de las fuentes de pago. */
export function AvisoPagos({ onIr }: { onIr?: () => void }) {
  const { fuente } = useCobranza();
  if (fuente === 'cargando' || fuente === 'error') return null;
  return fuente === 'real' ? <AvisoPagosReal onIr={onIr} /> : <AvisoPagosEjemplo onIr={onIr} />;
}

/** Cartera real: lo que falta revisar del estado de cuenta del banco. */
function AvisoPagosReal({ onIr }: { onIr?: () => void }) {
  const [cola, setCola] = React.useState<BankReviewQueue | null | undefined>(undefined);
  React.useEffect(() => {
    api
      .getBankReviewQueue()
      .then(setCola)
      .catch(() => setCola(null));
  }, []);
  if (!cola) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-ink/55">
      <span className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${cola.total ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        {cola.total
          ? `Pagos: ${cola.total} movimiento${cola.total === 1 ? '' : 's'} del banco por revisar`
          : 'Pagos: nada pendiente de revisar del banco'}
      </span>
      {onIr && (
        <button onClick={onIr} className="font-semibold text-brand-ink/70 hover:text-brand-ink underline-offset-2 hover:underline">
          Ver pagos →
        </button>
      )}
    </div>
  );
}

function AvisoPagosEjemplo({ onIr }: { onIr?: () => void }) {
  const { erp, pagos, noReconocidos } = useCobranza();
  const pendientes = pagos.filter((p) => p.estado === 'solo_erp' && p.metodo === 'PPD').length;
  const revisar = pagos.filter((p) => p.estado === 'discrepancia' || p.estado === 'solo_rep').length + noReconocidos.length;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-ink/55">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
        Ejemplo · Pagos: {ERP_CONECTADO.nombre} sincronizado {erp.ultima}
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

type PropsPagos = { soloLectura?: boolean; onVerCliente?: (cliente: string) => void };

/**
 * Pagos. Con cartera real todo sale del backend (estado de cuenta del banco,
 * cobros registrados). Sin clientes cargados se muestra el recorrido de
 * ejemplo, rotulado como tal.
 */
export function PagosPanel(props: PropsPagos) {
  const { fuente } = useCobranza();
  if (fuente === 'cargando' || fuente === 'error') return null;
  return fuente === 'real' ? <PagosReales {...props} /> : <PagosEjemplo {...props} />;
}

function PagosEjemplo({ soloLectura = false, onVerCliente }: PropsPagos) {
  const {
    pagos: todosLosPagos,
    cartera,
    noReconocidos,
    erp,
    zipCargado,
    csvCargado,
    subirCsv,
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
  const csvRef = React.useRef<HTMLInputElement>(null);

  // Pagos todavía es de ejemplo: solo se muestran los de clientes que existen
  // en la cartera actual (con clientes reales distintos no hay qué mostrar).
  const pagos = todosLosPagos.filter((p) => cartera.some((c) => c.id === p.cuentaId));
  const cuenta = (id: string) => cartera.find((c) => c.id === id)!;
  const cobrado = pagos.reduce((a, p) => a + p.monto, 0);
  const confirmados = pagos.filter((p) => p.estado === 'confirmado' && p.metodo === 'PPD').length;
  const porRevisar = pagos.filter((p) => p.estado === 'discrepancia');
  const repPendientes = pagos.filter((p) => p.estado === 'solo_erp' && p.metodo === 'PPD');
  const soloRep = pagos.filter((p) => p.estado === 'solo_rep');
  const totalRevisar = porRevisar.length + noReconocidos.length + soloRep.length;
  const [parte, setParte] = React.useState<'revisar' | 'aplicados' | 'rep' | 'cobros' | 'fuentes'>(totalRevisar ? 'revisar' : 'aplicados');
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();

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
      {/* Cifras */}
      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 sm:grid-cols-4 glass rounded-[28px] divide-x divide-white/70">
          <Kpi label="Cobrado en septiembre" valor={<Figure value={cobrado} format="moneda" />} />
          <Kpi label="Confirmados por REP" valor={<Figure value={confirmados} />} />
          <Kpi label="Por revisar" valor={<Figure value={totalRevisar} />} alerta={totalRevisar > 0} />
          <Kpi label="REP pendientes" valor={<Figure value={repPendientes.length} />} />
        </div>
      </Reveal>

      {/* Una parte a la vez: lo urgente primero. */}
      <Subpestanas
        grupo="pagos"
        etiqueta="Partes de Pagos"
        valor={parte}
        onChange={setParte}
        opciones={[
          { id: 'revisar', nombre: 'Por revisar', n: totalRevisar, alerta: true },
          { id: 'aplicados', nombre: 'Pagos aplicados', n: pagos.length },
          { id: 'rep', nombre: 'REP pendientes', n: repPendientes.length },
          { id: 'cobros', nombre: 'Cobros registrados' },
          { id: 'fuentes', nombre: 'Fuentes de pago' },
        ]}
      />
      <PanelSub id={parte}>
        {parte === 'fuentes' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
        <Reveal delay={0.1}>
          <TarjetaFuente
            titulo="CSV · reporte de cartera"
            etiqueta="Sin integración"
            color="violet"
            texto="Para ERPs sin conexión: sube el reporte de facturas con su saldo. Royáltica lo compara con el anterior y registra los pagos y las facturas nuevas."
            dato={csvCargado ? 'Último reporte: hoy, 14 facturas' : 'Último reporte: 21 sep, 13 facturas'}
            tiempo="Cada vez que lo subas (sugerido: diario o semanal)"
            boton={
              soloLectura ? null : (
                <>
                  <BotonAccion onClick={() => csvRef.current?.click()} cargando={cargando === 'CSV'} icon={<Upload size={13} />}>
                    Subir CSV
                  </BotonAccion>
                  {/* Mockup: cualquier archivo dispara la simulación. */}
                  <input
                    ref={csvRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) correr('CSV', subirCsv);
                      e.target.value = '';
                    }}
                  />
                  <button onClick={() => correr('CSV', subirCsv)} className="text-[11px] font-semibold text-brand-ink/45 hover:text-brand-ink">
                    Usar CSV de ejemplo
                  </button>
                </>
              )
            }
            mensaje={mensaje?.fuente === 'CSV' ? mensaje.texto : null}
          />
        </Reveal>
      </div>
        )}
        {parte === 'aplicados' && (
        <div>
          <div className="glass rounded-[28px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/70">
              <BlockTitle>Pagos aplicados</BlockTitle>
              <span className="text-[11px] text-brand-ink/40">Da clic para ver la factura y sus evidencias</span>
            </div>
            <ul className="divide-y divide-white/70">
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
        </div>
        )}
        {parte === 'revisar' && (
          <div>
            <div className="glass rounded-[28px] p-6">
              <BlockTitle icon={<AlertTriangle size={12} />}>Por revisar</BlockTitle>
              {totalRevisar === 0 && (
                <p className="text-sm text-brand-ink/45 mt-3">Nada pendiente: todo lo recibido cuadra.</p>
              )}
              <ul className="mt-3 space-y-3">
                {porRevisar.map((p) => {
                  const c = cuenta(p.cuentaId);
                  return (
                    <li key={p.id} className="rounded-[20px] bg-rose-500/[0.07] ring-1 ring-rose-500/20 px-4 py-3.5">
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
                          <Accion
                            onClick={() =>
                              confirmar({
                                titulo: `¿Usar el monto del REP para ${c.cliente}?`,
                                mensaje: `El pago de ${c.folio} queda en ${fmt(p.montoRep ?? 0)} (el ERP decía ${fmt(p.monto)}). El saldo y la cobranza se recalculan con ese monto.`,
                                accion: 'Usar REP',
                                alConfirmar: () => {
                                  resolverDiscrepancia(p.id, 'REP');
                                },
                              })
                            }
                          >
                            Usar REP ({fmt(p.montoRep ?? 0)})
                          </Accion>
                          <Accion
                            onClick={() =>
                              confirmar({
                                titulo: `¿Mantener el monto del ERP para ${c.cliente}?`,
                                mensaje: `El pago de ${c.folio} se queda en ${fmt(p.monto)} y se ignora la diferencia con el REP.`,
                                accion: 'Mantener ERP',
                                alConfirmar: () => {
                                  resolverDiscrepancia(p.id, 'ERP');
                                },
                              })
                            }
                          >
                            Mantener ERP
                          </Accion>
                        </div>
                      )}
                    </li>
                  );
                })}
                {noReconocidos.map((n) => (
                  <li key={n.uuid} className="rounded-[20px] bg-amber-500/[0.08] ring-1 ring-amber-500/25 px-4 py-3.5">
                    <div className="text-sm font-semibold text-brand-ink">REP sin factura en Royáltica</div>
                    <p className="text-[12px] text-brand-ink/60 mt-1">
                      {n.nombre} ({n.rfc}) · {fmt(n.monto)} · UUID {n.uuid}. No existe esa factura en la cartera cargada.
                    </p>
                    {!soloLectura && (
                      <div className="flex gap-2 mt-2.5">
                        <Accion
                          onClick={() =>
                            confirmar({
                              titulo: '¿Ignorar este REP?',
                              mensaje: `${n.nombre} · ${fmt(n.monto)}. Sale de la lista de revisión y no se aplica a ninguna factura.`,
                              accion: 'Ignorar REP',
                              peligro: true,
                              alConfirmar: () => {
                                descartarNoReconocido(n.uuid);
                              },
                            })
                          }
                        >
                          Ignorar
                        </Accion>
                        <span className="text-[11px] text-brand-ink/40 self-center">o carga la factura en Datos</span>
                      </div>
                    )}
                  </li>
                ))}
                {soloRep.map((p) => {
                  const c = cuenta(p.cuentaId);
                  return (
                    <li key={p.id} className="rounded-[20px] bg-amber-500/[0.08] ring-1 ring-amber-500/25 px-4 py-3.5">
                      <div className="text-sm font-semibold text-brand-ink">{c.cliente}: pagó, pero el ERP no lo tiene</div>
                      <p className="text-[12px] text-brand-ink/60 mt-1">
                        El REP liquida {c.folio} por {fmt(p.monto)}. Se aplicó y se detuvo la cobranza; contabilidad debe registrarlo en {ERP_CONECTADO.nombre}.
                      </p>
                      {!soloLectura && (
                        <div className="flex gap-2 mt-2.5">
                          <Accion
                            onClick={() =>
                              confirmar({
                                titulo: `¿Ya se aplicó en ${ERP_CONECTADO.nombre}?`,
                                mensaje: `Confirma que contabilidad registró el pago de ${c.folio} (${fmt(p.monto)}) en ${ERP_CONECTADO.nombre}.`,
                                accion: 'Sí, ya se aplicó',
                                alConfirmar: () => {
                                  marcarEnErp(p.id);
                                },
                              })
                            }
                          >
                            Ya se aplicó en {ERP_CONECTADO.nombre}
                          </Accion>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
        {parte === 'rep' && (
          <div>
            <div className="glass rounded-[28px] p-6">
              <BlockTitle icon={<FileCheck2 size={12} />}>REP pendientes</BlockTitle>
              <p className="text-[12px] text-brand-ink/50 mt-1.5 leading-relaxed">
                Pagos de facturas PPD que ya se registraron (por ERP o CSV) y que aún no tienen complemento de pago emitido.
              </p>
              {repPendientes.length === 0 && <p className="text-sm text-brand-ink/45 mt-3">Todos los pagos tienen su REP.</p>}
              <ul className="mt-3 divide-y divide-white/70">
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
          </div>
        )}
        {parte === 'cobros' && <CobrosRegistrados soloLectura={soloLectura} onVerCliente={onVerCliente} />}
      </PanelSub>
      {nodoConfirmar}
    </div>
  );
}

// ── Pagos con cartera real ────────────────────────────────────────────
// Fuente de verdad: el estado de cuenta del banco (se sube el CSV, el
// backend empata cada depósito con su factura) y los cobros que alguien
// registra a mano. Nada aquí es simulado.

const ESTADO_MOV: Record<BankTransactionItem['matchStatus'], { label: string; chip: string }> = {
  AUTO_MATCHED: { label: 'Empate sugerido', chip: 'bg-emerald-50 text-emerald-700' },
  AMBIGUOUS: { label: 'Varias facturas posibles', chip: 'bg-amber-50 text-amber-700' },
  UNMATCHED: { label: 'Sin factura', chip: 'bg-rose-50 text-rose-700' },
  MANUALLY_MATCHED: { label: 'Confirmado', chip: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Descartado', chip: 'bg-brand-ink/5 text-brand-ink/50' },
};

function PagosReales({ soloLectura = false, onVerCliente }: PropsPagos) {
  const { cartera, recargarCartera } = useCobranza();
  const { avisar, nodo } = useAviso();
  const [cola, setCola] = React.useState<BankReviewQueue | null | undefined>(undefined);
  const [cargas, setCargas] = React.useState<BankImportSummary[] | null | undefined>(undefined);
  const [cobros, setCobros] = React.useState<Receivable[] | null>(null);
  const [erp, setErp] = React.useState<ExternalSyncStatus | null>(null);
  const [ocupado, setOcupado] = React.useState<string | null>(null);
  const [subiendo, setSubiendo] = React.useState(false);
  const [resultado, setResultado] = React.useState<string | null>(null);
  const [banco, setBanco] = React.useState('');
  const [eleccion, setEleccion] = React.useState<Record<string, string>>({});
  const archivoRef = React.useRef<HTMLInputElement>(null);

  const cargar = React.useCallback(async () => {
    const [q, i, c] = await Promise.allSettled([api.getBankReviewQueue(), api.listBankImports(), api.getReceivables({ status: 'PAID' })]);
    setCola(q.status === 'fulfilled' ? q.value : null);
    setCargas(i.status === 'fulfilled' ? i.value : null);
    setCobros(c.status === 'fulfilled' ? c.value : null);
  }, []);
  React.useEffect(() => {
    void cargar();
    api
      .getExternalSyncStatus()
      .then(setErp)
      .catch(() => setErp(null));
  }, [cargar]);

  // Facturas abiertas de la cartera, para empatar a mano un depósito.
  const abiertas = React.useMemo(
    () =>
      cartera
        .flatMap((c) =>
          c.facturas
            .filter((f) => f.dbId && f.monto - (f.pagado ?? 0) > 1)
            .map((f) => ({ id: f.dbId as string, cliente: c.cliente, folio: f.folio, monto: f.monto })),
        )
        .sort((a, b) => a.cliente.localeCompare(b.cliente, 'es')),
    [cartera],
  );
  const facturaDe = (id: string | null) => (id ? abiertas.find((f) => f.id === id) ?? null : null);

  const mesActual = new Date().toISOString().slice(0, 7);
  const delMes = (cobros ?? []).filter((r) => (r.paidDate ?? '').slice(0, 7) === mesActual);
  const cobradoMes = delMes.reduce((a, r) => a + Number(r.total), 0);
  const nombreMes = new Date().toLocaleDateString('es-MX', { month: 'long' });
  const porRevisar = cola?.total ?? 0;
  const [parte, setParte] = React.useState<'revisar' | 'aplicados' | 'rep' | 'cobros' | 'fuentes'>('revisar');

  const confirmar = async (tx: BankTransactionItem) => {
    const invoiceId = eleccion[tx.id] || tx.matchedInvoiceId || undefined;
    if (!invoiceId) return;
    setOcupado(tx.id);
    try {
      await api.confirmBankMatch(tx.id, invoiceId);
      const f = facturaDe(invoiceId);
      avisar(f ? `Pago aplicado a ${f.cliente} · ${f.folio}.` : 'Pago aplicado a la factura.');
      await Promise.all([cargar(), recargarCartera()]);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo aplicar el pago.');
    } finally {
      setOcupado(null);
    }
  };
  const descartar = async (tx: BankTransactionItem) => {
    setOcupado(tx.id);
    try {
      await api.rejectBankMatch(tx.id);
      avisar('Movimiento descartado: no se aplicó a ninguna factura.');
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo descartar.');
    } finally {
      setOcupado(null);
    }
  };
  const subir = async (archivo: File) => {
    setSubiendo(true);
    setResultado(null);
    try {
      const r = await api.importBankStatement(archivo, banco.trim() || undefined);
      const partes = [
        `${r.imported} movimiento${r.imported === 1 ? '' : 's'} leído${r.imported === 1 ? '' : 's'}`,
        `${r.autoMatched} con factura sugerida`,
        `${r.ambiguous} con varias facturas posibles`,
      ];
      if (r.skipped) partes.push(`${r.skipped} repetido${r.skipped === 1 ? '' : 's'} (ya estaban)`);
      setResultado(`${partes.join(' · ')}.${r.errors.length ? ` Con ${r.errors.length} renglón(es) que no se pudieron leer: ${r.errors.slice(0, 3).join(' | ')}` : ''}`);
      await cargar();
      if (r.imported) setParte('revisar');
    } catch (e) {
      setResultado(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setSubiendo(false);
    }
  };

  const fechaMov = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="space-y-5">
      <Reveal delay={0.08}>
        <div className="grid grid-cols-2 sm:grid-cols-4 glass rounded-[28px] divide-x divide-white/70">
          <Kpi label={`Cobrado en ${nombreMes}`} valor={<Figure value={cobradoMes} format="moneda" />} />
          <Kpi label="Cobros del mes" valor={<Figure value={delMes.length} />} />
          <Kpi label="Por revisar del banco" valor={<Figure value={porRevisar} />} alerta={porRevisar > 0} />
          <Kpi label="Estados de cuenta cargados" valor={<Figure value={cargas?.length ?? 0} />} />
        </div>
      </Reveal>

      <Subpestanas
        grupo="pagos"
        etiqueta="Partes de Pagos"
        valor={parte}
        onChange={setParte}
        opciones={[
          { id: 'revisar', nombre: 'Por revisar', n: porRevisar, alerta: true },
          { id: 'aplicados', nombre: 'Pagos aplicados', n: cargas?.length ?? 0 },
          { id: 'rep', nombre: 'REP pendientes' },
          { id: 'cobros', nombre: 'Cobros registrados' },
          { id: 'fuentes', nombre: 'Fuentes de pago' },
        ]}
      />
      <PanelSub id={parte}>
        {parte === 'revisar' && (
          <div className="glass rounded-[28px] p-6">
            <BlockTitle icon={<AlertTriangle size={12} />}>Por revisar</BlockTitle>
            <p className="text-[12px] text-brand-ink/50 mt-1.5 leading-relaxed">
              Depósitos del estado de cuenta que todavía no se aplican. Un pago solo detiene la cobranza cuando alguien lo confirma aquí.
            </p>
            {cola === undefined ? (
              <p className="text-[13px] text-brand-ink/45 mt-4 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Cargando movimientos…
              </p>
            ) : cola === null ? (
              <p className="text-[13px] text-rose-600 mt-4">No se pudo leer la conciliación. Revisa la conexión y vuelve a entrar.</p>
            ) : cola.items.length === 0 ? (
              <p className="text-sm text-brand-ink/45 mt-4">
                Nada pendiente.{' '}
                {cargas?.length ? 'Todo lo del último estado de cuenta ya se revisó.' : 'Sube el estado de cuenta del banco en "Fuentes de pago" para detectar los pagos.'}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {cola.items.map((tx) => {
                  const sugerida = facturaDe(tx.matchedInvoiceId);
                  const elegida = eleccion[tx.id] ?? tx.matchedInvoiceId ?? '';
                  const est = ESTADO_MOV[tx.matchStatus];
                  return (
                    <li key={tx.id} className="rounded-[20px] bg-white/45 ring-1 ring-brand-ink/[0.07] px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-semibold text-brand-ink tabular-nums">{fmt(Number(tx.amount))}</span>
                        <span className="text-[12px] text-brand-ink/50">{fechaMov(tx.transactionDate)}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${est.chip}`}>{est.label}</span>
                        {tx.matchConfidence !== null && tx.matchStatus === 'AUTO_MATCHED' && (
                          <span className="text-[11px] text-brand-ink/40">coincidencia {Math.round(Number(tx.matchConfidence) * 100)}%</span>
                        )}
                      </div>
                      <p className="text-[12px] text-brand-ink/60 mt-1 break-words">
                        {tx.description}
                        {tx.referenceNumber ? ` · ref. ${tx.referenceNumber}` : ''}
                      </p>
                      {sugerida && (
                        <p className="text-[12px] text-brand-ink/70 mt-1.5">
                          Sugerencia:{' '}
                          <button type="button" onClick={() => onVerCliente?.(sugerida.cliente)} className="font-semibold hover:underline">
                            {sugerida.cliente}
                          </button>{' '}
                          · {sugerida.folio} · {fmt(sugerida.monto)}
                        </p>
                      )}
                      {!soloLectura && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <select
                            value={elegida}
                            onChange={(e) => setEleccion((m) => ({ ...m, [tx.id]: e.target.value }))}
                            className={CONTROL + ' !w-auto !py-1.5 !text-[12px] max-w-full'}
                            aria-label="Factura a la que corresponde"
                          >
                            <option value="">Elige la factura…</option>
                            {tx.matchedInvoiceId && !sugerida && <option value={tx.matchedInvoiceId}>Factura sugerida</option>}
                            {abiertas.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.cliente} · {f.folio} · {fmt(f.monto)}
                              </option>
                            ))}
                          </select>
                          <button type="button" disabled={!elegida || ocupado === tx.id} onClick={() => void confirmar(tx)} className={BTN_PRI}>
                            {ocupado === tx.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aplicar pago
                          </button>
                          <button type="button" disabled={ocupado === tx.id} onClick={() => void descartar(tx)} className={BTN_SEC}>
                            No es un pago de cliente
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        {parte === 'aplicados' && (
          <div className="glass rounded-[28px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/70">
              <BlockTitle>Estados de cuenta procesados</BlockTitle>
              <div className="text-[12px] text-brand-ink/50 mt-1">Cada carga del banco, con cuántos depósitos ya quedaron aplicados a una factura.</div>
            </div>
            {cargas === undefined ? (
              <p className="px-6 py-8 text-[13px] text-brand-ink/45 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Cargando…
              </p>
            ) : cargas === null ? (
              <p className="px-6 py-8 text-[13px] text-rose-600">No se pudieron leer las cargas.</p>
            ) : !cargas.length ? (
              <p className="px-6 py-8 text-center text-[13px] text-brand-ink/45">Todavía no se ha subido ningún estado de cuenta.</p>
            ) : (
              <ul className="divide-y divide-white/70">
                {cargas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 py-3">
                    <div className="min-w-[160px] flex-1">
                      <div className="text-sm font-semibold text-brand-ink">{c.bankName || 'Banco'}</div>
                      <div className="text-[11px] text-brand-ink/45">
                        Subido el {fechaMov(c.importedAt)}
                        {c.periodFrom && c.periodTo ? ` · movimientos del ${fechaMov(c.periodFrom)} al ${fechaMov(c.periodTo)}` : ''}
                      </div>
                    </div>
                    <div className="text-[12px] text-brand-ink/60 tabular-nums">{c.totalTransactions} movimientos</div>
                    <div className="text-[12px] text-emerald-700 font-semibold tabular-nums">{c.matchedCount} aplicados</div>
                    <div className={`text-[12px] tabular-nums ${c.unmatchedCount ? 'text-amber-700 font-semibold' : 'text-brand-ink/40'}`}>{c.unmatchedCount} sin aplicar</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {parte === 'rep' && (
          <div className="glass rounded-[28px] p-6">
            <BlockTitle icon={<FileCheck2 size={12} />}>REP pendientes</BlockTitle>
            <p className="text-sm text-brand-ink/60 mt-3 leading-relaxed max-w-2xl">
              La lectura de complementos de pago (REP) todavía no está conectada, así que aquí no hay nada que mostrar. Hoy los pagos se detectan con el
              estado de cuenta del banco y con los cobros que registras a mano.
            </p>
          </div>
        )}
        {parte === 'cobros' && <CobrosRegistrados soloLectura={soloLectura} onVerCliente={onVerCliente} />}
        {parte === 'fuentes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass rounded-[28px] p-6 h-full flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-lg font-serif text-brand-ink">
                  <Landmark size={15} className="text-emerald-600" /> Estado de cuenta del banco
                </h4>
                <span className="audit-badge bg-emerald-50 text-emerald-700">Conectado</span>
              </div>
              <p className="text-[13px] text-brand-ink/65 leading-relaxed mt-2">
                Sube el CSV de movimientos que descargas de tu banca en línea. Cada depósito se compara con tus facturas abiertas; lo que coincide queda
                como sugerencia y tú lo confirmas en "Por revisar".
              </p>
              <div className="text-[11px] text-brand-ink/45 mt-3">
                {cargas?.length ? `Última carga: ${fechaMov(cargas[0].importedAt)} · ${cargas[0].totalTransactions} movimientos` : 'Aún no hay cargas.'}
              </div>
              {!soloLectura && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <input
                    value={banco}
                    onChange={(e) => setBanco(e.target.value)}
                    placeholder="Banco (opcional)"
                    className={CONTROL + ' !w-40 !py-1.5 !text-[12px]'}
                    aria-label="Nombre del banco"
                  />
                  <BotonAccion onClick={() => archivoRef.current?.click()} cargando={subiendo} icon={<Upload size={13} />}>
                    Subir CSV del banco
                  </BotonAccion>
                  <input
                    ref={archivoRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void subir(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
              {resultado && <p className="text-[12px] text-brand-ink/70 mt-3 leading-relaxed">{resultado}</p>}
            </div>
            <div className="glass rounded-[28px] p-6 h-full flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-lg font-serif text-brand-ink">
                  <RefreshCw size={14} className="text-sky-600" /> ERP
                </h4>
                <span className={`audit-badge ${erp?.restConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-ink/5 text-brand-ink/50'}`}>
                  {erp?.restConfigured ? `Conectado${erp.externalSyncProvider ? ` · ${erp.externalSyncProvider}` : ''}` : 'Sin conexión'}
                </span>
              </div>
              <p className="text-[13px] text-brand-ink/65 leading-relaxed mt-2">
                {erp?.restConfigured
                  ? erp.message
                  : 'Tu ERP no está conectado. Mientras tanto la cartera se actualiza subiendo tu reporte en la sección Datos, y los pagos con el estado de cuenta del banco.'}
              </p>
            </div>
            <div className="glass rounded-[28px] p-6 h-full flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-lg font-serif text-brand-ink">
                  <FileCheck2 size={14} className="text-violet-600" /> REP · complemento de pago
                </h4>
                <span className="audit-badge bg-brand-ink/5 text-brand-ink/50">Próximamente</span>
              </div>
              <p className="text-[13px] text-brand-ink/65 leading-relaxed mt-2">
                El REP confirma fiscalmente un pago que ya entró. Su lectura automática todavía no está disponible.
              </p>
            </div>
          </div>
        )}
      </PanelSub>
      {nodo}
    </div>
  );
}

// ── Cobros registrados en la base (reales): ver, exportar, revertir ───

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

function CobrosRegistrados({ soloLectura, onVerCliente }: { soloLectura: boolean; onVerCliente?: (cliente: string) => void }) {
  const { cartera, fuente, revertirCobro } = useCobranza();
  const { avisar, nodo } = useAviso();
  const [cobros, setCobros] = React.useState<Receivable[] | null | undefined>(undefined);
  const [cliente, setCliente] = React.useState('');
  const [revertir, setRevertir] = React.useState<Receivable | null>(null);
  const [registrar, setRegistrar] = React.useState(false);

  const cargar = React.useCallback(async () => {
    try {
      setCobros(await api.getReceivables({ status: 'PAID' }));
    } catch {
      setCobros(null);
    }
  }, []);
  // Se lee al abrir y otra vez cuando cambia la cartera (alguien cobró o revirtió).
  React.useEffect(() => {
    if (fuente === 'real') void cargar();
  }, [cartera, fuente, cargar]);

  if (fuente !== 'real') return null;
  const nombreDe = (r: Receivable) => r.customer?.name ?? cartera.find((c) => c.dbId === r.customerId)?.cliente ?? '—';
  const visibles = (cobros ?? [])
    .filter((r) => !cliente || r.customerId === cliente)
    .sort((a, b) => (b.paidDate ?? '').localeCompare(a.paidDate ?? ''));
  const total = visibles.reduce((a, r) => a + Number(r.total), 0);
  const clientes = [...new Map<string, string>((cobros ?? []).map((r) => [r.customerId ?? '', nombreDe(r)])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], 'es'),
  );

  const exportar = () => {
    const esc = (v: unknown) => {
      const t = String(v ?? '');
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const filas = [['Cliente', 'Folio', 'UUID', 'Total', 'Fecha de pago', 'Vencía'], ...visibles.map((r) => [nombreDe(r), r.folio ?? '', r.cfdiUuid, r.total, r.paidDate?.slice(0, 10) ?? '', r.dueDate?.slice(0, 10) ?? ''])];
    const blob = new Blob(['\uFEFF' + filas.map((f) => f.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cobros-registrados.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Reveal delay={0.16}>
      <div className="glass rounded-[28px] overflow-hidden mt-5">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-white/70">
          <div>
            <BlockTitle>Cobros registrados</BlockTitle>
            <div className="text-[12px] text-brand-ink/50 mt-1">
              Facturas marcadas como cobradas en tu base · {visibles.length} · <span className="font-semibold text-brand-ink">{fmt(total)}</span>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={CONTROL + ' !w-auto !py-1.5 !text-[12px]'} aria-label="Filtrar por cliente">
              <option value="">Todos los clientes</option>
              {clientes.map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
            <button type="button" onClick={exportar} disabled={!visibles.length} className={BTN_SEC}>
              <Download size={11} /> Exportar CSV
            </button>
            {!soloLectura && (
              <button
                type="button"
                onClick={() => setRegistrar(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-ink text-brand-paper text-[11px] font-semibold hover:bg-brand-ink/85"
              >
                <Plus size={11} /> Registrar pago
              </button>
            )}
          </div>
        </div>
        {cobros === undefined ? (
          <p className="px-6 py-8 text-[13px] text-brand-ink/45 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Cargando cobros…
          </p>
        ) : cobros === null ? (
          <p className="px-6 py-8 text-[13px] text-rose-600">No se pudieron leer los cobros. Revisa la conexión y vuelve a entrar.</p>
        ) : !visibles.length ? (
          <p className="px-6 py-8 text-center text-[13px] text-brand-ink/45">Todavía no hay cobros registrados.</p>
        ) : (
          <ul className="divide-y divide-white/70 max-h-[420px] overflow-y-auto">
            {visibles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-6 py-3">
                <div className="min-w-[180px] flex-1">
                  <button
                    type="button"
                    onClick={() => onVerCliente?.(nombreDe(r))}
                    className="text-sm font-semibold text-brand-ink hover:underline text-left"
                  >
                    {nombreDe(r)}
                  </button>
                  <div className="text-[11px] text-brand-ink/45 font-mono">{r.folio ?? r.cfdiUuid.slice(0, 8)}</div>
                </div>
                <div className="text-[13px] font-semibold text-brand-ink tabular-nums min-w-[110px]">{fmt(Number(r.total))}</div>
                <div className="text-[12px] text-brand-ink/55 min-w-[150px]">
                  Pagó el {fechaCorta(r.paidDate)}
                  {r.dueDate && r.paidDate && (
                    <span className={r.paidDate.slice(0, 10) > r.dueDate.slice(0, 10) ? ' text-rose-600' : ' text-emerald-700'}>
                      {' · '}
                      {r.paidDate.slice(0, 10) > r.dueDate.slice(0, 10) ? 'tarde' : 'a tiempo'}
                    </span>
                  )}
                </div>
                {!soloLectura && (
                  <button type="button" onClick={() => setRevertir(r)} className={BTN_SEC} title="Regresa la factura a por cobrar">
                    <RotateCcw size={11} /> Revertir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {revertir && (
        <Revertir
          cobro={revertir}
          nombre={nombreDe(revertir)}
          onCerrar={() => setRevertir(null)}
          onConfirmar={async (motivo) => {
            const err = await revertirCobro(revertir.id, motivo);
            if (err) return err;
            avisar(`La factura ${revertir.folio ?? ''} regresó a por cobrar`);
            setRevertir(null);
            void cargar();
            return null;
          }}
        />
      )}
      {registrar && <RegistrarPago onCerrar={() => setRegistrar(false)} avisar={avisar} />}
      {nodo}
    </Reveal>
  );
}

function Revertir({
  cobro,
  nombre,
  onCerrar,
  onConfirmar,
}: {
  cobro: Receivable;
  nombre: string;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => Promise<string | null>;
}) {
  const [motivo, setMotivo] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Ventana titulo={`Revertir el cobro de ${cobro.folio ?? cobro.cfdiUuid.slice(0, 8)}`} subtitulo={`${nombre} · ${fmt(Number(cobro.total))}`} onCerrar={onCerrar} ancho="max-w-md">
      <p className="text-[12.5px] text-brand-ink/60 leading-relaxed">
        La factura regresa a por cobrar y su plan de cobranza puede volver a escribirle. Queda registrado quién lo hizo y por qué.
      </p>
      <label className="block mt-3">
        <span className={ETIQUETA}>Motivo *</span>
        <input className={CONTROL + ' mt-1'} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Se registró en el cliente equivocado" />
      </label>
      {error && <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
          Volver
        </button>
        <button
          type="button"
          disabled={!motivo.trim() || ocupado}
          onClick={async () => {
            setOcupado(true);
            setError(await onConfirmar(motivo.trim()));
            setOcupado(false);
          }}
          className={BTN_PRI}
        >
          {ocupado && <Loader2 size={13} className="animate-spin" />} Revertir cobro
        </button>
      </div>
    </Ventana>
  );
}

/** Registrar un pago a mano: cliente → factura → fecha y referencia. */
function RegistrarPago({ onCerrar, avisar }: { onCerrar: () => void; avisar: ReturnType<typeof useAviso>['avisar'] }) {
  const { cartera, cobrarFactura } = useCobranza();
  const conAbiertas = cartera.filter((c) => c.dbId && c.facturas.some((f) => f.dbId && f.monto - f.pagado > 1));
  const [clienteId, setClienteId] = React.useState(conAbiertas[0]?.id ?? '');
  const cuenta = cartera.find((c) => c.id === clienteId);
  const facturas = cuenta?.facturas.filter((f) => f.dbId && f.monto - f.pagado > 1) ?? [];
  const [folio, setFolio] = React.useState('');
  const factura = facturas.find((f) => f.folio === folio) ?? facturas[0];
  const [fecha, setFecha] = React.useState(new Date().toISOString().slice(0, 10));
  const [referencia, setReferencia] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const guardar = async () => {
    if (!factura?.dbId) return;
    setOcupado(true);
    setError(null);
    const err = await cobrarFactura(factura.dbId, fecha, referencia);
    setOcupado(false);
    if (err) return setError(err);
    avisar(`Registraste el pago de ${factura.folio} de ${cuenta!.cliente}`);
    onCerrar();
  };

  return (
    <Ventana titulo="Registrar pago" subtitulo="La factura queda como cobrada y su plan se detiene." onCerrar={onCerrar} ancho="max-w-md">
      {!conAbiertas.length ? (
        <p className="text-[13px] text-brand-ink/60">No hay facturas abiertas en tu cartera.</p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={ETIQUETA}>Cliente</span>
            <select
              className={CONTROL + ' mt-1'}
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setFolio('');
              }}
            >
              {conAbiertas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.cliente}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={ETIQUETA}>Factura</span>
            <select className={CONTROL + ' mt-1'} value={factura?.folio ?? ''} onChange={(e) => setFolio(e.target.value)}>
              {facturas.map((f) => (
                <option key={f.folio} value={f.folio}>
                  {f.folio} · {fmt(f.monto - f.pagado)} · vence {f.vence}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={ETIQUETA}>Fecha en que pagó</span>
              <input type="date" className={CONTROL + ' mt-1'} value={fecha} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="block">
              <span className={ETIQUETA}>Referencia</span>
              <input className={CONTROL + ' mt-1'} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="SPEI, depósito…" />
            </label>
          </div>
          {error && <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
              Cancelar
            </button>
            <button type="button" onClick={() => void guardar()} disabled={!factura || !fecha || ocupado} className={BTN_PRI}>
              {ocupado && <Loader2 size={13} className="animate-spin" />} Registrar pago
            </button>
          </div>
        </div>
      )}
    </Ventana>
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
  color: 'sky' | 'emerald' | 'violet';
  texto: string;
  dato: string;
  tiempo: string;
  boton: React.ReactNode;
  mensaje: string | null;
}) {
  const punto = { sky: 'bg-sky-500', emerald: 'bg-emerald-500', violet: 'bg-violet-500' }[color];
  const chip = { sky: 'bg-sky-50 text-sky-700', emerald: 'bg-emerald-50 text-emerald-700', violet: 'bg-violet-50 text-violet-700' }[color];
  return (
    <div className="glass rounded-[28px] p-6 h-full flex flex-col">
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
      <button onClick={onToggle} aria-expanded={abierto} className="w-full text-left px-6 py-4 hover:bg-white/45 transition-colors">
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
                    <span className={`absolute -left-[4px] mt-1.5 w-2 h-2 rounded-full ${{ ERP: 'bg-sky-500', REP: 'bg-emerald-500', CSV: 'bg-violet-500' }[e.fuente]}`} />
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
    <div className="rounded-2xl glass-suave px-3 py-2">
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
      className="px-2.5 py-1.5 rounded-lg glass-campo text-[11px] font-semibold text-brand-ink/70 hover:bg-white/70 transition-colors"
    >
      {children}
    </button>
  );
}
