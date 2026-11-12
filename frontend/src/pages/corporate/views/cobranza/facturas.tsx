import React, { type ReactNode } from 'react';
import { AlertTriangle, Ban, Check, Loader2, Play, Plus } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { BlockTitle } from './primitives.tsx';
import { PLANTILLA, cuandoPaso } from './plan.tsx';
import { useCobranza, planCuenta, type CuentaViva, type FacturaViva } from './store.tsx';
import { BTN_PRI, BTN_SEC, CONTROL, ETIQUETA, Ventana, useAviso } from './clientes.tsx';
import { useConfirmar } from './vidrio.tsx';

const hoyIso = () => new Date().toISOString().slice(0, 10);
type Avisar = ReturnType<typeof useAviso>['avisar'];

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);

/**
 * Facturas del cliente: qué hay que cobrar, desde cuándo se está cobrando
 * cada una y el botón para arrancar el plan (niveles 0–4 y etapas A–D) en
 * las facturas que todavía no lo tienen. Arriba, su comportamiento histórico
 * ante campañas especiales, para no premiar a quien espera el descuento.
 */
export function SubFacturas({ cuenta: c }: { cuenta: CuentaViva }) {
  const { iniciarPlanes } = useCobranza();
  const { avisar, nodo } = useAviso();
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();
  // Iniciar el plan manda el primer mensaje: se confirma antes.
  const pedirInicio = (folios: string[]) =>
    confirmar({
      titulo: folios.length > 1 ? `¿Iniciar el plan de ${folios.length} facturas?` : `¿Iniciar el plan de ${folios[0]}?`,
      mensaje: (
        <>
          A <b className="text-brand-ink">{c.cliente}</b> le sale hoy el nivel 0 (confirmación de factura)
          {c.finanzas ? ` por WhatsApp a ${c.finanzas.nombre}` : ''}. Los siguientes niveles se activan solos según el vencimiento.
        </>
      ),
      accion: folios.length > 1 ? `Iniciar ${folios.length} planes` : 'Iniciar plan',
      alConfirmar: () => {
        iniciarPlanes(folios);
        avisar(folios.length > 1 ? `Iniciaste el plan de ${folios.length} facturas` : `Iniciaste el plan de ${folios[0]}`);
      },
    });
  const [nueva, setNueva] = React.useState(false);
  const sinPlan = c.facturas.filter((f) => !f.planInicio);
  const porCobrar = c.facturas.reduce((a, f) => a + (f.monto - f.pagado), 0);

  return (
    <div className="px-7 py-6 space-y-6">
      <Comportamiento cuenta={c} />

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <BlockTitle>Facturas por cobrar</BlockTitle>
            <div className="text-[12px] text-brand-ink/55 mt-1">
              {c.facturas.length} {c.facturas.length === 1 ? 'factura' : 'facturas'} ·{' '}
              <span className="font-semibold text-brand-ink">{fmt(porCobrar)}</span> por cobrar en total
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setNueva(true)}
            disabled={!c.dbId}
            title={c.dbId ? 'Dar de alta una factura de este cliente' : 'Cliente de ejemplo'}
            className={BTN_SEC + ' !py-2 !px-3 !text-[12px]'}
          >
            <Plus size={12} /> Agregar factura
          </button>
          {sinPlan.length > 0 && (
            <button
              onClick={() => pedirInicio(sinPlan.map((f) => f.folio))}
              className={BTN_PRI + ' !py-2 !px-3.5 !text-[12px]'}
            >
              <Play size={12} /> Iniciar plan {sinPlan.length > 1 ? `de las ${sinPlan.length}` : ''}
            </button>
          )}
          </div>
        </div>

        <ul className="mt-3 glass-suave rounded-[22px] divide-y divide-white/70 overflow-hidden">
          {c.facturas.map((f) => (
            <FilaFactura key={f.folio} factura={f} cuenta={c} avisar={avisar} onIniciar={() => pedirInicio([f.folio])} />
          ))}
        </ul>
        <p className="text-[11px] text-brand-ink/40 mt-2 leading-relaxed">
          Al iniciar el plan sale el nivel 0 (confirmación de factura) y los siguientes niveles se activan solos según la
          fecha de vencimiento.
        </p>
      </div>
      {nueva && <NuevaFactura cuenta={c} onCerrar={() => setNueva(false)} avisar={avisar} />}
      {nodo}
      {nodoConfirmar}
    </div>
  );
}

/** Alta de una factura del cliente (el total incluye IVA). */
function NuevaFactura({ cuenta: c, onCerrar, avisar }: { cuenta: CuentaViva; onCerrar: () => void; avisar: Avisar }) {
  const { crearFactura } = useCobranza();
  const [f, setF] = React.useState({ folio: '', uuid: '', total: '', fecha: hoyIso(), vence: '' });
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const total = Number(f.total.replace(/[$,\s]/g, ''));
  const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.uuid.trim());
  const valido = uuidOk && total > 0 && !!f.fecha && (!f.vence || f.vence >= f.fecha);
  const guardar = async () => {
    setOcupado(true);
    setError(null);
    const err = await crearFactura(c.id, { folio: f.folio, uuid: f.uuid, total, fecha: f.fecha, vence: f.vence });
    setOcupado(false);
    if (err) return setError(err);
    avisar(`Agregaste la factura ${f.folio || f.uuid.slice(0, 8)} a ${c.cliente}`);
    onCerrar();
  };
  return (
    <Ventana titulo="Agregar factura" subtitulo={`${c.cliente} · el total incluye IVA`} onCerrar={onCerrar} ancho="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) void guardar();
        }}
        className="grid grid-cols-2 gap-3"
      >
        <label className="block">
          <span className={ETIQUETA}>Folio</span>
          <input className={CONTROL + ' mt-1'} value={f.folio} onChange={set('folio')} autoFocus placeholder="F-1024" />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Total (con IVA) *</span>
          <input className={CONTROL + ' mt-1'} inputMode="decimal" value={f.total} onChange={set('total')} placeholder="116,000" />
        </label>
        <label className="block col-span-2">
          <span className={ETIQUETA}>UUID del CFDI *</span>
          <input className={CONTROL + ' mt-1 font-mono !text-[12px]'} value={f.uuid} onChange={set('uuid')} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          {f.uuid && !uuidOk && <span className="text-[11px] text-rose-600">El UUID tiene 36 caracteres con guiones (viene en el XML de la factura).</span>}
        </label>
        <label className="block">
          <span className={ETIQUETA}>Emitida *</span>
          <input type="date" className={CONTROL + ' mt-1'} value={f.fecha} onChange={set('fecha')} />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Vence</span>
          <input type="date" className={CONTROL + ' mt-1'} value={f.vence} min={f.fecha} onChange={set('vence')} />
        </label>
        {error && <p className="col-span-2 text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
            Cancelar
          </button>
          <button type="submit" disabled={!valido || ocupado} className={BTN_PRI}>
            {ocupado && <Loader2 size={13} className="animate-spin" />} Agregar factura
          </button>
        </div>
      </form>
    </Ventana>
  );
}

/** Registrar el cobro de una factura o cancelarla (con motivo). */
function AccionFactura({
  tipo,
  factura: f,
  cuenta: c,
  onCerrar,
  avisar,
}: {
  tipo: 'cobrar' | 'cancelar';
  factura: FacturaViva;
  cuenta: CuentaViva;
  onCerrar: () => void;
  avisar: Avisar;
}) {
  const { cobrarFactura, cancelarFactura } = useCobranza();
  const [fecha, setFecha] = React.useState(hoyIso());
  const [texto, setTexto] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const cobrar = tipo === 'cobrar';
  const guardar = async () => {
    if (!f.dbId) return;
    setOcupado(true);
    setError(null);
    const err = cobrar ? await cobrarFactura(f.dbId, fecha, texto) : await cancelarFactura(f.dbId, texto.trim());
    setOcupado(false);
    if (err) return setError(err);
    avisar(cobrar ? `Registraste el pago de ${f.folio} (${fmt(f.monto - f.pagado)})` : `Cancelaste la factura ${f.folio}`);
    onCerrar();
  };
  return (
    <Ventana
      titulo={cobrar ? `Registrar pago de ${f.folio}` : `Cancelar la factura ${f.folio}`}
      subtitulo={`${c.cliente} · ${fmt(f.monto - f.pagado)}`}
      onCerrar={onCerrar}
      ancho="max-w-md"
    >
      <div className="space-y-3">
        {cobrar ? (
          <>
            <p className="text-[12.5px] text-brand-ink/60 leading-relaxed">
              La factura queda como cobrada y su plan de cobranza se detiene. Si te equivocas, puedes revertirlo en Pagos.
            </p>
            <label className="block">
              <span className={ETIQUETA}>Fecha en que pagó</span>
              <input type="date" className={CONTROL + ' mt-1'} value={fecha} max={hoyIso()} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="block">
              <span className={ETIQUETA}>Referencia (opcional)</span>
              <input className={CONTROL + ' mt-1'} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. SPEI 0928 1234, transferencia BBVA" />
            </label>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-brand-ink/60 leading-relaxed">
              Sale de la cartera por cobrar y su plan se detiene. Úsalo si la factura se canceló ante el SAT o se capturó por error.
            </p>
            <label className="block">
              <span className={ETIQUETA}>Motivo *</span>
              <input className={CONTROL + ' mt-1'} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Se sustituyó por la F-1030" />
            </label>
          </>
        )}
        {error && <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
            Volver
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={ocupado || (!cobrar && !texto.trim()) || (cobrar && !fecha)}
            className={cobrar ? BTN_PRI : BTN_PRI + ' !bg-rose-600 hover:!bg-rose-700'}
          >
            {ocupado && <Loader2 size={13} className="animate-spin" />} {cobrar ? 'Registrar pago' : 'Cancelar factura'}
          </button>
        </div>
      </div>
    </Ventana>
  );
}

function FilaFactura({
  factura: f,
  cuenta: c,
  onIniciar,
  avisar,
}: {
  key?: string;
  factura: FacturaViva;
  cuenta: CuentaViva;
  onIniciar: () => void;
  avisar: Avisar;
}) {
  const [accion, setAccion] = React.useState<'cobrar' | 'cancelar' | null>(null);
  const saldo = f.monto - f.pagado;
  const situacion = f.dias > 0 ? `${f.dias} días vencida` : f.dias === 0 ? 'vence hoy' : `vence en ${-f.dias} días`;

  // Estado del cobro: la principal sigue su plan; las demás arrancan al iniciar.
  let cobro: ReactNode;
  if (!f.planInicio) {
    cobro = <span className="text-amber-700 font-semibold">Sin iniciar</span>;
  } else if (f.principal) {
    const { actual: act, proxima } = planCuenta(c);
    cobro = (
      <span>
        Desde el {f.planInicio}
        {c.saldada
          ? ' · saldada'
          : act
            ? ` · hoy en ${act.etiqueta} (${act.nombre})`
            : proxima
              ? ` · al día, sigue ${proxima.etiqueta} en ${proxima.faltan} d`
              : ''}
      </span>
    );
  } else {
    const siguiente = PLANTILLA.find((p) => p.id !== 'N0' && p.dia > f.dias);
    cobro = (
      <span>
        Iniciado {f.planInicio} · nivel 0 enviado
        {siguiente ? ` · sigue ${siguiente.etiqueta} (${cuandoPaso(siguiente.id, siguiente.dia)})` : ''}
      </span>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      <div className="min-w-[150px]">
        <div className="text-[13px] font-semibold text-brand-ink font-mono">{f.folio}</div>
        <div className="text-[11px] text-brand-ink/45">
          Emitida {f.emision} · vence {f.vence}
        </div>
      </div>
      <div className="min-w-[120px]">
        <div className="text-[13px] font-semibold text-brand-ink tabular-nums">{fmt(saldo)}</div>
        <div className={`text-[11px] ${f.dias > 0 ? 'text-rose-600' : 'text-brand-ink/45'}`}>
          {f.pagado > 0 ? `de ${fmt(f.monto)} · ` : ''}
          {situacion}
        </div>
      </div>
      <div className="flex-1 min-w-[200px] text-[12px] text-brand-ink/60">{cobro}</div>
      {!f.planInicio && (
        <button
          onClick={onIniciar}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand-gold/50 text-[11px] font-semibold text-brand-ink hover:bg-brand-cream transition-colors"
        >
          <Play size={11} /> Iniciar plan
        </button>
      )}
      {f.monto - f.pagado > 1 && (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setAccion('cobrar')}
            disabled={!f.dbId}
            title={f.dbId ? 'Marcar como cobrada' : 'Factura de ejemplo'}
            className={BTN_SEC}
          >
            <Check size={11} /> Registrar pago
          </button>
          <button
            type="button"
            onClick={() => setAccion('cancelar')}
            disabled={!f.dbId}
            title={f.dbId ? 'Cancelar la factura' : 'Factura de ejemplo'}
            className={BTN_SEC + ' hover:!bg-rose-50 hover:!text-rose-700'}
            aria-label={`Cancelar la factura ${f.folio}`}
          >
            <Ban size={11} />
          </button>
        </div>
      )}
      {accion && <AccionFactura tipo={accion} factura={f} cuenta={c} onCerrar={() => setAccion(null)} avisar={avisar} />}
    </li>
  );
}

/** Contador histórico ante campañas especiales y negociaciones. */
export function Comportamiento({ cuenta: c }: { cuenta: CuentaViva }) {
  const k = c.comportamiento;
  return (
    <div className={`rounded-2xl border px-5 py-4 ${k.esperaDescuentos ? 'border-rose-200 bg-rose-50/40' : 'border-brand-ink/8 bg-white/35'}`}>
      <div className="flex items-center gap-2">
        {k.esperaDescuentos && <AlertTriangle size={13} className="text-rose-600" />}
        <span className={`text-[12px] font-semibold ${k.esperaDescuentos ? 'text-rose-700' : 'text-brand-ink/70'}`}>
          {k.esperaDescuentos ? 'Espera campañas con descuento para pagar' : 'Comportamiento histórico'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3">
        <Contador valor={k.campanasPagadas.length} label="pagos en campañas especiales" alerta={k.esperaDescuentos} />
        <Contador valor={k.atrasosLargos} label="facturas con más de 30 días de atraso" alerta={k.esperaDescuentos} />
        <Contador valor={k.negociaciones} label="negociaciones de plan de pagos" alerta={k.esperaDescuentos} />
      </div>
      <p className="text-[12px] text-brand-ink/60 leading-relaxed mt-3">{k.porque}</p>
      {k.esperaDescuentos && (
        <p className="text-[11px] text-rose-700/80 mt-1">Queda fuera de las campañas con descuento, salvo que lo incluyas a mano.</p>
      )}
    </div>
  );
}

function Contador({ valor, label, alerta }: { valor: number; label: string; alerta: boolean }) {
  return (
    <div>
      <div className={`text-2xl font-serif leading-none ${alerta && valor > 1 ? 'text-rose-600' : 'text-brand-ink'}`}>{valor}</div>
      <div className="text-[10px] text-brand-ink/45 mt-1 leading-tight">{label}</div>
    </div>
  );
}
