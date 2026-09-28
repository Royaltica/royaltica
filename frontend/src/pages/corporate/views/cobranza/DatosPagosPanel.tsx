import React from 'react';
import { AlertTriangle, Check, Database, Upload, X } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { Reveal, BlockTitle } from './primitives.tsx';
import { CONTACTOS, MOVIMIENTOS, ASIGNACIONES, AGENTES, type ContactoFinanzas, type Agente } from './mockV1.ts';

/**
 * Administrador / Data: cargar y administrar la base, validar pagos y
 * asegurar el contacto de finanzas de cada cliente.
 */
export function DatosPagosPanel() {
  return (
    <div className="space-y-5">
      <PagosT1 />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CargaCartera />
        <ContactosFinanzas />
      </div>
    </div>
  );
}

// ── Pagos: esquema T+1 y validación manual ─────────────────────────────

/** Franja compacta para el encabezado: cuándo se actualizaron los pagos. */
export function AvisoT1({ onIr }: { onIr?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-ink/55">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Pagos al corte de ayer (T+1)
      </span>
      <span className="text-brand-ink/35">Sin conexión bancaria directa</span>
      {onIr && (
        <button onClick={onIr} className="font-semibold text-brand-ink/70 hover:text-brand-ink underline-offset-2 hover:underline">
          Validar movimientos de hoy →
        </button>
      )}
    </div>
  );
}

function PagosT1() {
  const [pendientes, setPendientes] = React.useState(MOVIMIENTOS);
  const [aplicados, setAplicados] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const resolver = (id: string, aplicar: boolean) => {
    const m = pendientes.find((x) => x.id === id);
    setPendientes((p) => p.filter((x) => x.id !== id));
    if (aplicar && m) setAplicados((a) => [`${m.sugerencia ?? m.referencia} · ${CURRENCY_FORMATTER.format(m.monto)}`, ...a]);
  };

  return (
    <Reveal>
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[62ch]">
            <BlockTitle>Actualización de pagos</BlockTitle>
            <p className="text-sm text-brand-ink/65 leading-relaxed mt-2">
              Sin conexión bancaria directa, los pagos se reflejan <span className="font-semibold text-brand-ink">al día hábil siguiente (T+1)</span>, cuando el banco entrega el estado de cuenta. Para no esperar, el área contable puede cargar los movimientos de hoy y validarlos aquí.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              disabled
              title="Próximamente"
              className="px-3 py-2 rounded-xl border border-brand-ink/12 text-[12px] font-semibold text-brand-ink/40 cursor-not-allowed"
            >
              Conectar banco
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors"
            >
              <Upload size={13} /> Cargar movimientos
            </button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={() => {}} />
          </div>
        </div>

        {/* Línea de tiempo del T+1 */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            ['Día 0', 'El cliente paga'],
            ['Día 1', 'El banco lo reporta'],
            ['Día 1', 'Royáltica lo concilia'],
          ].map(([d, t], i) => (
            <div key={i} className="rounded-2xl bg-brand-bone/60 border border-brand-ink/6 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{d}</div>
              <div className="text-[13px] font-semibold text-brand-ink mt-0.5">{t}</div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mb-2">
            Movimientos por validar · {pendientes.length}
          </div>
          <div className="divide-y divide-brand-ink/6 border border-brand-ink/8 rounded-2xl overflow-hidden">
            {pendientes.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-mono text-brand-ink/60 truncate">{m.referencia}</div>
                  <div className="text-sm mt-0.5">
                    {m.sugerencia ? (
                      <span className="text-brand-ink">
                        {m.sugerencia}{' '}
                        <span className={m.confianza === 'alta' ? 'text-emerald-700' : 'text-amber-700'}>
                          · coincidencia {m.confianza}
                        </span>
                      </span>
                    ) : (
                      <span className="text-rose-600">Sin coincidencia · asignar manualmente</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums text-brand-ink">{CURRENCY_FORMATTER.format(m.monto)}</span>
                <span className="text-[11px] text-brand-ink/40">{m.fecha}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => resolver(m.id, true)}
                    disabled={!m.sugerencia}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold disabled:opacity-30"
                  >
                    <Check size={12} /> Aplicar
                  </button>
                  <button
                    onClick={() => resolver(m.id, false)}
                    aria-label="Descartar"
                    className="px-2 py-1.5 rounded-lg border border-brand-ink/12 text-brand-ink/50 hover:bg-brand-bone"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
            {pendientes.length === 0 && (
              <div className="px-4 py-5 text-sm text-brand-ink/45">Todo validado. Los pagos aplicados ya se ven hoy.</div>
            )}
          </div>
          {aplicados.length > 0 && (
            <ul className="mt-3 space-y-1">
              {aplicados.map((a) => (
                <li key={a} className="flex items-center gap-2 text-[12px] text-emerald-700">
                  <Check size={12} /> {a} · aplicado, se refleja hoy
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Reveal>
  );
}

// ── Base de cartera ────────────────────────────────────────────────────

function CargaCartera() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <Reveal delay={0.06}>
      <div className="bg-brand-paper border border-brand-ink/10 rounded-3xl p-6 h-full">
        <BlockTitle icon={<Database size={12} />}>Base de cartera</BlockTitle>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Dato label="Facturas" value="1,284" />
          <Dato label="Clientes" value="64" />
          <Dato label="Errores" value="3" alerta />
        </div>
        <p className="text-[12px] text-brand-ink/50 mt-3">Última carga: 26 sep, 18:40 · por Data</p>
        <p className="text-[12px] text-rose-600 mt-1">3 facturas sin RFC válido quedaron fuera de campañas.</p>
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
  const [lista, setLista] = React.useState<ContactoFinanzas[]>(CONTACTOS);
  const [editando, setEditando] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ nombre: '', puesto: 'Tesorería', telefono: '' });
  const faltan = lista.filter((c) => !c.finanzas).length;

  const guardar = (cliente: string) => {
    if (!form.nombre.trim() || !form.telefono.trim()) return;
    setLista((l) => l.map((c) => (c.cliente === cliente ? { ...c, finanzas: { ...form } } : c)));
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
        <ul className="mt-4 divide-y divide-brand-ink/6">
          {lista.map((c) => (
            <li key={c.cliente} className="py-3">
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
                {!c.finanzas && editando !== c.cliente && (
                  <button
                    onClick={() => setEditando(c.cliente)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-brand-gold/50 text-[11px] font-semibold text-brand-ink hover:bg-brand-cream"
                  >
                    Agregar
                  </button>
                )}
              </div>
              {editando === c.cliente && (
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
                    onClick={() => guardar(c.cliente)}
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
  const [filas, setFilas] = React.useState(ASIGNACIONES);
  const [cambio, setCambio] = React.useState<string | null>(null);
  const carga = AGENTES.map((a) => ({ a, n: filas.filter((f) => f.agente === a).length }));

  const reasignar = (cliente: string, agente: Agente) => {
    setFilas((f) => f.map((x) => (x.cliente === cliente ? { ...x, agente } : x)));
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
        <div className="divide-y divide-brand-ink/6">
          {filas.map((f) => (
            <div key={f.cliente} className="flex flex-wrap items-center gap-4 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-brand-ink">{f.cliente}</div>
                <div className="text-[11px] text-brand-ink/45 tabular-nums">
                  {CURRENCY_FORMATTER.format(f.saldo)} · {f.dias < 0 ? `vence en ${-f.dias} días` : `${f.dias} días vencida`}
                </div>
              </div>
              <select
                value={f.agente}
                onChange={(e) => reasignar(f.cliente, e.target.value as Agente)}
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
