import React from 'react';
import { AlertTriangle, Check, Database, Upload } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { Reveal, BlockTitle } from './primitives.tsx';
import { AGENTES, saldoDe, type Agente } from './mockV1.ts';
import { useCobranza } from './store.tsx';

/**
 * Administrador / Data: cargar y administrar la base y asegurar el contacto
 * de finanzas de cada cliente. Los pagos viven en la pestaña Pagos.
 */
export function DatosPagosPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <CargaCartera />
      <ContactosFinanzas />
    </div>
  );
}

// ── Base de cartera ────────────────────────────────────────────────────

function CargaCartera() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { cartera } = useCobranza();
  const total = cartera.reduce((s, c) => s + saldoDe(c), 0);
  const sinFinanzas = cartera.filter((c) => !c.finanzas).length;
  return (
    <Reveal delay={0.06}>
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 h-full">
        <BlockTitle icon={<Database size={12} />}>Base de cartera</BlockTitle>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Dato label="Facturas" value={String(cartera.length)} />
          <Dato label="Por cobrar" value={CURRENCY_FORMATTER.format(total)} />
          <Dato label="Incompletas" value={String(sinFinanzas)} alerta={sinFinanzas > 0} />
        </div>
        <p className="text-[12px] text-brand-ink/50 mt-3">Última carga: 27 sep, 18:40 · por Data</p>
        {sinFinanzas > 0 && (
          <p className="text-[12px] text-rose-600 mt-1">
            {sinFinanzas} {sinFinanzas === 1 ? 'cuenta sin' : 'cuentas sin'} contacto de finanzas: no entran a campañas hasta completarlas.
          </p>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-brand-ink/20 text-[12px] font-semibold text-brand-ink/65 hover:bg-brand-bone transition-colors"
        >
          <Upload size={14} /> Cargar cartera (CSV o Excel)
        </button>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={() => {}} />
      </div>
    </Reveal>
  );
}

function Dato({ label, value, alerta = false }: { label: string; value: string; alerta?: boolean }) {
  return (
    <div className="rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</div>
      <div className={`text-lg font-serif mt-0.5 tabular-nums ${alerta ? 'text-rose-600' : 'text-brand-ink'}`}>{value}</div>
    </div>
  );
}

// ── Contactos de finanzas (obligatorio) ────────────────────────────────

function ContactosFinanzas() {
  const { cartera, agregarContacto } = useCobranza();
  const [editando, setEditando] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ nombre: '', puesto: 'Tesorería', telefono: '' });
  const faltan = cartera.filter((c) => !c.finanzas).length;
  // Primero las que faltan: es lo que hay que resolver.
  const lista = [...cartera].sort((x, y) => Number(!!x.finanzas) - Number(!!y.finanzas));

  const guardar = (id: string) => {
    if (!form.nombre.trim() || !form.telefono.trim()) return;
    agregarContacto(id, { ...form });
    setEditando(null);
    setForm({ nombre: '', puesto: 'Tesorería', telefono: '' });
  };

  return (
    <Reveal delay={0.1}>
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 h-full">
        <div className="flex items-baseline justify-between gap-3">
          <BlockTitle>Contacto de finanzas</BlockTitle>
          {faltan > 0 ? (
            <span className="text-[11px] font-semibold text-rose-600">Faltan {faltan} · obligatorio</span>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-700">Completo</span>
          )}
        </div>
        <p className="text-[12px] text-brand-ink/50 mt-2 leading-relaxed">
          En B2B quien paga es tesorería, no el dueño. Sin este contacto la cuenta no entra a campañas.
        </p>
        <ul className="mt-4 divide-y divide-brand-ink/6 max-h-[420px] overflow-y-auto">
          {lista.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-brand-ink">{c.cliente}</div>
                  {c.finanzas ? (
                    <div className="text-[12px] text-brand-ink/60 mt-0.5">
                      {c.finanzas.nombre} · {c.finanzas.puesto} · <span className="tabular-nums">{c.finanzas.telefono}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[12px] text-rose-600 mt-0.5">
                      <AlertTriangle size={12} /> Solo tiene a {c.registrado}
                    </div>
                  )}
                </div>
                {!c.finanzas && editando !== c.id && (
                  <button
                    onClick={() => setEditando(c.id)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-brand-gold/50 text-[11px] font-semibold text-brand-ink hover:bg-brand-cream"
                  >
                    Agregar
                  </button>
                )}
              </div>
              {editando === c.id && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    autoFocus
                    placeholder="Nombre"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-sm outline-none focus:border-brand-gold/60"
                  />
                  <input
                    placeholder="Teléfono"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-sm outline-none focus:border-brand-gold/60"
                  />
                  <button
                    onClick={() => guardar(c.id)}
                    className="px-3 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

// ── Asignación de cuentas (Supervisor y Admin) ─────────────────────────

export function AsignacionPanel() {
  const { cartera, reasignar: reasignarCuenta } = useCobranza();
  const [cambio, setCambio] = React.useState<string | null>(null);
  const filas = [...cartera].sort((a, b) => b.dias - a.dias);
  const carga = AGENTES.map((a) => ({ a, n: cartera.filter((f) => f.agente === a).length }));

  const reasignar = (id: string, cliente: string, agente: Agente) => {
    reasignarCuenta(id, agente);
    setCambio(`${cliente} → ${agente}`);
  };

  return (
    <Reveal delay={0.1}>
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl overflow-hidden mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-brand-ink/8">
          <BlockTitle>Asignación de cuentas</BlockTitle>
          <div className="flex gap-3 text-[11px] text-brand-ink/50">
            {carga.map(({ a, n }) => (
              <span key={a}>
                {a.split(' ')[0]} <span className="font-semibold text-brand-ink tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="divide-y divide-brand-ink/6 max-h-[480px] overflow-y-auto">
          {filas.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-4 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-brand-ink">{f.cliente}</div>
                <div className="text-[11px] text-brand-ink/45 tabular-nums">
                  {CURRENCY_FORMATTER.format(saldoDe(f))} · {f.dias < 0 ? `vence en ${-f.dias} días` : `${f.dias} días vencida`}
                </div>
              </div>
              <select
                value={f.agente}
                onChange={(e) => reasignar(f.id, f.cliente, e.target.value as Agente)}
                className="px-3 py-2 rounded-xl border border-brand-ink/12 bg-brand-bone/50 text-[12px] font-semibold text-brand-ink outline-none focus:border-brand-gold/60"
              >
                {AGENTES.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {cambio && (
          <div className="px-6 py-3 bg-emerald-50 text-[12px] text-emerald-700 flex items-center gap-2">
            <Check size={12} /> Reasignado: {cambio}. El agente la verá en su lista de hoy.
          </div>
        )}
      </div>
    </Reveal>
  );
}
