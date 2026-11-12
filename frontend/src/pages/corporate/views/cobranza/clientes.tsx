import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Loader2, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import { api, type ActivityRow, type CustomerPayload } from '../../../../services/apiClient.ts';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { EASE } from './primitives.tsx';
import { saldoDe } from './mockV1.ts';
import { normalizarTelefono, useCobranza, type CuentaViva } from './store.tsx';

// Acciones sobre un cliente que comparten Datos, Clientes y Equipo: editar,
// agregar, pausar el contacto, eliminar con "Deshacer", ficha y bitácora.
// Mismo lenguaje visual que el resto de Cobranza IA (tarjetas brand-paper).

export const CONTROL =
  'glass-campo w-full px-3.5 py-2.5 rounded-2xl text-sm text-brand-ink placeholder:text-brand-ink/35 outline-none';
export const BTN_SEC =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 ring-1 ring-brand-ink/10 text-[11.5px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 disabled:opacity-40 disabled:cursor-not-allowed';
export const BTN_PRI =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-brand-ink text-white text-[12.5px] font-semibold hover:bg-black shadow-[0_10px_30px_-12px_rgba(17,24,39,0.6)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed';
export const ETIQUETA = 'text-[10px] uppercase tracking-[0.14em] text-brand-ink/40';

const last10 = (t: string | null | undefined) => (t ? t.replace(/\D/g, '').slice(-10) : '');

/** Teléfonos que aparecen en más de un cliente: últimos 10 dígitos → clientes. */
export function telefonosRepetidos(cartera: CuentaViva[]): Map<string, string[]> {
  const por = new Map<string, Set<string>>();
  for (const c of cartera) {
    for (const t of [c.datos?.telefono, c.datos?.finanzasTelefono ?? c.finanzas?.telefono]) {
      const k = last10(t);
      if (k.length < 10) continue;
      if (!por.has(k)) por.set(k, new Set());
      por.get(k)!.add(c.cliente);
    }
  }
  const out = new Map<string, string[]>();
  for (const [k, v] of por) if (v.size > 1) out.set(k, [...v]);
  return out;
}

/** Con qué otros clientes comparte teléfono (para avisar antes de guardar). */
export function compartenTelefono(cartera: CuentaViva[], c: CuentaViva): string[] {
  const rep = telefonosRepetidos(cartera);
  const propios = [c.datos?.telefono, c.datos?.finanzasTelefono ?? c.finanzas?.telefono].map(last10);
  return [...new Set(propios.flatMap((k) => (rep.get(k) ?? []).filter((n) => n !== c.cliente)))];
}

/** Exporta las cuentas dadas a CSV (lo que se ve en pantalla). */
export function exportarCuentasCsv(cuentas: CuentaViva[], archivo = 'clientes-cobranza.csv') {
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [
    ['Cliente', 'RFC', 'Contacto', 'Teléfono', 'Correo', 'Finanzas', 'Teléfono finanzas', 'Agente', 'Segmento', 'Saldo', 'Días vencida', 'No contactar'],
    ...cuentas.map((c) => [
      c.cliente,
      c.datos?.rfc ?? '',
      c.datos?.contacto ?? c.registrado,
      c.datos?.telefono ?? '',
      c.datos?.correo ?? '',
      c.finanzas?.nombre ?? '',
      c.finanzas?.telefono ?? '',
      c.agente,
      c.segmento,
      saldoDe(c),
      c.dias,
      c.contactable ? 'No' : 'Sí',
    ]),
  ];
  const blob = new Blob(['﻿' + filas.map((f) => f.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Aviso flotante con "Deshacer" ─────────────────────────────────────

type Aviso = { id: number; texto: string; deshacer?: () => void; error?: boolean };

/** Aviso abajo al centro. `deshacer` agrega el botón por unos segundos. */
export function useAviso() {
  const reduce = useReducedMotion();
  const [aviso, setAviso] = React.useState<Aviso | null>(null);
  React.useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), aviso.deshacer ? 7000 : 4000);
    return () => window.clearTimeout(t);
  }, [aviso]);
  const avisar = React.useCallback(
    (texto: string, opciones: { deshacer?: () => void; error?: boolean } = {}) => setAviso({ id: Date.now(), texto, ...opciones }),
    [],
  );
  const nodo = createPortal(
    <div className="font-royaltica fixed bottom-6 inset-x-0 z-[90] flex justify-center pointer-events-none px-4" aria-live="polite">
      <AnimatePresence>
        {aviso && (
          <motion.div
            key={aviso.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className={`pointer-events-auto flex items-center gap-4 rounded-full pl-5 pr-2 py-2 text-white shadow-lg ${aviso.error ? 'bg-rose-700' : 'bg-brand-ink'}`}
          >
            <span className="text-[13px]">{aviso.texto}</span>
            {aviso.deshacer ? (
              <button
                type="button"
                onClick={() => {
                  aviso.deshacer?.();
                  setAviso(null);
                }}
                className="rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-gold"
              >
                Deshacer
              </button>
            ) : (
              <button type="button" aria-label="Cerrar aviso" onClick={() => setAviso(null)} className="p-1.5 text-white/60 hover:text-white">
                <X size={13} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
  return { avisar, nodo };
}

// ── Ventana (modal) ───────────────────────────────────────────────────

export function Ventana({
  titulo,
  subtitulo,
  onCerrar,
  children,
  ancho = 'max-w-2xl',
}: {
  titulo: string;
  subtitulo?: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: string;
}) {
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);
  return createPortal(
    <div className="font-royaltica fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        className="fixed inset-0 bg-brand-ink/30 backdrop-blur-md"
        onClick={onCerrar}
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.25 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 }}
        className={`glass-flotante relative w-full ${ancho} rounded-[28px] overflow-hidden`}
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-gold/15 blur-[80px]" />
        <div className="relative flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <h3 className="text-lg text-brand-ink tracking-tight">{titulo}</h3>
            {subtitulo && <p className="text-[12.5px] text-brand-ink/50 mt-0.5">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-white/70 ring-1 ring-brand-ink/10 text-brand-ink/55 hover:text-brand-ink hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
          >
            <X size={16} />
          </button>
        </div>
        <div className="relative px-6 pb-6 pt-1">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}

function Campo({ label, children, ancho = '' }: { label: string; children: React.ReactNode; ancho?: string }) {
  return (
    <label className={`block ${ancho}`}>
      <span className={ETIQUETA}>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ── Formulario de cliente (editar o agregar) ──────────────────────────

type Form = {
  nombre: string;
  razonSocial: string;
  rfc: string;
  categoria: string;
  diasCredito: string;
  contacto: string;
  telefono: string;
  correo: string;
  finanzasNombre: string;
  finanzasTelefono: string;
  finanzasCorreo: string;
  agenteId: string;
  nota: string;
};

function formDe(c?: CuentaViva): Form {
  const d = c?.datos;
  return {
    nombre: c?.cliente ?? '',
    razonSocial: d?.razonSocial ?? '',
    rfc: d?.rfc ?? '',
    categoria: d?.categoria ?? '',
    diasCredito: d?.diasCredito != null ? String(d.diasCredito) : '',
    contacto: d?.contacto ?? '',
    telefono: d?.telefono ?? '',
    correo: d?.correo ?? '',
    finanzasNombre: d?.finanzasNombre ?? c?.finanzas?.nombre ?? '',
    finanzasTelefono: d?.finanzasTelefono ?? c?.finanzas?.telefono ?? '',
    finanzasCorreo: d?.finanzasCorreo ?? '',
    agenteId: d?.agenteId ?? '',
    nota: d?.nota ?? '',
  };
}

/** Solo lo que cambió; un campo vacío se manda como null (borra el dato). */
function cambiosDe(antes: Form, ahora: Form, nuevo: boolean): CustomerPayload {
  const out: CustomerPayload = {};
  const texto = (v: string) => (v.trim() ? v.trim() : null);
  const tel = (v: string) => (v.trim() ? normalizarTelefono(v) : null);
  const dif = (k: keyof Form) => nuevo || antes[k] !== ahora[k];
  if (dif('nombre')) out.name = ahora.nombre.trim();
  if (dif('razonSocial')) out.legalName = ahora.razonSocial.trim() || ahora.nombre.trim();
  if (dif('rfc')) out.rfc = ahora.rfc.trim().toUpperCase();
  if (dif('categoria')) out.category = texto(ahora.categoria);
  if (dif('diasCredito')) out.creditLimitDays = ahora.diasCredito.trim() ? Number(ahora.diasCredito) : null;
  if (dif('contacto')) out.contact = texto(ahora.contacto);
  if (dif('telefono')) out.phone = tel(ahora.telefono);
  if (dif('correo')) out.email = texto(ahora.correo);
  if (dif('finanzasNombre')) out.financeContactName = texto(ahora.finanzasNombre);
  if (dif('finanzasTelefono')) out.financeContactPhone = tel(ahora.finanzasTelefono);
  if (dif('finanzasCorreo')) out.financeContactEmail = texto(ahora.finanzasCorreo);
  if (dif('agenteId')) out.assignedAgentId = ahora.agenteId || null;
  if (dif('nota')) out.notes = texto(ahora.nota);
  // Al crear no se mandan los vacíos (el backend no los necesita).
  if (nuevo) for (const k of Object.keys(out) as (keyof CustomerPayload)[]) if (out[k] === null) delete out[k];
  return out;
}

const telValido = (t: string) => !t.trim() || /^\+[1-9]\d{7,14}$/.test(normalizarTelefono(t));
const correoValido = (t: string) => !t.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.trim());

export function ClienteForm({
  cuenta,
  onCerrar,
  onListo,
  enfocar,
}: {
  /** Sin cuenta = agregar un cliente nuevo. */
  cuenta?: CuentaViva;
  onCerrar: () => void;
  onListo: (mensaje: string) => void;
  /** Campo a enfocar al abrir (ej. el teléfono de finanzas). */
  enfocar?: 'finanzasTelefono' | 'nota';
}) {
  const { cartera, editarCliente, crearCliente, agentesReales } = useCobranza();
  const nuevo = !cuenta;
  const inicial = React.useMemo(() => formDe(cuenta), [cuenta]);
  const [f, setF] = React.useState<Form>(inicial);
  const [guardando, setGuardando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Al editar, antes de guardar se muestra qué cambia (antes → ahora) para confirmarlo.
  const [revisando, setRevisando] = React.useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  // ¿El teléfono ya lo tiene otro cliente? (es lo que confunde las respuestas de WhatsApp)
  const otros = cartera.filter((c) => c.id !== cuenta?.id);
  const duenoDe = (t: string) => {
    const k = last10(t);
    if (k.length < 10) return [];
    return otros.filter((c) => [c.datos?.telefono, c.datos?.finanzasTelefono ?? c.finanzas?.telefono].map(last10).includes(k)).map((c) => c.cliente);
  };
  const repTel = duenoDe(f.telefono);
  const repFin = duenoDe(f.finanzasTelefono);

  const errores = [
    !f.nombre.trim() && 'Escribe el nombre del cliente.',
    nuevo && !f.rfc.trim() && 'Escribe el RFC.',
    !telValido(f.telefono) && 'El teléfono no es válido. Usa 10 dígitos o el formato +52…',
    !telValido(f.finanzasTelefono) && 'El teléfono de finanzas no es válido.',
    !correoValido(f.correo) && 'El correo no es válido.',
    !correoValido(f.finanzasCorreo) && 'El correo de finanzas no es válido.',
    f.diasCredito.trim() && !/^\d{1,3}$/.test(f.diasCredito.trim()) && 'Los días de crédito deben ser un número.',
  ].filter(Boolean) as string[];

  const cambios = cambiosDe(inicial, f, nuevo);
  const hayCambios = Object.keys(cambios).length > 0;

  const guardar = async () => {
    if (errores.length || !hayCambios) return;
    setGuardando(true);
    setError(null);
    const err = nuevo
      ? await crearCliente({ ...cambios, name: f.nombre.trim(), rfc: f.rfc.trim().toUpperCase(), legalName: f.razonSocial.trim() || f.nombre.trim() })
      : await editarCliente(cuenta.id, cambios);
    setGuardando(false);
    if (err) return setError(err);
    onListo(nuevo ? `Agregaste a ${f.nombre.trim()}` : `Guardaste los cambios de ${f.nombre.trim()}`);
    onCerrar();
  };

  const ref = React.useRef<HTMLInputElement>(null);
  const refNota = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (enfocar === 'nota') refNota.current?.focus();
    else if (enfocar === 'finanzasTelefono') ref.current?.focus();
  }, [enfocar]);

  return (
    <Ventana
      titulo={nuevo ? 'Agregar cliente' : `Editar ${cuenta.cliente}`}
      subtitulo={nuevo ? 'Los campos con * son obligatorios.' : 'Deja un campo vacío para borrar ese dato.'}
      onCerrar={onCerrar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (nuevo || revisando) void guardar();
          else if (hayCambios && !errores.length) setRevisando(true);
        }}
        className="space-y-5"
      >
        {revisando ? (
          <ResumenCambios antes={inicial} ahora={f} agentes={agentesReales} />
        ) : (
        <>
        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-[12px] font-semibold text-brand-ink mb-2">Empresa</legend>
          <Campo label="Nombre *">
            <input className={CONTROL} value={f.nombre} onChange={set('nombre')} autoFocus={!enfocar} />
          </Campo>
          <Campo label="Razón social">
            <input className={CONTROL} value={f.razonSocial} onChange={set('razonSocial')} placeholder={f.nombre} />
          </Campo>
          <Campo label={nuevo ? 'RFC *' : 'RFC'}>
            <input className={CONTROL + ' uppercase'} value={f.rfc} onChange={set('rfc')} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoría">
              <input className={CONTROL} value={f.categoria} onChange={set('categoria')} />
            </Campo>
            <Campo label="Días de crédito">
              <input className={CONTROL} inputMode="numeric" value={f.diasCredito} onChange={set('diasCredito')} />
            </Campo>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="text-[12px] font-semibold text-brand-ink mb-2">Contacto principal</legend>
          <Campo label="Nombre">
            <input className={CONTROL} value={f.contacto} onChange={set('contacto')} />
          </Campo>
          <Campo label="Teléfono">
            <input className={CONTROL} inputMode="tel" value={f.telefono} onChange={set('telefono')} placeholder="55 1234 5678" />
          </Campo>
          <Campo label="Correo">
            <input className={CONTROL} type="email" value={f.correo} onChange={set('correo')} />
          </Campo>
          {repTel.length > 0 && <Repetido nombres={repTel} />}
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="text-[12px] font-semibold text-brand-ink mb-2">
            Finanzas / tesorería <span className="font-normal text-brand-ink/45">· a quien le escribe la cobranza</span>
          </legend>
          <Campo label="Nombre">
            <input className={CONTROL} value={f.finanzasNombre} onChange={set('finanzasNombre')} />
          </Campo>
          <Campo label="Teléfono (WhatsApp)">
            <input ref={ref} className={CONTROL} inputMode="tel" value={f.finanzasTelefono} onChange={set('finanzasTelefono')} placeholder="55 1234 5678" />
          </Campo>
          <Campo label="Correo">
            <input className={CONTROL} type="email" value={f.finanzasCorreo} onChange={set('finanzasCorreo')} />
          </Campo>
          {repFin.length > 0 && <Repetido nombres={repFin} />}
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <legend className="text-[12px] font-semibold text-brand-ink mb-2">Equipo</legend>
          <Campo label="Agente">
            {agentesReales ? (
              <select className={CONTROL} value={f.agenteId} onChange={set('agenteId')}>
                <option value="">Sin asignar</option>
                {agentesReales.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.activo ? '' : ' (inactivo)'}
                  </option>
                ))}
              </select>
            ) : (
              <input className={CONTROL} value={cuenta?.agente ?? 'Sin asignar'} disabled />
            )}
          </Campo>
          <Campo label="Nota interna (no la ve el cliente)" ancho="sm:col-span-2">
            <textarea ref={refNota} className={CONTROL + ' min-h-[42px]'} rows={2} value={f.nota} onChange={set('nota')} placeholder="Ej. Prometió pagar el viernes" />
          </Campo>
        </fieldset>
        </>
        )}

        {(errores.length > 0 || error) && (
          <ul className="text-[12px] text-rose-700 bg-rose-500/10 rounded-2xl px-4 py-2.5 space-y-0.5">
            {[...errores, ...(error ? [error] : [])].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => (revisando ? setRevisando(false) : onCerrar())}
            className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}
          >
            {revisando ? 'Seguir editando' : 'Cancelar'}
          </button>
          <button type="submit" disabled={guardando || errores.length > 0 || !hayCambios} className={BTN_PRI}>
            {guardando && <Loader2 size={13} className="animate-spin" />}
            {nuevo ? 'Agregar cliente' : revisando ? 'Confirmar cambios' : 'Revisar cambios'}
          </button>
        </div>
      </form>
    </Ventana>
  );
}

const ETIQUETA_CAMPO: Record<keyof Form, string> = {
  nombre: 'Nombre',
  razonSocial: 'Razón social',
  rfc: 'RFC',
  categoria: 'Categoría',
  diasCredito: 'Días de crédito',
  contacto: 'Contacto principal',
  telefono: 'Teléfono',
  correo: 'Correo',
  finanzasNombre: 'Contacto de finanzas',
  finanzasTelefono: 'WhatsApp de finanzas',
  finanzasCorreo: 'Correo de finanzas',
  agenteId: 'Agente',
  nota: 'Nota interna',
};

/** Lo que cambia, campo por campo, para confirmar antes de guardar. */
function ResumenCambios({
  antes,
  ahora,
  agentes,
}: {
  antes: Form;
  ahora: Form;
  agentes: { id: string; nombre: string }[] | null | undefined;
}) {
  const reduce = useReducedMotion();
  const ver = (k: keyof Form, v: string) =>
    k === 'agenteId' ? (v ? agentes?.find((a) => a.id === v)?.nombre ?? v : 'Sin asignar') : v.trim() || '—';
  const campos = (Object.keys(ETIQUETA_CAMPO) as (keyof Form)[]).filter((k) => antes[k].trim() !== ahora[k].trim());
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="space-y-3"
    >
      <p className="text-[13px] text-brand-ink/60">
        Vas a cambiar {campos.length} {campos.length === 1 ? 'dato' : 'datos'}. Revisa que esté bien antes de guardar:
      </p>
      <ul className="glass-suave rounded-[22px] divide-y divide-white/70 overflow-hidden">
        {campos.map((k) => (
          <li key={k} className="grid grid-cols-1 sm:grid-cols-[150px_1fr] gap-1 sm:gap-4 px-4 py-3 text-[13px]">
            <span className="text-brand-ink/50">{ETIQUETA_CAMPO[k]}</span>
            <span className="min-w-0 flex flex-wrap items-center gap-2">
              <span className="text-brand-ink/40 line-through decoration-brand-ink/25 truncate max-w-[45%]">{ver(k, antes[k])}</span>
              <span className="text-brand-ink/30">→</span>
              <span className={`font-semibold truncate ${ahora[k].trim() ? 'text-brand-ink' : 'text-rose-600'}`}>
                {ahora[k].trim() ? ver(k, ahora[k]) : 'Se borra'}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function Repetido({ nombres }: { nombres: string[] }) {
  return (
    <p className="sm:col-span-3 flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      Este teléfono también es de {nombres.join(', ')}. Si dos clientes comparten número, las respuestas de WhatsApp pueden caer en el
      cliente equivocado.
    </p>
  );
}

// ── Acciones: editar, pausar contacto, eliminar ───────────────────────

/**
 * Botones de acción sobre un cliente con su lógica (confirmaciones,
 * "Deshacer"). `compacto` muestra solo íconos (para filas de tabla).
 */
export function AccionesCliente({
  cuenta,
  avisar,
  compacto = false,
  puedeEliminar = true,
  onEditar,
}: {
  cuenta: CuentaViva;
  avisar: ReturnType<typeof useAviso>['avisar'];
  compacto?: boolean;
  puedeEliminar?: boolean;
  onEditar: () => void;
}) {
  const { pausarContacto, eliminarCliente, restaurarCliente } = useCobranza();
  const [confirmar, setConfirmar] = React.useState<'pausar' | 'eliminar' | null>(null);
  const [motivo, setMotivo] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const pausado = !cuenta.contactable;
  const real = !!cuenta.dbId;
  const titulo = real ? undefined : 'Cliente de ejemplo: carga tu cartera real para usar esta acción';

  const pausar = async () => {
    setOcupado(true);
    const err = await pausarContacto(cuenta.id, !pausado, motivo);
    setOcupado(false);
    setConfirmar(null);
    setMotivo('');
    if (err) return avisar(err, { error: true });
    avisar(pausado ? `${cuenta.cliente} vuelve a recibir mensajes` : `Pausaste todo contacto con ${cuenta.cliente}`, {
      deshacer: () => void pausarContacto(cuenta.id, pausado, motivo),
    });
  };

  const eliminar = async () => {
    setOcupado(true);
    const dbId = cuenta.dbId!;
    const err = await eliminarCliente(cuenta.id);
    setOcupado(false);
    setConfirmar(null);
    if (err) return avisar(err, { error: true });
    avisar(`Eliminaste a ${cuenta.cliente}`, {
      deshacer: () => void restaurarCliente(dbId).then((e) => e && avisar(e, { error: true })),
    });
  };

  const abiertas = cuenta.facturas.filter((f) => f.monto - f.pagado > 1).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={onEditar} disabled={!real} title={titulo} className={BTN_SEC} aria-label={`Editar ${cuenta.cliente}`}>
          <Pencil size={11} /> {!compacto && 'Editar'}
        </button>
        <button
          type="button"
          onClick={() => (pausado ? void pausar() : setConfirmar('pausar'))}
          disabled={!real || ocupado}
          title={titulo ?? (pausado ? `Pausado: ${cuenta.motivo ?? ''}` : 'Detener todos los mensajes automáticos a este cliente')}
          className={BTN_SEC}
          aria-label={pausado ? `Reanudar contacto con ${cuenta.cliente}` : `Pausar contacto con ${cuenta.cliente}`}
        >
          {pausado ? <Play size={11} /> : <Pause size={11} />} {!compacto && (pausado ? 'Reanudar contacto' : 'Pausar contacto')}
        </button>
        {puedeEliminar && (
          <button
            type="button"
            onClick={() => setConfirmar('eliminar')}
            disabled={!real || ocupado}
            title={titulo}
            className={BTN_SEC + ' hover:!bg-rose-50 hover:!text-rose-700'}
            aria-label={`Eliminar ${cuenta.cliente}`}
          >
            <Trash2 size={11} /> {!compacto && 'Eliminar'}
          </button>
        )}
      </div>

      {confirmar === 'pausar' && (
        <Ventana titulo={`Pausar contacto con ${cuenta.cliente}`} subtitulo="Ningún canal automático le escribirá hasta que lo reanudes." onCerrar={() => setConfirmar(null)} ancho="max-w-md">
          <Campo label="Motivo (opcional)">
            <input className={CONTROL} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Pidió no ser contactado, está en negociación…" />
          </Campo>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setConfirmar(null)} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
              Cancelar
            </button>
            <button type="button" onClick={() => void pausar()} disabled={ocupado} className={BTN_PRI}>
              {ocupado && <Loader2 size={13} className="animate-spin" />} Pausar contacto
            </button>
          </div>
        </Ventana>
      )}

      {confirmar === 'eliminar' && (
        <Ventana titulo={`¿Eliminar a ${cuenta.cliente}?`} onCerrar={() => setConfirmar(null)} ancho="max-w-md">
          {abiertas > 0 ? (
            <p className="text-[13px] text-brand-ink/70 leading-relaxed">
              Tiene {abiertas} {abiertas === 1 ? 'factura abierta' : 'facturas abiertas'}. Para eliminarlo primero cóbralas o cancélalas en
              Clientes → Facturas. Si solo quieres dejar de escribirle, usa <span className="font-semibold">Pausar contacto</span>.
            </p>
          ) : (
            <p className="text-[13px] text-brand-ink/70 leading-relaxed">
              Deja de aparecer en la cartera, campañas y reportes. Podrás deshacerlo unos segundos después.
            </p>
          )}
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" autoFocus onClick={() => setConfirmar(null)} className={BTN_SEC + ' !py-2.5 !px-3.5 !text-[12px]'}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void eliminar()}
              disabled={ocupado || abiertas > 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 text-white text-[12px] font-semibold hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {ocupado && <Loader2 size={13} className="animate-spin" />} Eliminar
            </button>
          </div>
        </Ventana>
      )}
    </>
  );
}

// ── Ficha del cliente (datos a la vista) ──────────────────────────────

export function FichaCliente({ cuenta }: { cuenta: CuentaViva }) {
  const d = cuenta.datos;
  const filas: [string, string][] = [
    ['RFC', d?.rfc ?? '—'],
    ['Contacto', [d?.contacto ?? cuenta.registrado, d?.telefono].filter(Boolean).join(' · ') || '—'],
    ['Correo', d?.correo ?? '—'],
    ['Finanzas', cuenta.finanzas ? [cuenta.finanzas.nombre, cuenta.finanzas.telefono, d?.finanzasCorreo].filter(Boolean).join(' · ') : 'Sin contacto'],
    ['Crédito', d?.diasCredito != null ? `${d.diasCredito} días` : '—'],
    ['Saldo', CURRENCY_FORMATTER.format(saldoDe(cuenta))],
  ];
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 mt-4">
      {filas.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className={ETIQUETA}>{k}</dt>
          <dd className={`text-[12.5px] mt-0.5 truncate ${v === 'Sin contacto' ? 'text-rose-600' : 'text-brand-ink/75'}`} title={v}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ── Bitácora de cambios del cliente ───────────────────────────────────

const ACCION: Record<string, string> = {
  CUSTOMER_CREATED: 'Lo dio de alta',
  CUSTOMER_UPDATED: 'Editó',
  CUSTOMER_DELETED: 'Lo eliminó',
  CUSTOMER_RESTORED: 'Lo recuperó',
  CUSTOMER_RISK_WORSENED: 'Su riesgo empeoró',
  CUSTOMER_SCORE_DROP: 'Bajó su puntualidad',
  CUSTOMER_PORTAL_LINK_ISSUED: 'Se generó su liga de pago',
  CUSTOMER_PORTAL_VIEWED: 'Abrió su liga de pago',
  CUSTOMER_DO_NOT_CONTACT_SET: 'Pidió no ser contactado',
  CUSTOMER_PROMISED_PAYMENT: 'Prometió pagar',
  CUSTOMER_CLAIMED_PAID: 'Dijo que ya pagó',
  CUSTOMER_CLAIMED_PAID_REPEAT: 'Volvió a decir que ya pagó',
  CUSTOMER_DISPUTED_INVOICE: 'Disputó una factura',
  CUSTOMER_ESCALATION: 'Se escaló',
  CUSTOMER_REPLY: 'Respondió',
};
/** Código interno sin traducción → texto legible ("CUSTOMER_FOO_BAR" → "foo bar"). */
const legible = (a: string) => a.replace(/^CUSTOMER_/, '').replace(/_/g, ' ').toLowerCase();
const CAMPO: Record<string, string> = {
  name: 'nombre',
  legalName: 'razón social',
  rfc: 'RFC',
  contact: 'contacto',
  email: 'correo',
  phone: 'teléfono',
  category: 'categoría',
  creditLimitDays: 'días de crédito',
  assignedAgentId: 'agente',
  financeContactName: 'contacto de finanzas',
  financeContactPhone: 'teléfono de finanzas',
  financeContactEmail: 'correo de finanzas',
  doNotContact: 'pausa de contacto',
  doNotContactReason: 'motivo de pausa',
  notes: 'nota',
};

/** Quién cambió qué y cuándo (lo ven los administradores). */
export function BitacoraCliente({ dbId }: { dbId?: string }) {
  const [filas, setFilas] = React.useState<ActivityRow[] | null | undefined>(undefined);
  React.useEffect(() => {
    if (!dbId) return setFilas(null);
    let vivo = true;
    setFilas(undefined);
    api
      .getEntityActivity('Customer', dbId)
      .then((r) => vivo && setFilas(r))
      .catch(() => vivo && setFilas(null));
    return () => {
      vivo = false;
    };
  }, [dbId]);

  if (filas === null) return null;
  return (
    <div className="mt-6">
      <div className={ETIQUETA}>Cambios y eventos del cliente</div>
      {filas === undefined ? (
        <p className="text-[12px] text-brand-ink/40 mt-2">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-[12px] text-brand-ink/45 mt-2">Sin cambios registrados todavía.</p>
      ) : (
        <ul className="mt-2 divide-y divide-white/70">
          {filas.map((r) => {
            const campos = Array.isArray(r.metadata?.fields) ? (r.metadata.fields as string[]).map((k) => CAMPO[k] ?? k) : [];
            return (
              <li key={r.id} className="py-2 text-[12px] text-brand-ink/65 flex flex-wrap gap-x-2">
                <span className="font-semibold text-brand-ink">{r.user?.name ?? 'Sistema'}</span>
                <span>
                  {ACCION[r.action] ?? legible(r.action)}
                  {campos.length ? `: ${campos.join(', ')}` : ''}
                </span>
                <span className="text-brand-ink/35 ml-auto tabular-nums">
                  {new Date(r.createdAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
