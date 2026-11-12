import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, Database, Download, FileSpreadsheet, Loader2, Pencil, Plus, Search, Upload, UploadCloud, Users } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { Reveal, BlockTitle } from './primitives.tsx';
import { AGENTES, saldoDe, type Agente } from './mockV1.ts';
import { useCobranza, type CuentaViva } from './store.tsx';
import { api } from '../../../../services/apiClient.ts';
import {
  AccionesCliente,
  BitacoraCliente,
  BTN_PRI,
  BTN_SEC,
  ClienteForm,
  CONTROL,
  exportarCuentasCsv,
  FichaCliente,
  telefonosRepetidos,
  useAviso,
} from './clientes.tsx';
import { SPRING_SUAVE } from './campanasUi.tsx';
import { PanelSub, Subpestanas, useConfirmar } from './vidrio.tsx';
import { CargaFacturas } from './CargaFacturas.tsx';
import { FacturasCliente } from './FacturasCliente.tsx';

/**
 * Administrador / Data: cargar y administrar la base y asegurar el contacto
 * de finanzas de cada cliente. Los pagos viven en la pestaña Pagos.
 */
type SubDatos = 'clientes' | 'facturas' | 'csv';

export function DatosPagosPanel() {
  const { avisar, nodo } = useAviso();
  const { cartera } = useCobranza();
  const [sub, setSub] = React.useState<SubDatos>('clientes');
  const [form, setForm] = React.useState<{ cuenta?: CuentaViva; enfocar?: 'finanzasTelefono' | 'nota' } | null>(null);
  return (
    <div className="space-y-5">
      {/* Una cosa a la vez: ver clientes, subir facturas o cargar la base por CSV. */}
      <Subpestanas
        grupo="datos"
        etiqueta="Partes de Datos"
        valor={sub}
        onChange={setSub}
        opciones={[
          { id: 'clientes', nombre: 'Clientes', n: cartera.length, icono: <Users size={13} /> },
          { id: 'facturas', nombre: 'Subir facturas', icono: <UploadCloud size={13} /> },
          { id: 'csv', nombre: 'Cargar desde CSV', icono: <FileSpreadsheet size={13} /> },
        ]}
      />
      <PanelSub id={sub}>
        {sub === 'clientes' && (
          <TablaClientes avisar={avisar} onEditar={(c, enfocar) => setForm({ cuenta: c, enfocar })} onAgregar={() => setForm({})} />
        )}
        {sub === 'facturas' && <CargaFacturas onVerClientes={() => setSub('clientes')} />}
        {sub === 'csv' && <CargaCartera />}
      </PanelSub>
      {form && <ClienteForm cuenta={form.cuenta} enfocar={form.enfocar} onCerrar={() => setForm(null)} onListo={(m) => avisar(m)} />}
      {nodo}
    </div>
  );
}

// ── Todos los clientes: ver, buscar, editar, pausar, eliminar ──────────

type FiltroDatos = 'todos' | 'sin_finanzas' | 'repetido' | 'pausado' | 'vencidos';
const FILTROS_DATOS: { id: FiltroDatos; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'sin_finanzas', nombre: 'Sin contacto de finanzas' },
  { id: 'repetido', nombre: 'Teléfono repetido' },
  { id: 'pausado', nombre: 'Contacto pausado' },
  { id: 'vencidos', nombre: 'Vencidos' },
];
type Orden = 'nombre' | 'saldo' | 'dias';

function TablaClientes({
  avisar,
  onEditar,
  onAgregar,
}: {
  avisar: ReturnType<typeof useAviso>['avisar'];
  onEditar: (c: CuentaViva, enfocar?: 'finanzasTelefono' | 'nota') => void;
  onAgregar: () => void;
}) {
  const { cartera, fuente } = useCobranza();
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const [buscar, setBuscar] = React.useState('');
  const [filtro, setFiltro] = React.useState<FiltroDatos>('todos');
  const [agente, setAgente] = React.useState('');
  const [orden, setOrden] = React.useState<Orden>('nombre');
  const [exportando, setExportando] = React.useState(false);
  const rep = telefonosRepetidos(cartera);
  const last10 = (t?: string | null) => (t ? t.replace(/\D/g, '').slice(-10) : '');
  const esRepetido = (c: CuentaViva) => [c.datos?.telefono, c.finanzas?.telefono].some((t) => rep.has(last10(t)));

  const q = buscar.trim().toLowerCase();
  const visibles = cartera
    .filter((c) => {
      if (q) {
        const texto = [c.cliente, c.datos?.rfc, c.datos?.correo, c.datos?.telefono, c.finanzas?.nombre, c.finanzas?.telefono].join(' ').toLowerCase();
        if (!texto.includes(q)) return false;
      }
      if (agente && c.agente !== agente) return false;
      if (filtro === 'sin_finanzas') return !c.finanzas;
      if (filtro === 'repetido') return esRepetido(c);
      if (filtro === 'pausado') return !c.contactable;
      if (filtro === 'vencidos') return !c.saldada && c.dias > 0;
      return true;
    })
    .sort((a, b) =>
      orden === 'saldo' ? saldoDe(b) - saldoDe(a) : orden === 'dias' ? b.dias - a.dias : a.cliente.localeCompare(b.cliente, 'es'),
    );
  const cuenta = (f: FiltroDatos) =>
    f === 'sin_finanzas' ? cartera.filter((c) => !c.finanzas).length
    : f === 'repetido' ? cartera.filter(esRepetido).length
    : f === 'pausado' ? cartera.filter((c) => !c.contactable).length
    : f === 'vencidos' ? cartera.filter((c) => !c.saldada && c.dias > 0).length
    : cartera.length;
  const agentes = [...new Set(cartera.map((c) => c.agente))].sort();

  const exportar = async () => {
    // Con filtros: se exporta lo que se ve. Sin filtros y con cartera real: el padrón completo del backend.
    if (fuente === 'real' && filtro === 'todos' && !q && !agente) {
      setExportando(true);
      try {
        await api.exportCustomersCsv();
      } catch (e) {
        avisar(e instanceof Error ? e.message : 'No se pudo exportar.', { error: true });
      } finally {
        setExportando(false);
      }
    } else exportarCuentasCsv(visibles);
  };

  return (
    <div>
      <div className="glass rounded-[28px] overflow-hidden">
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/70 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <BlockTitle>Clientes · {cartera.length}</BlockTitle>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button type="button" onClick={() => void exportar()} disabled={exportando || !visibles.length} className={BTN_SEC}>
                {exportando ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Exportar CSV
              </button>
              <button
                type="button"
                onClick={onAgregar}
                disabled={fuente !== 'real' && fuente !== 'ejemplo'}
                className={BTN_PRI + ' !py-1.5 !px-3.5 !text-[12px]'}
              >
                <Plus size={13} /> Agregar cliente
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-ink/30" />
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, RFC, correo o teléfono" className={CONTROL + ' !pl-8'} />
            </div>
            <select value={agente} onChange={(e) => setAgente(e.target.value)} className={CONTROL + ' !w-auto'} aria-label="Filtrar por agente">
              <option value="">Todos los agentes</option>
              {agentes.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <select value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className={CONTROL + ' !w-auto'} aria-label="Ordenar">
              <option value="nombre">Ordenar: nombre</option>
              <option value="saldo">Ordenar: mayor saldo</option>
              <option value="dias">Ordenar: más días vencida</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS_DATOS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition-colors ${
                  filtro === f.id ? 'bg-brand-ink text-white' : 'bg-white/55 ring-1 ring-brand-ink/[0.08] text-brand-ink/60 hover:bg-white hover:text-brand-ink'
                }`}
              >
                {f.nombre} <span className="opacity-60 tabular-nums">{cuenta(f.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto divide-y divide-white/70">
          {visibles.map((c) => (
            <div key={c.id} className={abierto === c.id ? 'bg-white/30' : ''}>
            <div className="flex flex-col md:flex-row md:items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-white/40 transition-colors">
              <div className="min-w-0 md:w-[28%]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAbierto(abierto === c.id ? null : c.id)}
                    aria-expanded={abierto === c.id}
                    className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink hover:text-cyan-800 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 rounded-lg"
                  >
                    <ChevronDown size={14} className={`shrink-0 text-brand-ink/40 transition-transform duration-300 ${abierto === c.id ? 'rotate-180' : ''}`} />
                    {c.cliente}
                  </button>
                  {!c.contactable && <span className="audit-badge bg-amber-50 text-amber-700" title={c.motivo}>Pausado</span>}
                  {esRepetido(c) && <span className="audit-badge bg-rose-50 text-rose-700">Teléfono repetido</span>}
                </div>
                <div className="text-[11px] text-brand-ink/45 font-mono mt-0.5">{c.datos?.rfc ?? 'Ejemplo'}</div>
              </div>
              <div className="min-w-0 md:flex-1 text-[12px] text-brand-ink/60">
                <div className="truncate">
                  {c.datos?.contacto ?? c.registrado}
                  {c.datos?.telefono ? ` · ${c.datos.telefono}` : ''}
                  {c.datos?.correo ? ` · ${c.datos.correo}` : ''}
                </div>
                <div className={`truncate ${c.finanzas ? '' : 'text-rose-600'}`}>
                  Finanzas: {c.finanzas ? `${c.finanzas.nombre} · ${c.finanzas.telefono}` : 'sin contacto'}
                </div>
              </div>
              <div className="text-[12px] md:w-[18%] tabular-nums">
                <div className="font-semibold text-brand-ink">{CURRENCY_FORMATTER.format(saldoDe(c))}</div>
                <div className="text-brand-ink/45">
                  {c.saldada ? 'Al corriente' : c.dias > 0 ? `${c.dias} días vencida` : `vence en ${-c.dias} días`} · {c.agente}
                </div>
              </div>
              <AccionesCliente cuenta={c} avisar={avisar} compacto onEditar={() => onEditar(c)} />
            </div>
            <AnimatePresence initial={false}>
              {abierto === c.id && <DetalleCliente cuenta={c} avisar={avisar} onEditar={onEditar} />}
            </AnimatePresence>
            </div>
          ))}
          {!visibles.length && <p className="px-6 py-10 text-center text-[13px] text-brand-ink/45">Ningún cliente coincide con la búsqueda.</p>}
        </div>
      </div>
    </div>
  );
}

/** Lo de un cliente, en tres partes para no saturar: facturas (con checador), ficha y bitácora. */
function DetalleCliente({
  cuenta: c,
  avisar,
  onEditar,
}: {
  cuenta: CuentaViva;
  avisar: ReturnType<typeof useAviso>['avisar'];
  onEditar: (c: CuentaViva, enfocar?: 'finanzasTelefono' | 'nota') => void;
}) {
  const reduce = useReducedMotion();
  const [parte, setParte] = React.useState<'facturas' | 'ficha' | 'bitacora'>('facturas');
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={SPRING_SUAVE}
      className="overflow-hidden"
    >
      <div className="px-4 sm:px-6 pb-6 pt-1">
        <Subpestanas
          grupo={`detalle-${c.id}`}
          etiqueta={`Detalle de ${c.cliente}`}
          valor={parte}
          onChange={setParte}
          opciones={[
            { id: 'facturas', nombre: 'Facturas', n: c.facturas.length },
            { id: 'ficha', nombre: 'Ficha' },
            { id: 'bitacora', nombre: 'Bitácora' },
          ]}
        />
        <div className="mt-4">
          <PanelSub id={parte}>
            {parte === 'facturas' && <FacturasCliente cuenta={c} avisar={avisar} />}
            {parte === 'ficha' && (
              <div className="space-y-4">
                <FichaCliente cuenta={c} />
                <div className="flex flex-wrap items-start gap-3">
                  <p
                    className={`flex-1 min-w-[220px] text-[12.5px] rounded-2xl px-4 py-2.5 leading-relaxed ${
                      c.datos?.nota ? 'glass-suave text-brand-ink/70' : 'text-brand-ink/40 border border-dashed border-brand-ink/15'
                    }`}
                  >
                    {c.datos?.nota ? (
                      <>
                        <span className="font-semibold text-brand-ink">Nota:</span> {c.datos.nota}
                      </>
                    ) : (
                      'Sin nota interna.'
                    )}
                  </p>
                  <button type="button" onClick={() => onEditar(c, 'nota')} disabled={!c.dbId} className={BTN_SEC}>
                    <Pencil size={11} /> {c.datos?.nota ? 'Editar nota' : 'Agregar nota'}
                  </button>
                </div>
              </div>
            )}
            {parte === 'bitacora' && <BitacoraCliente dbId={c.dbId} />}
          </PanelSub>
        </div>
      </div>
    </motion.div>
  );
}

// ── Base de cartera ────────────────────────────────────────────────────

/** Formatos de CSV que entiende el importador (columnas en este orden). */
const FORMATOS = {
  clientes: {
    archivo: 'formato-clientes.csv',
    columnas: 'externalId,name,rfc,email,phone,financeContactName,financeContactPhone,financeContactEmail',
    // Teléfonos de EJEMPLO inválidos a propósito (lada 00): si se sube el archivo
    // tal cual, ningún mensaje le puede llegar a una persona real.
    ejemplo: 'CLI-001,Distribuidora Uno,DUN010101AB1,pagos@uno.mx,+520000000001,Nombre de Tesorería,+520000000002,tesoreria@uno.mx',
  },
  facturas: {
    archivo: 'formato-facturas.csv',
    columnas: 'externalId,customerExternalId,folio,total,currency,date,dueDate',
    ejemplo: 'FAC-001,CLI-001,F-1001,116000,MXN,2026-10-01,2026-10-31',
  },
} as const;
type Tipo = keyof typeof FORMATOS;

function descargarFormato(tipo: Tipo) {
  const f = FORMATOS[tipo];
  const blob = new Blob([`${f.columnas}\n${f.ejemplo}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.archivo;
  a.click();
  URL.revokeObjectURL(url);
}

function CargaCartera() {
  const { cartera, fuente, recargarCartera, refrescarWhatsapp } = useCobranza();
  const refs = { clientes: React.useRef<HTMLInputElement>(null), facturas: React.useRef<HTMLInputElement>(null) };
  const [cargando, setCargando] = React.useState<Tipo | null>(null);
  const [resultado, setResultado] = React.useState<{ ok: boolean; texto: string; errores: string[] } | null>(null);
  const [verTodos, setVerTodos] = React.useState(false);
  // Vista previa: qué se va a cargar, antes de mandarlo.
  const [previa, setPrevia] = React.useState<{ tipo: Tipo; file: File; filas: number; faltan: string[]; muestra: string[] } | null>(null);

  const revisar = async (tipo: Tipo, file: File) => {
    const texto = await file.text();
    const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    const encabezado = (lineas[0] ?? '').split(',').map((x) => x.trim());
    const faltan = FORMATOS[tipo].columnas.split(',').filter((col) => !encabezado.includes(col));
    setResultado(null);
    setPrevia({ tipo, file, filas: Math.max(0, lineas.length - 1), faltan, muestra: lineas.slice(1, 4) });
  };

  const descargarErrores = (errores: string[]) => {
    const blob = new Blob([`error\n${errores.map((e) => `"${e.replace(/"/g, '""')}"`).join('\n')}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errores-carga.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  const total = cartera.reduce((s, c) => s + saldoDe(c), 0);

  const subir = async (tipo: Tipo, file: File) => {
    setCargando(tipo);
    setResultado(null);
    try {
      const r = tipo === 'clientes' ? await api.syncExternalCustomers(file) : await api.syncExternalReceivables(file);
      await Promise.all([recargarCartera(), refrescarWhatsapp()]);
      setResultado({
        ok: r.skipped === 0,
        texto: `${r.imported} ${tipo} ${r.imported === 1 ? 'cargado' : 'cargados'}${r.skipped ? ` · ${r.skipped} con error` : ''}.`,
        errores: r.errors,
      });
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof Error ? e.message : 'No se pudo cargar el archivo.', errores: [] });
    } finally {
      setCargando(null);
    }
  };

  return (
    <Reveal delay={0.06}>
      <div className="glass rounded-[28px] p-6 sm:p-7 h-full">
        <BlockTitle icon={<Database size={12} />}>Base de cartera</BlockTitle>
        {/* Conteos y faltantes viven en la tabla de abajo (filtros): aquí solo el total. */}
        <p className="text-[12px] text-brand-ink/50 mt-3">
          {fuente === 'real' ? 'Datos de tu base de datos' : 'Datos de ejemplo: todavía no hay clientes cargados'} ·{' '}
          <span className="font-semibold text-brand-ink tabular-nums">{CURRENCY_FORMATTER.format(total)}</span> por cobrar
        </p>

        {/* Primero clientes, luego sus facturas (cada factura se liga a su cliente por el ID). */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(['clientes', 'facturas'] as Tipo[]).map((tipo, i) => (
            <div key={tipo} className="rounded-[22px] border-2 border-dashed border-brand-ink/12 bg-white/30 p-3">
              <button
                onClick={() => refs[tipo].current?.click()}
                disabled={!!cargando}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-[13px] font-semibold text-brand-ink/80 hover:bg-white/70 transition-colors disabled:opacity-50"
              >
                {cargando === tipo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {i + 1}. Cargar {tipo} (CSV)
              </button>
              <button
                onClick={() => descargarFormato(tipo)}
                className="w-full mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-brand-ink/40 hover:text-brand-ink"
              >
                <Download size={11} /> Descargar formato
              </button>
              <input
                ref={refs[tipo]}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void revisar(tipo, f);
                  e.target.value = '';
                }}
              />
            </div>
          ))}
        </div>

        {previa && (
          <div className="glass-suave mt-3 text-[12px] rounded-2xl px-4 py-3">
            <div className="font-semibold text-brand-ink">
              {previa.file.name} · {previa.filas} {previa.filas === 1 ? 'renglón' : 'renglones'} de {previa.tipo}
            </div>
            {previa.faltan.length > 0 ? (
              <p className="mt-1 text-amber-800">
                Faltan columnas: {previa.faltan.join(', ')}. Descarga el formato para ver el orden correcto.
              </p>
            ) : (
              <p className="mt-1 text-brand-ink/55">Las columnas coinciden con el formato. Primeros renglones:</p>
            )}
            {previa.muestra.map((l) => (
              <p key={l} className="mt-1 font-mono text-[10.5px] text-brand-ink/50 truncate">
                {l}
              </p>
            ))}
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => setPrevia(null)} className={BTN_SEC}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!previa.filas || !!cargando}
                onClick={() => {
                  const { tipo, file } = previa;
                  setPrevia(null);
                  void subir(tipo, file);
                }}
                className={BTN_PRI + ' !py-1.5 !px-3.5 !text-[12px]'}
              >
                <Upload size={12} /> Cargar {previa.filas} {previa.tipo}
              </button>
            </div>
          </div>
        )}

        {resultado && (
          <div
            className={`mt-3 text-[12px] rounded-xl px-3.5 py-2.5 border ${
              resultado.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2">
              {resultado.ok ? <Check size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
              {resultado.texto}
            </div>
            {(verTodos ? resultado.errores : resultado.errores.slice(0, 5)).map((e, i) => (
              <p key={`${i}-${e}`} className="mt-1 pl-5 text-[11px] opacity-80">
                {e}
              </p>
            ))}
            {resultado.errores.length > 0 && (
              <div className="flex flex-wrap gap-3 pl-5 mt-2">
                {resultado.errores.length > 5 && (
                  <button type="button" onClick={() => setVerTodos((v) => !v)} className="text-[11px] font-semibold underline">
                    {verTodos ? 'Ver menos' : `Ver los ${resultado.errores.length} errores`}
                  </button>
                )}
                <button type="button" onClick={() => descargarErrores(resultado.errores)} className="text-[11px] font-semibold underline">
                  Descargar errores (CSV)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Reveal>
  );
}

// ── Asignación de cuentas (Supervisor y Admin) ─────────────────────────

export function AsignacionPanel() {
  const { cartera, reasignar: reasignarCuenta, agentesReales, fuente } = useCobranza();
  const [cambio, setCambio] = React.useState<string | null>(null);
  const [elegidas, setElegidas] = React.useState<string[]>([]);
  const [destino, setDestino] = React.useState('');
  const [soloSin, setSoloSin] = React.useState(false);
  // Agentes reales (activos) cuando hay cartera real; los del ejemplo si no.
  const opciones =
    fuente === 'real' && agentesReales ? agentesReales.filter((a) => a.activo).map((a) => a.nombre) : [...AGENTES];
  const nombres = [...new Set([...opciones, ...cartera.map((c) => c.agente as string).filter((a) => a !== 'Sin asignar')])];
  const filas = [...cartera].filter((c) => !soloSin || (c.agente as string) === 'Sin asignar').sort((a, b) => b.dias - a.dias);
  const carga = [...nombres, 'Sin asignar'].map((a) => ({ a, n: cartera.filter((f) => f.agente === a).length })).filter((x) => x.n > 0 || x.a !== 'Sin asignar');

  const reasignar = (id: string, cliente: string, agente: Agente) => {
    reasignarCuenta(id, agente);
    setCambio(`${cliente} → ${agente}`);
  };
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();
  const reasignarLote = () => {
    if (!destino || !elegidas.length) return;
    const n = elegidas.length;
    confirmar({
      titulo: `¿Reasignar ${n} ${n === 1 ? 'cuenta' : 'cuentas'} a ${destino}?`,
      mensaje: `Desde hoy aparecen en la lista de ${destino} y salen de la de quien las tenía.`,
      accion: `Reasignar ${n}`,
      alConfirmar: () => {
        elegidas.forEach((id) => reasignarCuenta(id, destino as Agente));
        setCambio(`${n} ${n === 1 ? 'cuenta' : 'cuentas'} → ${destino}`);
        setElegidas([]);
        setDestino('');
      },
    });
  };

  return (
    <Reveal delay={0.1}>
      <div className="glass rounded-[28px] overflow-hidden mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/70">
          <BlockTitle>Asignación de cuentas</BlockTitle>
          <div className="flex flex-wrap gap-3 text-[11px] text-brand-ink/50">
            {carga.map(({ a, n }) => (
              <span key={a} className={a === 'Sin asignar' && n > 0 ? 'text-amber-700' : ''}>
                {a === 'Sin asignar' ? a : a.split(' ')[0]} <span className="font-semibold text-brand-ink tabular-nums">{n}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-white/70 bg-white/35">
          <label className="flex items-center gap-2 text-[12px] text-brand-ink/60">
            <input
              type="checkbox"
              checked={filas.length > 0 && elegidas.length === filas.length}
              onChange={(e) => setElegidas(e.target.checked ? filas.map((f) => f.id) : [])}
              className="w-4 h-4 accent-[#06B6D4]"
            />
            {elegidas.length ? `${elegidas.length} elegidas` : 'Elegir todas'}
          </label>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className="px-3 py-1.5 rounded-2xl glass-campo text-[12px] font-semibold text-brand-ink outline-none focus:border-brand-gold/60"
            aria-label="Reasignar las elegidas a"
          >
            <option value="">Reasignar a…</option>
            {nombres.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <button
            onClick={reasignarLote}
            disabled={!destino || !elegidas.length}
            className={BTN_PRI + ' !py-1.5 !px-3.5 !text-[12px]'}
          >
            Reasignar
          </button>
          <label className="ml-auto flex items-center gap-2 text-[12px] text-brand-ink/60">
            <input type="checkbox" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} className="w-4 h-4 accent-[#06B6D4]" />
            Solo sin asignar
          </label>
        </div>
        <div className="divide-y divide-white/70 max-h-[480px] overflow-y-auto">
          {filas.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-4 px-6 py-3">
              <input
                type="checkbox"
                checked={elegidas.includes(f.id)}
                onChange={() => setElegidas((e) => (e.includes(f.id) ? e.filter((x) => x !== f.id) : [...e, f.id]))}
                className="w-4 h-4 accent-[#06B6D4]"
                aria-label={`Elegir ${f.cliente}`}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-brand-ink">{f.cliente}</div>
                <div className="text-[11px] text-brand-ink/45 tabular-nums">
                  {CURRENCY_FORMATTER.format(saldoDe(f))} · {f.dias < 0 ? `vence en ${-f.dias} días` : `${f.dias} días vencida`}
                </div>
              </div>
              <select
                value={f.agente}
                onChange={(e) => reasignar(f.id, f.cliente, e.target.value as Agente)}
                className="px-3 py-2 rounded-2xl glass-campo text-[12px] font-semibold text-brand-ink outline-none focus:border-brand-gold/60"
              >
                {(f.agente as string) === 'Sin asignar' && <option>Sin asignar</option>}
                {nombres.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        {cambio && (
          <div className="px-6 py-3 bg-emerald-500/10 text-[12px] text-emerald-800 flex items-center gap-2">
            <Check size={12} /> Reasignado: {cambio}. El agente la verá en su lista de hoy.
          </div>
        )}
        {nodoConfirmar}
      </div>
    </Reveal>
  );
}
