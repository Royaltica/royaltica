import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BadgeCheck,
  Bell,
  Building2,
  Check,
  CreditCard,
  Crown,
  Database,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { SPRING, SPRING_SUAVE, Stepper } from './campanasUi.tsx';
import { PanelSub, Subpestanas, useConfirmar } from './vidrio.tsx';
import { BTN_PRI, BTN_SEC, CONTROL, ETIQUETA, Ventana, useAviso } from './clientes.tsx';
import { useCobranza, type CuentaViva } from './store.tsx';
import { useAlertas, type Alerta } from './alertas.tsx';
import { ModoEnvio } from './WhatsappPanel.tsx';
import { EJEMPLO_VARS, tipoDeudor } from './catalogoDeudores.ts';

// Configuración de Cobranza IA (solo Administrador). Por ahora es diseño con
// datos de ejemplo: se guarda en este navegador hasta conectar el backend.

// ── Estado guardado en el navegador ───────────────────────────────────

function useGuardado<T>(clave: string, inicial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const llave = `royaltica.cobranza.config.${clave}`;
  const [v, setV] = React.useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(llave);
      return raw ? (JSON.parse(raw) as T) : inicial;
    } catch {
      return inicial;
    }
  });
  React.useEffect(() => {
    try {
      window.localStorage.setItem(llave, JSON.stringify(v));
    } catch {
      /* sin almacenamiento */
    }
  }, [llave, v]);
  return [v, setV];
}

// ── Plan (ejemplo: 1 administrador + 2 supervisores, y agentes aparte) ──

const PLAN = { nombre: 'Plan Esencial', supervisores: 2, agentes: 5, mensajes: 3000 };

type Rol = 'admin' | 'supervisor' | 'agente';
type Persona = { id: string; nombre: string; correo: string; rol: Rol; estado: 'activo' | 'invitado'; ultimo?: string };

const NOMBRE_ROL: Record<Rol, string> = { admin: 'Administrador', supervisor: 'Supervisor', agente: 'Agente' };
const COLOR_ROL: Record<Rol, string> = {
  admin: 'bg-brand-ink text-white',
  supervisor: 'bg-violet-500/12 text-violet-700',
  agente: 'bg-cyan-500/12 text-cyan-800',
};

function equipoInicial(cartera: CuentaViva[]): Persona[] {
  const agentes = [...new Set(cartera.map((c) => c.agente as string))].filter((a) => a && a !== 'Sin asignar');
  const correo = (n: string) => `${n.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@tuempresa.mx`;
  return [
    { id: 'yo', nombre: 'Tú', correo: 'admin@tuempresa.mx', rol: 'admin', estado: 'activo', ultimo: 'Ahora' },
    { id: 'sup-1', nombre: 'Laura Méndez', correo: 'laura@tuempresa.mx', rol: 'supervisor', estado: 'activo', ultimo: 'Hoy 9:12' },
    { id: 'sup-2', nombre: 'Jorge Castañeda', correo: 'jorge@tuempresa.mx', rol: 'supervisor', estado: 'invitado' },
    ...agentes.map((n, i) => ({ id: `ag-${i}`, nombre: n, correo: correo(n), rol: 'agente' as const, estado: 'activo' as const, ultimo: ['Hoy 10:40', 'Ayer', 'Hoy 8:05'][i % 3] })),
  ];
}

// ── Panel ─────────────────────────────────────────────────────────────

type Parte = 'equipo' | 'alertas' | 'reglas' | 'empresa' | 'canales' | 'plan';

export function ConfiguracionPanel() {
  const [parte, setParte] = React.useState<Parte>('equipo');
  return (
    <div className="space-y-5">
      <Subpestanas
        grupo="configuracion"
        etiqueta="Partes de la configuración"
        valor={parte}
        onChange={setParte}
        opciones={[
          { id: 'equipo', nombre: 'Equipo y accesos', icono: <Users size={13} /> },
          { id: 'alertas', nombre: 'Alertas al celular', icono: <Smartphone size={13} /> },
          { id: 'reglas', nombre: 'Reglas de cobranza', icono: <Workflow size={13} /> },
          { id: 'empresa', nombre: 'Tu empresa', icono: <Building2 size={13} /> },
          { id: 'canales', nombre: 'Canales', icono: <MessageCircle size={13} /> },
          { id: 'plan', nombre: 'Plan y uso', icono: <Crown size={13} /> },
        ]}
      />
      <PanelSub id={parte}>
        {parte === 'equipo' && <Equipo />}
        {parte === 'alertas' && <AlertasCelular />}
        {parte === 'reglas' && <Reglas />}
        {parte === 'empresa' && <Empresa />}
        {parte === 'canales' && <Canales />}
        {parte === 'plan' && <PlanUso irA={setParte} />}
      </PanelSub>
    </div>
  );
}

// ── Piezas ────────────────────────────────────────────────────────────

function Tarjeta({ titulo, detalle, children, accion, className = '' }: { titulo: string; detalle?: string; children: React.ReactNode; accion?: React.ReactNode; className?: string }) {
  return (
    <section className={`glass rounded-[28px] p-6 ${className}`}>
      <div className="flex flex-wrap items-start gap-3 mb-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold text-brand-ink">{titulo}</h3>
          {detalle && <p className="text-[12.5px] text-brand-ink/50 mt-0.5 max-w-[64ch] leading-relaxed">{detalle}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Interruptor({ activo, onChange, etiqueta }: { activo: boolean; onChange: (v: boolean) => void; etiqueta: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onChange(!activo)}
      className={`relative w-11 h-6 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${activo ? 'bg-brand-ink' : 'bg-brand-ink/15'}`}
    >
      <motion.span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow" animate={{ x: activo ? 20 : 0 }} transition={SPRING} />
    </button>
  );
}

function Fila({ icono, titulo, detalle, children }: { icono?: React.ReactNode; titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-3.5 border-b border-brand-ink/[0.06] last:border-0">
      {icono && <span className="w-9 h-9 shrink-0 rounded-xl bg-brand-ink/[0.05] text-brand-ink/55 flex items-center justify-center">{icono}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-brand-ink">{titulo}</div>
        {detalle && <div className="text-[12px] text-brand-ink/50 leading-snug">{detalle}</div>}
      </div>
      {children}
    </div>
  );
}

function Medidor({ usados, total, etiqueta, detalle }: { usados: number; total: number; etiqueta: string; detalle?: string }) {
  const pct = Math.min(100, Math.round((usados / Math.max(1, total)) * 100));
  const lleno = usados >= total;
  return (
    <div className="rounded-[22px] bg-white/60 ring-1 ring-brand-ink/[0.06] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-brand-ink">{etiqueta}</span>
        <span className={`text-[13px] font-semibold tabular-nums ${lleno ? 'text-amber-700' : 'text-brand-ink'}`}>
          {usados} de {total}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-brand-ink/[0.07] overflow-hidden">
        <motion.div className={`h-full rounded-full ${lleno ? 'bg-amber-500' : 'bg-gradient-to-r from-brand-gold to-cyan-300'}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={SPRING_SUAVE} />
      </div>
      {detalle && <div className="text-[11px] text-brand-ink/45 mt-1.5">{detalle}</div>}
    </div>
  );
}

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

// ══ 1 · Equipo y accesos ══════════════════════════════════════════════

function Equipo() {
  const reduce = useReducedMotion();
  const { cartera, reasignar } = useCobranza();
  const [equipo, setEquipo] = useGuardado<Persona[]>('equipo', equipoInicial(cartera));
  const [invitar, setInvitar] = React.useState<Rol | null>(null);
  const [quitar, setQuitar] = React.useState<Persona | null>(null);
  const [rolEditando, setRolEditando] = React.useState<string | null>(null);
  const { confirmar, nodo } = useConfirmar();
  const { avisar, nodo: nodoAviso } = useAviso();
  const [seguridad, setSeguridad] = useGuardado('seguridad', { dosPasos: true, inactividad: true });

  const sups = equipo.filter((p) => p.rol === 'supervisor').length;
  const ags = equipo.filter((p) => p.rol === 'agente').length;
  const hayLugar = (r: Rol) => (r === 'supervisor' ? sups < PLAN.supervisores : r === 'agente' ? ags < PLAN.agentes : false);
  const clientesDe = (p: Persona) => cartera.filter((c) => c.agente === p.nombre).length;

  const cambiarRol = (p: Persona, r: Rol) => {
    setRolEditando(null);
    if (r === p.rol) return;
    if (!hayLugar(r)) return avisar(`Ya no hay lugar para otro ${NOMBRE_ROL[r].toLowerCase()} en tu plan.`, { error: true });
    confirmar({
      titulo: `¿Hacer ${NOMBRE_ROL[r].toLowerCase()} a ${p.nombre}?`,
      mensaje: r === 'supervisor' ? 'Podrá ver toda la cartera y el desempeño del equipo, pero no invitar ni quitar usuarios.' : 'Solo verá sus cuentas asignadas.',
      accion: 'Cambiar rol',
      alConfirmar: () => {
        setEquipo((e) => e.map((x) => (x.id === p.id ? { ...x, rol: r } : x)));
        avisar(`${p.nombre} ahora es ${NOMBRE_ROL[r].toLowerCase()}`);
      },
    });
  };

  const grupos: { rol: Rol; titulo: string; lugar?: string }[] = [
    { rol: 'admin', titulo: 'Administrador' },
    { rol: 'supervisor', titulo: 'Supervisores', lugar: `${sups} de ${PLAN.supervisores}` },
    { rol: 'agente', titulo: 'Agentes', lugar: `${ags} de ${PLAN.agentes}` },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <Tarjeta
        titulo="Tu equipo"
        detalle="Solo tú, como administrador, puedes invitar, cambiar el rol o quitar el acceso a alguien."
        accion={
          <button type="button" onClick={() => setInvitar(hayLugar('agente') ? 'agente' : 'supervisor')} className={BTN_PRI}>
            <UserPlus size={14} /> Invitar
          </button>
        }
      >
        <div className="space-y-6">
          {grupos.map((g) => {
            const gente = equipo.filter((p) => p.rol === g.rol);
            return (
              <div key={g.rol}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/40">{g.titulo}</span>
                  {g.lugar && <span className="text-[11px] tabular-nums text-brand-ink/35">· {g.lugar}</span>}
                  {g.rol !== 'admin' && hayLugar(g.rol) && (
                    <button type="button" onClick={() => setInvitar(g.rol)} className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-cyan-700 hover:text-cyan-900">
                      <Plus size={12} /> Agregar {NOMBRE_ROL[g.rol].toLowerCase()}
                    </button>
                  )}
                  {g.rol !== 'admin' && !hayLugar(g.rol) && (
                    <span className="ml-auto text-[11.5px] font-semibold text-amber-700">Sin lugares en tu plan</span>
                  )}
                </div>
                <ul className="rounded-[22px] bg-white/45 ring-1 ring-brand-ink/[0.05] divide-y divide-brand-ink/[0.05] overflow-hidden">
                  <AnimatePresence initial={false}>
                    {gente.map((p) => (
                      <motion.li
                        key={p.id}
                        layout={!reduce}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex flex-wrap items-center gap-3 px-4 py-3"
                      >
                        <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-[12.5px] font-bold ${p.estado === 'invitado' ? 'bg-white ring-1 ring-dashed ring-brand-ink/20 text-brand-ink/40' : 'bg-gradient-to-br from-[rgb(var(--acento)/0.25)] to-[rgb(var(--acento)/0.08)] text-brand-ink/75'}`}>
                          {p.id === 'yo' ? <Crown size={15} /> : iniciales(p.nombre)}
                        </span>
                        <div className="min-w-[10rem] flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-brand-ink">{p.nombre}</span>
                            {p.estado === 'invitado' && <span className="rounded-full bg-amber-500/12 text-amber-800 px-2 py-0.5 text-[10.5px] font-semibold">Invitación pendiente</span>}
                          </div>
                          <div className="text-[12px] text-brand-ink/45 truncate">
                            {p.correo}
                            {p.ultimo && ` · último acceso ${p.ultimo}`}
                            {p.rol === 'agente' && ` · ${clientesDe(p)} clientes`}
                          </div>
                        </div>
                        {p.rol === 'admin' ? (
                          <span className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${COLOR_ROL.admin}`}>Administrador</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {rolEditando === p.id ? (
                              <select
                                autoFocus
                                value={p.rol}
                                onBlur={() => setRolEditando(null)}
                                onChange={(e) => cambiarRol(p, e.target.value as Rol)}
                                className="glass-campo rounded-full px-3 py-1.5 text-[12px] font-semibold outline-none"
                              >
                                <option value="supervisor">Supervisor</option>
                                <option value="agente">Agente</option>
                              </select>
                            ) : (
                              <button type="button" onClick={() => setRolEditando(p.id)} title="Cambiar rol" className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold ${COLOR_ROL[p.rol]}`}>
                                {NOMBRE_ROL[p.rol]} <Pencil size={10} className="opacity-60" />
                              </button>
                            )}
                            {p.estado === 'invitado' && (
                              <button type="button" onClick={() => avisar(`Invitación reenviada a ${p.correo}`)} title="Reenviar invitación" className="w-8 h-8 rounded-full flex items-center justify-center text-brand-ink/45 hover:bg-white hover:text-brand-ink">
                                <RefreshCw size={14} />
                              </button>
                            )}
                            <button type="button" onClick={() => setQuitar(p)} title="Quitar acceso" className="w-8 h-8 rounded-full flex items-center justify-center text-brand-ink/40 hover:bg-rose-500/10 hover:text-rose-600">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {!gente.length && <li className="px-4 py-4 text-[12.5px] text-brand-ink/45">Nadie con este rol todavía.</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Tarjeta>

      <div className="space-y-5">
        <Tarjeta titulo="Lugares de tu plan" detalle={PLAN.nombre}>
          <div className="space-y-2.5">
            <Medidor usados={1 + sups} total={1 + PLAN.supervisores} etiqueta="Usuarios" detalle="1 administrador y 2 supervisores" />
            <Medidor usados={ags} total={PLAN.agentes} etiqueta="Agentes" />
          </div>
          {(!hayLugar('supervisor') || !hayLugar('agente')) && (
            <button type="button" onClick={() => avisar('Te contactaremos para ampliar tu plan.')} className={BTN_SEC + ' mt-4 w-full justify-center !py-2.5'}>
              <Sparkles size={13} /> Necesito más lugares
            </button>
          )}
        </Tarjeta>

        <Tarjeta titulo="Qué puede hacer cada rol">
          <MatrizRoles />
        </Tarjeta>

        <Tarjeta titulo="Seguridad">
          <Fila icono={<ShieldCheck size={16} />} titulo="Verificación en dos pasos" detalle="Obligatoria para todo el equipo.">
            <Interruptor activo={seguridad.dosPasos} onChange={(v) => setSeguridad((s) => ({ ...s, dosPasos: v }))} etiqueta="Verificación en dos pasos" />
          </Fila>
          <Fila icono={<Lock size={16} />} titulo="Cerrar sesión tras 20 min" detalle="Si nadie usa la plataforma.">
            <Interruptor activo={seguridad.inactividad} onChange={(v) => setSeguridad((s) => ({ ...s, inactividad: v }))} etiqueta="Cerrar sesión por inactividad" />
          </Fila>
        </Tarjeta>
      </div>

      {invitar && (
        <InvitarVentana
          inicial={invitar}
          hayLugar={hayLugar}
          onCerrar={() => setInvitar(null)}
          onInvitar={(p) => {
            setEquipo((e) => [...e, p]);
            setInvitar(null);
            avisar(`Invitación enviada a ${p.correo}`);
          }}
        />
      )}
      {quitar && (
        <QuitarVentana
          persona={quitar}
          clientes={cartera.filter((c) => c.agente === quitar.nombre)}
          otros={equipo.filter((p) => p.rol === 'agente' && p.id !== quitar.id && p.estado === 'activo')}
          onCerrar={() => setQuitar(null)}
          onQuitar={(destino) => {
            if (destino) cartera.filter((c) => c.agente === quitar.nombre).forEach((c) => reasignar(c.id, destino as CuentaViva['agente']));
            setEquipo((e) => e.filter((x) => x.id !== quitar.id));
            avisar(`${quitar.nombre} ya no tiene acceso${destino ? `; sus clientes pasaron a ${destino}` : ''}`);
            setQuitar(null);
          }}
        />
      )}
      {nodo}
      {nodoAviso}
    </div>
  );
}

function MatrizRoles() {
  const filas: [string, boolean, boolean, boolean][] = [
    ['Ver toda la cartera', true, true, false],
    ['Mandar y aprobar mensajes', true, true, true],
    ['Lanzar campañas', true, true, false],
    ['Reasignar clientes', true, true, false],
    ['Cambiar reglas y plantillas', true, false, false],
    ['Invitar o quitar usuarios', true, false, false],
  ];
  return (
    <div className="text-[12px]">
      <div className="grid grid-cols-[1fr_repeat(3,44px)] gap-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-brand-ink/40 text-center">
        <span />
        <span>Adm</span>
        <span>Sup</span>
        <span>Ag</span>
      </div>
      {filas.map(([t, ...v]) => (
        <div key={t} className="grid grid-cols-[1fr_repeat(3,44px)] gap-1 items-center py-1.5 border-t border-brand-ink/[0.05]">
          <span className="text-brand-ink/65">{t}</span>
          {v.map((ok, i) => (
            <span key={i} className="flex justify-center">
              {ok ? <Check size={14} className="text-emerald-600" strokeWidth={3} /> : <span className="w-3 h-[2px] rounded-full bg-brand-ink/15" />}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function InvitarVentana({ inicial, hayLugar, onCerrar, onInvitar }: { inicial: Rol; hayLugar: (r: Rol) => boolean; onCerrar: () => void; onInvitar: (p: Persona) => void }) {
  const [rol, setRol] = React.useState<Rol>(inicial);
  const [nombre, setNombre] = React.useState('');
  const [correo, setCorreo] = React.useState('');
  const valido = nombre.trim().length > 1 && /\S+@\S+\.\S+/.test(correo) && hayLugar(rol);
  return (
    <Ventana titulo="Invitar a tu equipo" subtitulo="Le llega un correo para crear su acceso." onCerrar={onCerrar} ancho="max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onInvitar({ id: `p-${Date.now()}`, nombre: nombre.trim(), correo: correo.trim(), rol, estado: 'invitado' });
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rol">
          {(['agente', 'supervisor'] as Rol[]).map((r) => {
            const lleno = !hayLugar(r);
            const on = rol === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={lleno}
                onClick={() => setRol(r)}
                className={`rounded-[18px] px-3.5 py-3 text-left ring-1 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${on ? 'bg-brand-ink text-white ring-brand-ink' : 'bg-white/60 ring-brand-ink/10 hover:bg-white'}`}
              >
                <div className="text-[13px] font-semibold">{NOMBRE_ROL[r]}</div>
                <div className={`text-[11px] mt-0.5 ${on ? 'text-white/60' : 'text-brand-ink/45'}`}>
                  {lleno ? 'Sin lugares en tu plan' : r === 'agente' ? 'Ve solo sus cuentas' : 'Ve toda la cartera'}
                </div>
              </button>
            );
          })}
        </div>
        <label className="block">
          <span className={ETIQUETA}>Nombre</span>
          <input autoFocus className={CONTROL + ' mt-1.5'} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Sofía Ramírez" />
        </label>
        <label className="block">
          <span className={ETIQUETA}>Correo</span>
          <input type="email" className={CONTROL + ' mt-1.5'} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="sofia@tuempresa.mx" />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-4 !text-[12.5px]'}>
            Cancelar
          </button>
          <button type="submit" disabled={!valido} className={BTN_PRI}>
            <Send size={13} /> Mandar invitación
          </button>
        </div>
      </form>
    </Ventana>
  );
}

function QuitarVentana({
  persona,
  clientes,
  otros,
  onCerrar,
  onQuitar,
}: {
  persona: Persona;
  clientes: CuentaViva[];
  otros: Persona[];
  onCerrar: () => void;
  onQuitar: (destino: string | null) => void;
}) {
  const [destino, setDestino] = React.useState(otros[0]?.nombre ?? '');
  const necesita = clientes.length > 0;
  return (
    <Ventana titulo={`¿Quitar el acceso a ${persona.nombre}?`} subtitulo="Deja de poder entrar en cuanto confirmes." onCerrar={onCerrar} ancho="max-w-md">
      <div className="space-y-4">
        {necesita ? (
          <>
            <p className="text-[13px] text-brand-ink/65 leading-relaxed">
              Lleva <span className="font-semibold text-brand-ink">{clientes.length} clientes</span>. Para que ninguno se quede sin seguimiento, elige quién los toma.
            </p>
            <label className="block">
              <span className={ETIQUETA}>Pasar sus clientes a</span>
              <select className={CONTROL + ' mt-1.5'} value={destino} onChange={(e) => setDestino(e.target.value)}>
                {otros.map((o) => (
                  <option key={o.id}>{o.nombre}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p className="text-[13px] text-brand-ink/65">No tiene clientes asignados.</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-4 !text-[12.5px]'}>
            Volver
          </button>
          <button
            type="button"
            disabled={necesita && !destino}
            onClick={() => onQuitar(necesita ? destino : null)}
            className={BTN_PRI + ' !bg-rose-600 hover:!bg-rose-700 !shadow-[0_10px_30px_-12px_rgba(225,29,72,0.6)]'}
          >
            <Trash2 size={13} /> Quitar acceso
          </button>
        </div>
      </div>
    </Ventana>
  );
}

// ══ 2 · Alertas al celular ════════════════════════════════════════════

type Nivel = 'criticas' | 'altas' | 'todas';
type Destinatario = { id: string; nombre: string; puesto: string; telefono: string; nivel: Nivel; modo: 'momento' | 'resumen'; activo: boolean; verificado: boolean };

const NIVELES: { id: Nivel; nombre: string; detalle: string }[] = [
  { id: 'criticas', nombre: 'Solo críticas', detalle: 'Lo que hay que atender hoy' },
  { id: 'altas', nombre: 'Críticas y altas', detalle: 'Hoy y esta semana' },
  { id: 'todas', nombre: 'Todas', detalle: 'Incluye las de vigilar' },
];

function AlertasCelular() {
  const { avisar, nodo } = useAviso();
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();
  const { vigentes } = useAlertas();
  const [lista, setLista] = useGuardado<Destinatario[]>('destinatarios', [
    { id: 'd-1', nombre: 'Director general', puesto: 'CEO', telefono: '+52 81 1234 5678', nivel: 'criticas', modo: 'momento', activo: true, verificado: true },
  ]);
  const [noMolestar, setNoMolestar] = useGuardado('noMolestar', true);
  const [resumenHora, setResumenHora] = useGuardado('resumenHora', '08:00');
  const [agregar, setAgregar] = React.useState(false);
  const [elegido, setElegido] = React.useState<string>(lista[0]?.id ?? '');
  const actual = lista.find((d) => d.id === elegido) ?? lista[0];
  const muestra = vigentes.find((a) => a.severidad === 'critica') ?? vigentes[0];
  const cambiar = (id: string, c: Partial<Destinatario>) => setLista((l) => l.map((d) => (d.id === id ? { ...d, ...c } : d)));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
      <div className="space-y-5">
        <Tarjeta
          titulo="Quién recibe las alertas en su WhatsApp"
          detalle="Cada vez que la plataforma detecta una alerta, le llega al celular de estas personas con un botón para verla. Ideal para que dirección tenga control directo."
          accion={
            <button type="button" onClick={() => setAgregar(true)} className={BTN_PRI}>
              <Plus size={14} /> Agregar número
            </button>
          }
        >
          {!lista.length ? (
            <div className="rounded-[22px] border-2 border-dashed border-brand-ink/12 px-6 py-10 text-center">
              <Smartphone size={22} className="mx-auto text-brand-ink/30" />
              <p className="text-[13.5px] font-semibold text-brand-ink mt-3">Nadie recibe alertas todavía</p>
              <p className="text-[12.5px] text-brand-ink/50 mt-1">Agrega el WhatsApp del director para que se entere al momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lista.map((d) => {
                const on = actual?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => setElegido(d.id)}
                    className={`rounded-[22px] p-4 cursor-pointer transition-all ${on ? 'bg-white/90 ring-2 ring-emerald-400/50 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.6)]' : 'bg-white/50 ring-1 ring-brand-ink/[0.06] hover:bg-white/75'} ${d.activo ? '' : 'opacity-60'}`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-11 h-11 shrink-0 rounded-full bg-emerald-500/12 text-emerald-700 flex items-center justify-center">
                        <Phone size={17} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-brand-ink">{d.nombre}</span>
                          <span className="text-[12px] text-brand-ink/45">{d.puesto}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-brand-ink/55 tabular-nums">
                          {d.telefono}
                          {d.verificado && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                              <BadgeCheck size={13} /> verificado
                            </span>
                          )}
                        </div>
                      </div>
                      <Interruptor activo={d.activo} onChange={(v) => cambiar(d.id, { activo: v })} etiqueta={`Alertas para ${d.nombre}`} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmar({
                            titulo: `¿Dejar de mandarle alertas a ${d.nombre}?`,
                            accion: 'Quitar',
                            peligro: true,
                            alConfirmar: () => setLista((l) => l.filter((x) => x.id !== d.id)),
                          });
                        }}
                        aria-label="Quitar número"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-brand-ink/35 hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex rounded-full bg-brand-ink/[0.05] p-0.5">
                        {NIVELES.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            title={n.detalle}
                            onClick={() => cambiar(d.id, { nivel: n.id })}
                            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${d.nivel === n.id ? 'bg-white text-brand-ink shadow-sm' : 'text-brand-ink/50 hover:text-brand-ink'}`}
                          >
                            {n.nombre}
                          </button>
                        ))}
                      </div>
                      <div className="inline-flex rounded-full bg-brand-ink/[0.05] p-0.5">
                        {(['momento', 'resumen'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => cambiar(d.id, { modo: m })}
                            className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${d.modo === m ? 'bg-white text-brand-ink shadow-sm' : 'text-brand-ink/50 hover:text-brand-ink'}`}
                          >
                            {m === 'momento' ? 'Al momento' : `Resumen ${resumenHora}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Cuándo llegan">
          <Fila icono={<Moon size={16} />} titulo="No molestar de 10 p. m. a 7 a. m." detalle="Las críticas sí llegan; las demás esperan a la mañana.">
            <Interruptor activo={noMolestar} onChange={setNoMolestar} etiqueta="No molestar de noche" />
          </Fila>
          <Fila icono={<Bell size={16} />} titulo="Hora del resumen diario" detalle="Para quien prefiere un solo mensaje al día.">
            <select value={resumenHora} onChange={(e) => setResumenHora(e.target.value)} className="glass-campo rounded-full px-3.5 py-2 text-[12.5px] font-semibold outline-none">
              {['07:00', '08:00', '09:00', '18:00'].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Fila>
        </Tarjeta>
      </div>

      {/* Así le llega */}
      <div className="xl:sticky xl:top-4">
        <TelefonoMuestra alerta={muestra} destinatario={actual} onPrueba={() => avisar(`Mensaje de prueba enviado a ${actual?.telefono ?? 'el número'} (ejemplo)`)} />
      </div>

      {agregar && (
        <AgregarNumero
          onCerrar={() => setAgregar(false)}
          onListo={(d) => {
            setLista((l) => [...l, d]);
            setElegido(d.id);
            setAgregar(false);
            avisar(`${d.nombre} ya recibe alertas en su WhatsApp`);
          }}
        />
      )}
      {nodo}
      {nodoConfirmar}
    </div>
  );
}

function TelefonoMuestra({ alerta, destinatario, onPrueba }: { alerta?: Alerta; destinatario?: Destinatario; onPrueba: () => void }) {
  const reduce = useReducedMotion();
  const etiqueta = alerta?.severidad === 'critica' ? '🔴 Alerta crítica' : alerta?.severidad === 'alta' ? '🟠 Alerta alta' : '🔵 Para vigilar';
  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/40 mb-3">Así le llega</div>
      <div className="relative w-[300px] rounded-[44px] bg-brand-ink p-3 shadow-[0_40px_80px_-30px_rgba(17,24,39,0.7)]">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 rounded-b-2xl bg-brand-ink z-10" />
        <div className="rounded-[34px] overflow-hidden bg-[#ECE5DD]">
          <div className="flex items-center gap-2.5 bg-[#075E54] text-white px-4 pt-8 pb-3">
            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">R</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-tight">ROYALTICA Alertas</div>
              <div className="text-[10.5px] text-white/70">Cuenta de empresa</div>
            </div>
          </div>
          <div className="px-3 py-4 min-h-[330px] space-y-2">
            <div className="flex justify-center">
              <span className="rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-brand-ink/55">HOY</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={(alerta?.id ?? 'nada') + (destinatario?.id ?? '')}
                initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={SPRING}
                className="max-w-[92%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm"
              >
                <div className="text-[12px] font-bold text-brand-ink">{alerta ? etiqueta : '✅ Todo en orden'}</div>
                <p className="text-[12px] leading-snug text-brand-ink/85 mt-1">{alerta ? alerta.titulo : 'Hoy no hay alertas. Te avisamos en cuanto haya algo.'}</p>
                {alerta && alerta.monto > 0 && (
                  <p className="text-[11.5px] text-brand-ink/60 mt-1">En juego: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(alerta.monto)}</p>
                )}
                <div className="text-[9.5px] text-brand-ink/40 text-right mt-1">9:41</div>
              </motion.div>
            </AnimatePresence>
            {alerta && (
              <div className="max-w-[92%] grid grid-cols-2 gap-1">
                <span className="rounded-lg bg-white text-center py-2 text-[11.5px] font-semibold text-[#128C7E] shadow-sm">Ver alerta</span>
                <span className="rounded-lg bg-white text-center py-2 text-[11.5px] font-semibold text-[#128C7E] shadow-sm">Ya lo atiendo</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-[11.5px] text-brand-ink/45 mt-4 text-center max-w-[30ch]">
        {destinatario ? `Para ${destinatario.nombre} · ${NIVELES.find((n) => n.id === destinatario.nivel)?.nombre.toLowerCase()}` : 'Agrega un número para ver cómo le llega'}
      </p>
      {destinatario && (
        <button type="button" onClick={onPrueba} className={BTN_SEC + ' mt-3'}>
          <Send size={12} /> Mandar prueba
        </button>
      )}
    </div>
  );
}

function AgregarNumero({ onCerrar, onListo }: { onCerrar: () => void; onListo: (d: Destinatario) => void }) {
  const [paso, setPaso] = React.useState<'datos' | 'codigo'>('datos');
  const [nombre, setNombre] = React.useState('');
  const [puesto, setPuesto] = React.useState('');
  const [tel, setTel] = React.useState('');
  const [nivel, setNivel] = React.useState<Nivel>('criticas');
  const [codigo, setCodigo] = React.useState('');
  const digitos = tel.replace(/\D/g, '');
  const telValido = digitos.length >= 10;
  const formato = digitos.length === 10 ? `+52 ${digitos.slice(0, 2)} ${digitos.slice(2, 6)} ${digitos.slice(6)}` : tel;
  return (
    <Ventana titulo={paso === 'datos' ? 'Agregar un número' : 'Confirma el número'} subtitulo={paso === 'datos' ? 'Le llegarán las alertas por WhatsApp.' : `Mandamos un código de 6 dígitos al ${formato}.`} onCerrar={onCerrar} ancho="max-w-md">
      <AnimatePresence mode="wait" initial={false}>
        {paso === 'datos' ? (
          <motion.form
            key="datos"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim() && telValido) setPaso('codigo');
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={ETIQUETA}>Nombre</span>
                <input autoFocus className={CONTROL + ' mt-1.5'} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Roberto Garza" />
              </label>
              <label className="block">
                <span className={ETIQUETA}>Puesto</span>
                <input className={CONTROL + ' mt-1.5'} value={puesto} onChange={(e) => setPuesto(e.target.value)} placeholder="Director general" />
              </label>
            </div>
            <label className="block">
              <span className={ETIQUETA}>WhatsApp</span>
              <input inputMode="tel" className={CONTROL + ' mt-1.5 tabular-nums'} value={tel} onChange={(e) => setTel(e.target.value)} placeholder="81 1234 5678" />
            </label>
            <div>
              <span className={ETIQUETA}>Qué le llega</span>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {NIVELES.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNivel(n.id)}
                    className={`rounded-[16px] px-2.5 py-2.5 text-left ring-1 transition-colors ${nivel === n.id ? 'bg-brand-ink text-white ring-brand-ink' : 'bg-white/60 ring-brand-ink/10 hover:bg-white'}`}
                  >
                    <div className="text-[12px] font-semibold leading-tight">{n.nombre}</div>
                    <div className={`text-[10.5px] mt-0.5 ${nivel === n.id ? 'text-white/60' : 'text-brand-ink/45'}`}>{n.detalle}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCerrar} className={BTN_SEC + ' !py-2.5 !px-4 !text-[12.5px]'}>
                Cancelar
              </button>
              <button type="submit" disabled={!nombre.trim() || !telValido} className={BTN_PRI}>
                Enviar código <Send size={13} />
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="codigo"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (codigo.length === 6)
                onListo({ id: `d-${Date.now()}`, nombre: nombre.trim(), puesto: puesto.trim() || 'Dirección', telefono: formato, nivel, modo: 'momento', activo: true, verificado: true });
            }}
            className="space-y-4"
          >
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className={CONTROL + ' text-center !text-[26px] tracking-[0.5em] font-semibold tabular-nums'}
            />
            <p className="text-[11.5px] text-brand-ink/45 text-center">Ejemplo: escribe cualquier código de 6 dígitos.</p>
            <div className="flex justify-between gap-2 pt-1">
              <button type="button" onClick={() => setPaso('datos')} className={BTN_SEC + ' !py-2.5 !px-4 !text-[12.5px]'}>
                Cambiar número
              </button>
              <button type="submit" disabled={codigo.length !== 6} className={BTN_PRI}>
                <Check size={13} /> Confirmar
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Ventana>
  );
}

// ══ 3 · Reglas de cobranza ════════════════════════════════════════════

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function Reglas() {
  const { avisar, nodo } = useAviso();
  const [r, setR] = useGuardado('reglas', {
    hora: '11:00',
    dias: [true, true, true, true, true, false, false],
    festivos: true,
    maxSemana: 3,
    descuentoMax: 10,
    parcialidades: true,
    prorroga: true,
    aprueba: 'supervisor' as 'admin' | 'supervisor',
  });
  const cambiar = (c: Partial<typeof r>) => setR((x) => ({ ...x, ...c }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Tarjeta titulo="Cuándo se manda" detalle="Aplica a los recordatorios del plan y a las campañas.">
        <div className="mb-4">
          <ModoEnvio />
        </div>
        <Fila titulo="Hora de envío" detalle="Cuando salen los mensajes automáticos del día.">
          <select value={r.hora} onChange={(e) => cambiar({ hora: e.target.value })} className="glass-campo rounded-full px-3.5 py-2 text-[12.5px] font-semibold outline-none">
            {['09:00', '10:00', '11:00', '12:00', '13:00', '16:00'].map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </Fila>
        <Fila titulo="Días con mensajes">
          <div className="flex gap-1">
            {DIAS.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={r.dias[i]}
                onClick={() => cambiar({ dias: r.dias.map((x, j) => (j === i ? !x : x)) })}
                className={`w-8 h-8 rounded-full text-[12px] font-semibold transition-colors ${r.dias[i] ? 'bg-brand-ink text-white' : 'bg-brand-ink/[0.05] text-brand-ink/40 hover:text-brand-ink'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </Fila>
        <Fila titulo="Respetar días festivos" detalle="No se manda nada en días de descanso oficial.">
          <Interruptor activo={r.festivos} onChange={(v) => cambiar({ festivos: v })} etiqueta="Respetar días festivos" />
        </Fila>
        <Fila titulo="Máximo de mensajes por semana" detalle="A un mismo cliente, sumando plan y campañas.">
          <Stepper valor={r.maxSemana} min={1} max={7} sufijo="por semana" onChange={(v) => cambiar({ maxSemana: v })} />
        </Fila>
      </Tarjeta>

      <Tarjeta titulo="Lo que se puede ofrecer" detalle="Límites para las respuestas de la IA y las campañas. Nada se ofrece fuera de esto.">
        <Fila titulo="Descuento máximo">
          <Stepper valor={r.descuentoMax} min={0} max={30} paso={5} sufijo="% como máximo" onChange={(v) => cambiar({ descuentoMax: v })} />
        </Fila>
        <Fila titulo="Pagos en parcialidades" detalle="La IA puede proponer dividir el pago.">
          <Interruptor activo={r.parcialidades} onChange={(v) => cambiar({ parcialidades: v })} etiqueta="Parcialidades" />
        </Fila>
        <Fila titulo="Prórroga con fecha" detalle="Mover la fecha de pago con un compromiso.">
          <Interruptor activo={r.prorroga} onChange={(v) => cambiar({ prorroga: v })} etiqueta="Prórroga" />
        </Fila>
        <Fila titulo="Quién aprueba los mensajes de la IA">
          <div className="inline-flex rounded-full bg-brand-ink/[0.05] p-0.5">
            {(['admin', 'supervisor'] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => cambiar({ aprueba: a })}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold ${r.aprueba === a ? 'bg-white text-brand-ink shadow-sm' : 'text-brand-ink/50'}`}
              >
                {a === 'admin' ? 'Solo yo' : 'Supervisores y yo'}
              </button>
            ))}
          </div>
        </Fila>
        <button type="button" onClick={() => avisar('Reglas guardadas')} className={BTN_PRI + ' mt-4'}>
          <Check size={13} /> Guardar reglas
        </button>
      </Tarjeta>
      {nodo}
    </div>
  );
}

// ══ 4 · Tu empresa en los mensajes ════════════════════════════════════

function Empresa() {
  const { avisar, nodo } = useAviso();
  const [e, setE] = useGuardado('empresa', {
    empresa: '',
    telefono_oficial: '',
    banco: '',
    clabe: '',
    liga: '',
    correo: '',
    firma: 'Equipo de Cobranza',
  });
  const campos: { k: keyof typeof e; t: string; ph: string; ayuda?: string }[] = [
    { k: 'empresa', t: 'Nombre comercial', ph: 'Grupo Náutica del Pacífico', ayuda: 'Así te presentas en cada mensaje' },
    { k: 'telefono_oficial', t: 'Teléfono oficial', ph: '55 1234 5678', ayuda: 'Para que el cliente confirme que no es fraude' },
    { k: 'banco', t: 'Banco', ph: 'BBVA' },
    { k: 'clabe', t: 'CLABE', ph: '0123 4567 8901 2345 67' },
    { k: 'liga', t: 'Liga de pago', ph: 'pago.tuempresa.mx' },
    { k: 'correo', t: 'Correo para respuestas', ph: 'cobranza@tuempresa.mx' },
  ];
  const plantilla = tipoDeudor('olvidadizo-b2c')?.pla.hoy ?? 'Hola {{contacto}}, de parte de {{empresa}}: hoy vence tu factura {{folio}} por {{monto}}. Págala aquí: {{liga}}';
  const valores: Record<string, string> = { ...EJEMPLO_VARS, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v)) };
  const completos = campos.filter((c) => e[c.k]).length;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
      <Tarjeta titulo="Datos que se llenan solos en los mensajes" detalle="Los capturas una vez y aparecen en todas las plantillas, campañas y respuestas de la IA.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campos.map((c) => (
            <label key={c.k} className="block">
              <span className={ETIQUETA}>{c.t}</span>
              <input className={CONTROL + ' mt-1.5'} value={e[c.k]} placeholder={c.ph} onChange={(ev) => setE((x) => ({ ...x, [c.k]: ev.target.value }))} />
              {c.ayuda && <span className="block text-[11px] text-brand-ink/40 mt-1">{c.ayuda}</span>}
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className={ETIQUETA}>Firma de correo</span>
            <textarea rows={2} className={CONTROL + ' mt-1.5 resize-none'} value={e.firma} onChange={(ev) => setE((x) => ({ ...x, firma: ev.target.value }))} />
          </label>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={() => avisar('Datos guardados')} className={BTN_PRI}>
            <Check size={13} /> Guardar
          </button>
          <span className="text-[12px] text-brand-ink/45">
            {completos} de {campos.length} completos
          </span>
        </div>
      </Tarjeta>
      <div className="xl:sticky xl:top-4 glass rounded-[28px] p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/40">Vista previa</div>
        <p className="text-[12px] text-brand-ink/50 mt-1">Mensaje del día de vencimiento, con tus datos.</p>
        <div className="mt-4 rounded-[20px] rounded-tl-md bg-white ring-1 ring-brand-ink/[0.06] px-4 py-3 text-[13px] leading-relaxed text-brand-ink/80">
          {plantilla.split(/(\{\{\w+\}\})/g).map((p, i) => {
            const m = /^\{\{(\w+)\}\}$/.exec(p);
            if (!m) return <React.Fragment key={i}>{p}</React.Fragment>;
            const propio = !!(e as Record<string, string>)[m[1]];
            return (
              <span key={i} className={`rounded px-1 font-semibold ${propio ? 'bg-emerald-500/12 text-emerald-800' : 'bg-cyan-500/12 text-cyan-800'}`}>
                {valores[m[1]] ?? m[1]}
              </span>
            );
          })}
        </div>
        <p className="text-[11px] text-brand-ink/40 mt-3">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> tus datos · <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mx-1" /> datos de cada cliente
        </p>
      </div>
      {nodo}
    </div>
  );
}

// ══ 5 · Canales y conexiones ══════════════════════════════════════════

function Canales() {
  const { avisar, nodo } = useAviso();
  const { envioAutomatico } = useCobranza();
  const canales = [
    { Icono: MessageCircle, nombre: 'WhatsApp Business', detalle: 'Número de cobranza +52 81 5555 0101', estado: 'ok', texto: 'Conectado con Meta', color: 'bg-emerald-500/12 text-emerald-700' },
    { Icono: Mail, nombre: 'Correo', detalle: 'Sale desde cobranza@tuempresa.mx', estado: 'ok', texto: 'Funcionando', color: 'bg-sky-500/12 text-sky-700' },
    { Icono: Database, nombre: 'ERP · Odoo', detalle: 'Facturas y pagos se sincronizan cada mañana', estado: 'ok', texto: 'Sincronizado hoy 06:00', color: 'bg-violet-500/12 text-violet-700' },
    { Icono: Wallet, nombre: 'Banco · conciliación', detalle: 'Detecta pagos por SPEI', estado: 'falta', texto: 'Sin conectar', color: 'bg-amber-500/12 text-amber-800' },
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {canales.map((c, i) => (
          <motion.div key={c.nombre} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_SUAVE, delay: i * 0.05 }} className="glass rounded-[26px] p-5 flex items-start gap-4">
            <span className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${c.color}`}>
              <c.Icono size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-brand-ink">{c.nombre}</div>
              <div className="text-[12.5px] text-brand-ink/50 mt-0.5">{c.detalle}</div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.estado === 'ok' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/12 text-amber-800'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.estado === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {c.texto}
                </span>
                <button type="button" onClick={() => avisar(c.estado === 'ok' ? `${c.nombre}: todo en orden` : 'Te ayudamos a conectarlo en tu onboarding')} className="ml-auto text-[12px] font-semibold text-brand-ink/55 hover:text-brand-ink">
                  {c.estado === 'ok' ? 'Revisar' : 'Conectar'} →
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <p className="text-[12px] text-brand-ink/45 px-1">
        Los recordatorios salen {envioAutomatico ? 'solos a la hora configurada' : 'cuando los apruebas'}. Puedes cambiarlo en Reglas de cobranza.
      </p>
      {nodo}
    </div>
  );
}

// ══ 6 · Plan y uso ════════════════════════════════════════════════════

function PlanUso({ irA }: { irA: (p: Parte) => void }) {
  const { avisar, nodo } = useAviso();
  const { cartera, tiposDeudor } = useCobranza();
  const [equipo] = useGuardado<Persona[]>('equipo', equipoInicial(cartera));
  const sups = equipo.filter((p) => p.rol === 'supervisor').length;
  const ags = equipo.filter((p) => p.rol === 'agente').length;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <section className="glass relative overflow-hidden rounded-[28px] p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-brand-gold/20 blur-[80px]" />
        <div className="relative flex flex-wrap items-start gap-4">
          <span className="w-14 h-14 rounded-[20px] bg-brand-ink text-brand-gold flex items-center justify-center">
            <Crown size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/45">Tu plan</div>
            <h3 className="text-[26px] text-brand-ink leading-tight">{PLAN.nombre}</h3>
            <p className="text-[13px] text-brand-ink/55 mt-1">1 administrador, {PLAN.supervisores} supervisores y hasta {PLAN.agentes} agentes.</p>
          </div>
          <button type="button" onClick={() => avisar('Te contactaremos para mejorar tu plan')} className={BTN_PRI}>
            <Sparkles size={13} /> Mejorar plan
          </button>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <Medidor usados={1 + sups} total={1 + PLAN.supervisores} etiqueta="Usuarios" />
          <Medidor usados={ags} total={PLAN.agentes} etiqueta="Agentes" />
          <Medidor usados={1240} total={PLAN.mensajes} etiqueta="Mensajes del mes" detalle="Se reinicia el 1 de diciembre" />
        </div>
      </section>
      <div className="glass rounded-[28px] p-5 space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-ink/40">Atajos</div>
        <button type="button" onClick={() => irA('equipo')} className="w-full flex items-center gap-3 rounded-[18px] bg-white/60 ring-1 ring-brand-ink/[0.06] px-4 py-3 text-left hover:bg-white">
          <UserPlus size={16} className="text-brand-ink/50" />
          <span className="text-[13px] font-semibold text-brand-ink">Invitar a alguien</span>
        </button>
        <button type="button" onClick={() => irA('alertas')} className="w-full flex items-center gap-3 rounded-[18px] bg-white/60 ring-1 ring-brand-ink/[0.06] px-4 py-3 text-left hover:bg-white">
          <Smartphone size={16} className="text-brand-ink/50" />
          <span className="text-[13px] font-semibold text-brand-ink">Alertas al celular</span>
        </button>
        <div className="flex items-center gap-3 rounded-[18px] px-4 py-3">
          <CreditCard size={16} className="text-brand-ink/40" />
          <span className="text-[12.5px] text-brand-ink/55">
            {cartera.length} clientes · {tiposDeudor?.activos.length ?? 0} tipos de deudor activos
          </span>
        </div>
      </div>
      {nodo}
    </div>
  );
}

