import React from 'react';
import { PanelSub, Subpestanas } from './vidrio.tsx';
import { Download, Pencil, Save, X } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { Reveal, BlockTitle, Figure } from './primitives.tsx';
import { AGENTES, HOY, LINEAS, RESULTADOS, type Gestion } from './mockV1.ts';
import { useAviso } from './clientes.tsx';
import { useCobranza } from './store.tsx';
import { AnalisisPeriodoPanel } from './AnalisisPeriodoPanel.tsx';

/**
 * Reportes configurables: en vez de reportes fijos semanales/mensuales, el
 * cliente arma el suyo con filtros exactos (agente, línea, fechas y horas,
 * resultado de gestión, cuentas no gestionadas), lo guarda y lo exporta.
 * `soloEquipo` limita al supervisor a lo de su equipo.
 */
type Filtros = {
  agente: string;
  linea: string;
  resultado: string;
  desde: string;
  hasta: string;
  horaDesde: string;
  horaHasta: string;
  soloNoGestionadas: boolean;
};

const INICIAL: Filtros = {
  agente: 'Todos',
  linea: 'Todas',
  resultado: 'Todos',
  desde: '2026-09-22',
  hasta: HOY,
  horaDesde: '00:00',
  horaHasta: '23:59',
  soloNoGestionadas: false,
};

const GUARDADOS_INICIALES: { nombre: string; filtros: Filtros }[] = [
  { nombre: 'Promesas de la semana', filtros: { ...INICIAL, resultado: 'Promesa de pago' } },
  { nombre: 'Cuentas sin gestionar', filtros: { ...INICIAL, soloNoGestionadas: true } },
  { nombre: 'Ana · mañanas', filtros: { ...INICIAL, agente: 'Ana Robles', horaHasta: '12:00' } },
];

function aplicar(f: Filtros, gestiones: Gestion[]): Gestion[] {
  return gestiones.filter(
    (g) =>
      (f.agente === 'Todos' || g.agente === f.agente) &&
      (f.linea === 'Todas' || g.linea === f.linea) &&
      (f.soloNoGestionadas ? g.resultado === 'No gestionada' : f.resultado === 'Todos' || g.resultado === f.resultado) &&
      g.fecha >= f.desde &&
      g.fecha <= f.hasta &&
      g.hora >= f.horaDesde &&
      g.hora <= f.horaHasta,
  );
}

function exportarCSV(filas: Gestion[]) {
  const enc = 'fecha,hora,agente,cliente,linea,resultado,monto';
  const cuerpo = filas.map((g) =>
    [g.fecha, g.hora, g.agente, `"${g.cliente}"`, g.linea, g.resultado, g.monto].join(','),
  );
  const blob = new Blob([[enc, ...cuerpo].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reporte-cobranza.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const RESULTADO_TONO: Record<string, string> = {
  'Promesa de pago': 'text-amber-700',
  Pagó: 'text-emerald-700',
  'Sin respuesta': 'text-brand-ink/50',
  Disputa: 'text-rose-600',
  Escalado: 'text-rose-600',
  'No gestionada': 'text-brand-ink/40 italic',
  Enviado: 'text-brand-ink/70',
};

/**
 * Pestaña Reportes: "Análisis del periodo" (lo que cambió en la cartera,
 * calculado por el backend) y "Reporte a la medida" (filtros libres).
 */
export function ReportesPanel({ soloEquipo = false }: { soloEquipo?: boolean }) {
  const [vista, setVista] = React.useState<'analisis' | 'medida'>('analisis');
  return (
    <div className="space-y-5">
      <Subpestanas
        grupo="reportes"
        etiqueta="Tipo de reporte"
        valor={vista}
        onChange={setVista}
        opciones={[
          { id: 'analisis', nombre: 'Análisis del periodo' },
          { id: 'medida', nombre: 'Reporte a la medida' },
        ]}
      />
      <PanelSub id={vista}>
        {vista === 'analisis' ? <AnalisisPeriodoPanel puedeGenerar={!soloEquipo} /> : <ReporteMedida soloEquipo={soloEquipo} />}
      </PanelSub>
    </div>
  );
}

type Guardado = { nombre: string; filtros: Filtros };
const LLAVE_GUARDADOS = 'royaltica.cobranza.reportesGuardados';

function ReporteMedida({ soloEquipo }: { soloEquipo: boolean }) {
  const [f, setF] = React.useState<Filtros>(INICIAL);
  const [guardados, setGuardadosRaw] = React.useState<Guardado[]>(() => {
    try {
      const raw = window.localStorage.getItem(LLAVE_GUARDADOS);
      return raw ? (JSON.parse(raw) as Guardado[]) : GUARDADOS_INICIALES;
    } catch {
      return GUARDADOS_INICIALES;
    }
  });
  const setGuardados = (fn: (g: Guardado[]) => Guardado[]) =>
    setGuardadosRaw((g) => {
      const nuevo = fn(g);
      try {
        window.localStorage.setItem(LLAVE_GUARDADOS, JSON.stringify(nuevo));
      } catch {
        /* sin almacenamiento */
      }
      return nuevo;
    });
  const [nombre, setNombre] = React.useState('');
  const [renombrando, setRenombrando] = React.useState<{ antes: string; nombre: string } | null>(null);
  const { avisar, nodo } = useAviso();
  const { gestiones } = useCobranza();
  // Agentes que aparecen en las gestiones (los reales, no los del ejemplo).
  const agentesReporte = [...new Set([...gestiones.map((g) => g.agente)])].sort();
  // Lo más reciente arriba: lo que se hizo hoy se ve primero.
  const filas = aplicar(f, gestiones).sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((x) => ({ ...x, [k]: v }));

  const monto = filas.reduce((s, g) => s + g.monto, 0);
  const promesas = filas.filter((g) => g.resultado === 'Promesa de pago').length;
  const sinGestion = filas.filter((g) => g.resultado === 'No gestionada').length;

  const guardar = () => {
    const n = nombre.trim();
    if (!n) return;
    // Mismo nombre = se actualiza ese reporte en vez de duplicarlo.
    setGuardados((g) => [...g.filter((x) => x.nombre !== n), { nombre: n, filtros: f }]);
    setNombre('');
    avisar(`Guardaste "${n}"`);
  };
  const borrar = (r: Guardado) => {
    const i = guardados.findIndex((x) => x.nombre === r.nombre);
    setGuardados((g) => g.filter((x) => x.nombre !== r.nombre));
    avisar(`Borraste "${r.nombre}"`, {
      deshacer: () =>
        setGuardados((g) => {
          const out = [...g];
          out.splice(Math.max(0, i), 0, r);
          return out;
        }),
    });
  };
  const renombrar = () => {
    if (!renombrando) return;
    const n = renombrando.nombre.trim();
    if (n && n !== renombrando.antes) setGuardados((g) => g.map((x) => (x.nombre === renombrando.antes ? { ...x, nombre: n } : x)));
    setRenombrando(null);
  };

  return (
    <div className="space-y-5">
      {/* Reportes guardados */}
      <Reveal>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40 mr-1">Guardados</span>
          {guardados.map((r) =>
            renombrando?.antes === r.nombre ? (
              <form
                key={r.nombre}
                onSubmit={(e) => {
                  e.preventDefault();
                  renombrar();
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={renombrando.nombre}
                  onChange={(e) => setRenombrando({ ...renombrando, nombre: e.target.value })}
                  onBlur={renombrar}
                  onKeyDown={(e) => e.key === 'Escape' && setRenombrando(null)}
                  aria-label="Nuevo nombre del reporte"
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-brand-gold/60 bg-brand-paper outline-none w-44"
                />
              </form>
            ) : (
              <span
                key={r.nombre}
                className="group inline-flex items-center rounded-lg border border-brand-ink/12 text-brand-ink/70 hover:bg-brand-cream hover:border-brand-gold/40 transition-colors"
              >
                <button onClick={() => setF(r.filtros)} className="pl-3 pr-1.5 py-1.5 text-[12px] font-semibold">
                  {r.nombre}
                </button>
                <button
                  onClick={() => setRenombrando({ antes: r.nombre, nombre: r.nombre })}
                  aria-label={`Renombrar ${r.nombre}`}
                  title="Renombrar"
                  className="px-1 py-1.5 text-brand-ink/35 hover:text-brand-ink"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => borrar(r)}
                  aria-label={`Borrar ${r.nombre}`}
                  title="Borrar"
                  className="pl-1 pr-2 py-1.5 text-brand-ink/35 hover:text-rose-600"
                >
                  <X size={12} />
                </button>
              </span>
            ),
          )}
          {!guardados.length && <span className="text-[12px] text-brand-ink/40">Aún no guardas reportes. Arma uno y dale un nombre.</span>}
        </div>
        {nodo}
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Filtros */}
        <Reveal delay={0.05} className="lg:col-span-1">
          <div className="glass rounded-[28px] p-6 space-y-4">
            <BlockTitle>Arma tu reporte</BlockTitle>
            <Campo label="Agente">
              <Select value={f.agente} onChange={(v) => set('agente', v)} opciones={['Todos', ...agentesReporte]} />
            </Campo>
            <Campo label="Línea de negocio">
              <Select value={f.linea} onChange={(v) => set('linea', v)} opciones={['Todas', ...LINEAS]} />
            </Campo>
            <Campo label="Resultado de gestión">
              <Select
                value={f.resultado}
                onChange={(v) => set('resultado', v)}
                opciones={['Todos', ...RESULTADOS.filter((r) => r !== 'No gestionada')]}
                disabled={f.soloNoGestionadas}
              />
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Desde">
                <Input type="date" value={f.desde} onChange={(v) => set('desde', v)} />
              </Campo>
              <Campo label="Hasta">
                <Input type="date" value={f.hasta} onChange={(v) => set('hasta', v)} />
              </Campo>
              <Campo label="Hora desde">
                <Input type="time" value={f.horaDesde} onChange={(v) => set('horaDesde', v)} />
              </Campo>
              <Campo label="Hora hasta">
                <Input type="time" value={f.horaHasta} onChange={(v) => set('horaHasta', v)} />
              </Campo>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-brand-ink/75 cursor-pointer">
              <input
                type="checkbox"
                checked={f.soloNoGestionadas}
                onChange={(e) => set('soloNoGestionadas', e.target.checked)}
                className="accent-[var(--color-brand-gold,#b8975a)] w-4 h-4"
              />
              Solo cuentas no gestionadas
            </label>
            <div className="pt-3 border-t border-brand-ink/8 space-y-2">
              <div className="flex gap-2">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del reporte"
                  className="flex-1 min-w-0 px-3 py-2 rounded-2xl glass-campo text-sm outline-none focus:border-brand-gold/60"
                />
                <button
                  onClick={guardar}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-ink text-brand-paper text-[12px] font-semibold hover:bg-brand-ink/85 transition-colors"
                >
                  <Save size={13} /> Guardar
                </button>
              </div>
              <button onClick={() => setF(INICIAL)} className="text-[11px] text-brand-ink/45 hover:text-brand-ink">
                Limpiar filtros
              </button>
            </div>
          </div>
        </Reveal>

        {/* Resultado */}
        <Reveal delay={0.1} className="lg:col-span-2">
          <div className="glass rounded-[28px] overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/70 border-b border-brand-ink/8">
              <Kpi label="Gestiones" value={filas.length} />
              <Kpi label="Monto" value={monto} moneda />
              <Kpi label="Promesas" value={promesas} />
              <Kpi label="Sin gestionar" value={sinGestion} alerta={sinGestion > 0} />
            </div>
            <div className="flex items-center justify-between px-6 py-3 border-b border-brand-ink/8">
              <span className="text-[11px] text-brand-ink/45">
                {soloEquipo ? 'Tu equipo · ' : ''}
                {filas.length} registros
              </span>
              <button
                onClick={() => exportarCSV(filas)}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-ink/65 hover:text-brand-ink"
              >
                <Download size={13} /> Exportar CSV
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-brand-bone text-brand-ink/45 text-left">
                  <tr>
                    <th className="px-6 py-2.5 font-semibold">Fecha</th>
                    <th className="px-3 py-2.5 font-semibold">Agente</th>
                    <th className="px-3 py-2.5 font-semibold">Cliente</th>
                    <th className="px-3 py-2.5 font-semibold">Resultado</th>
                    <th className="px-6 py-2.5 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/70">
                  {filas.map((g, i) => (
                    <tr key={`${g.cliente}-${g.fecha}-${g.hora}-${i}`}>
                      <td className="px-6 py-2.5 text-brand-ink/55 tabular-nums whitespace-nowrap">
                        {g.fecha.slice(8)}/{g.fecha.slice(5, 7)} · {g.hora}
                      </td>
                      <td className="px-3 py-2.5 text-brand-ink/70">{g.agente}</td>
                      <td className="px-3 py-2.5 text-brand-ink font-semibold">
                        {g.cliente}
                        <span className="block font-normal text-brand-ink/40">{g.linea}</span>
                      </td>
                      <td className={`px-3 py-2.5 font-semibold ${RESULTADO_TONO[g.resultado]}`}>{g.resultado}</td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-brand-ink">
                        {CURRENCY_FORMATTER.format(g.monto)}
                      </td>
                    </tr>
                  ))}
                  {filas.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-brand-ink/40">
                        Ningún registro con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function Kpi({ label, value, moneda = false, alerta = false }: { label: string; value: number; moneda?: boolean; alerta?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</div>
      <div className={`text-xl font-serif mt-1 ${alerta ? 'text-rose-600' : 'text-brand-ink'}`}>
        <Figure value={value} format={moneda ? 'moneda' : 'entero'} />
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-brand-ink/40">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const CONTROL =
  'w-full px-3 py-2 rounded-2xl glass-campo text-sm text-brand-ink outline-none focus:border-brand-gold/60 disabled:opacity-40';

function Select({ value, onChange, opciones, disabled }: { value: string; onChange: (v: string) => void; opciones: readonly string[]; disabled?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={CONTROL}>
      {opciones.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

function Input({ type, value, onChange }: { type: string; value: string; onChange: (v: string) => void }) {
  return <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL} />;
}
