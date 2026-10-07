import type { ReactNode } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { BlockTitle } from './primitives.tsx';
import { PLANTILLA, cuandoPaso } from './plan.tsx';
import { useCobranza, planCuenta, type CuentaViva, type FacturaViva } from './store.tsx';

const fmt = (n: number) => CURRENCY_FORMATTER.format(n);

/**
 * Facturas del cliente: qué hay que cobrar, desde cuándo se está cobrando
 * cada una y el botón para arrancar el plan (niveles 0–4 y etapas A–D) en
 * las facturas que todavía no lo tienen. Arriba, su comportamiento histórico
 * ante campañas especiales, para no premiar a quien espera el descuento.
 */
export function SubFacturas({ cuenta: c }: { cuenta: CuentaViva }) {
  const { iniciarPlanes } = useCobranza();
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
          {sinPlan.length > 0 && (
            <button
              onClick={() => iniciarPlanes(sinPlan.map((f) => f.folio))}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors"
            >
              <Play size={12} /> Iniciar plan {sinPlan.length > 1 ? `de las ${sinPlan.length}` : ''}
            </button>
          )}
        </div>

        <ul className="mt-3 border border-brand-ink/8 rounded-2xl divide-y divide-brand-ink/6 overflow-hidden">
          {c.facturas.map((f) => (
            <FilaFactura key={f.folio} factura={f} cuenta={c} onIniciar={() => iniciarPlanes([f.folio])} />
          ))}
        </ul>
        <p className="text-[11px] text-brand-ink/40 mt-2 leading-relaxed">
          Al iniciar el plan sale el nivel 0 (confirmación de factura) y los siguientes niveles se activan solos según la
          fecha de vencimiento.
        </p>
      </div>
    </div>
  );
}

function FilaFactura({
  factura: f,
  cuenta: c,
  onIniciar,
}: {
  key?: string;
  factura: FacturaViva;
  cuenta: CuentaViva;
  onIniciar: () => void;
}) {
  const saldo = f.monto - f.pagado;
  const situacion = f.dias > 0 ? `${f.dias} días vencida` : f.dias === 0 ? 'vence hoy' : `vence en ${-f.dias} días`;

  // Estado del cobro: la principal sigue su plan; las demás arrancan al iniciar.
  let cobro: ReactNode;
  if (!f.planInicio) {
    cobro = <span className="text-amber-700 font-semibold">Sin iniciar</span>;
  } else if (f.principal) {
    const act = planCuenta(c).actual;
    cobro = (
      <span>
        Desde el {f.planInicio}
        {c.saldada ? ' · saldada' : act ? ` · hoy en ${act.etiqueta} (${act.nombre})` : ''}
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
    </li>
  );
}

/** Contador histórico ante campañas especiales y negociaciones. */
export function Comportamiento({ cuenta: c }: { cuenta: CuentaViva }) {
  const k = c.comportamiento;
  return (
    <div className={`rounded-2xl border px-5 py-4 ${k.esperaDescuentos ? 'border-rose-200 bg-rose-50/40' : 'border-brand-ink/8 bg-brand-bone/40'}`}>
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
