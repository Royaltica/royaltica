import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BadgeCheck,
  Bell,
  Building2,
  Check,
  Crown,
  Database,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { SPRING, SPRING_SUAVE, Stepper } from './campanasUi.tsx';
import { PanelSub, Subpestanas, useConfirmar } from './vidrio.tsx';
import { BTN_PRI, BTN_SEC, CONTROL, ETIQUETA, Ventana, useAviso } from './clientes.tsx';
import { useCobranza } from './store.tsx';
import { useAlertas, type Alerta } from './alertas.tsx';
import { ModoEnvio } from './WhatsappPanel.tsx';
import { EJEMPLO_VARS, tipoDeudor } from './catalogoDeudores.ts';
import { api, type CollectionStatus, type ShadowReport, type CollectionRulesSettings, type CollectionSecuritySettings, type CollectionLevelPlan } from '../../../../services/apiClient.ts';
import { actualizarEquipo, perfilDeRol, quitarUsuario, useEquipo, type PersonaEquipo, type RolEquipo } from './equipo.ts';
import { diasDePolitica, fechasDePolitica, VIGENCIA_DIAS } from './dias-politica.ts';

// Equipo y reglas usan el backend. Las demás secciones se migran en C2b.

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

type Rol = RolEquipo;
type Persona = PersonaEquipo;
const NOMBRE_ROL: Record<Rol, string> = { admin: 'Administrador', supervisor: 'Supervisor', agente: 'Agente' };

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

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

// ══ 1 · Equipo y accesos ══════════════════════════════════════════════

export function Equipo() {
  const { equipo, error } = useEquipo();
  const { recargarCartera } = useCobranza();
  const { avisar, nodo } = useAviso();
  const [invitar, setInvitar] = React.useState(false);
  const [quitar, setQuitar] = React.useState<Persona | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [seguridad, setSeguridad] = React.useState<CollectionSecuritySettings | null>(null);
  const [errorSeguridad, setErrorSeguridad] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vigente = true;
    api.getSettings().then((s) => { if (vigente) setSeguridad(s.collectionSecurity); })
      .catch(() => { if (vigente) setErrorSeguridad('No se pudo cargar la seguridad. Vuelve a abrir esta pestaña para reintentar.'); });
    return () => { vigente = false; };
  }, []);

  const ejecutar = async (operacion: () => Promise<unknown>, mensaje: string) => {
    setOcupado(true);
    try {
      await operacion();
      actualizarEquipo();
      avisar(mensaje);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar el cambio.', { error: true });
    } finally { setOcupado(false); }
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
      <Tarjeta titulo="Tu equipo" detalle="Los accesos y perfiles se guardan en tu organización. Los límites de licencias se validan al invitar."
        accion={<button type="button" disabled={ocupado || !equipo} onClick={() => setInvitar(true)} className={BTN_PRI}><UserPlus size={14} /> Invitar</button>}>
        {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
        {!equipo && !error && <p role="status">Cargando equipo…</p>}
        {equipo?.length === 0 && <p className="text-[13px] text-brand-ink/55">Sin datos. Todavía no hay usuarios en el equipo.</p>}
        <fieldset disabled={ocupado} className="space-y-3">
          {equipo?.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-[22px] bg-white/60 ring-1 ring-brand-ink/[0.06] px-4 py-3">
              <span className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center text-[12px] font-bold">{iniciales(p.nombre)}</span>
              <div className="flex-1 min-w-40">
                <div className="font-semibold text-[13.5px]">{p.nombre}</div>
                <div className="text-[12px] text-brand-ink/55">{p.correo}</div>
                <div className="text-[11px] text-brand-ink/45">{p.estado === 'invitado' ? 'Invitación pendiente' : p.estado === 'inactivo' ? 'Acceso desactivado' : 'Acceso activo'} · {p.ultimo ? `Último acceso ${p.ultimo}` : 'Sin accesos registrados'}</div>
              </div>
              {p.rol === 'admin' ? <span className="text-[12px] font-semibold">Administrador</span> : (
                <>
                  <select aria-label={`Perfil de ${p.nombre}`} value={p.rol} className={CONTROL + ' !w-auto !py-2'}
                    onChange={(e) => void ejecutar(() => api.updateUser(p.id, perfilDeRol(e.target.value as Rol)), 'Perfil guardado')}>
                    {p.rol === 'sinPerfil' && <option value="sinPerfil" disabled>Sin perfil</option>}
                    <option value="supervisor">Supervisor</option><option value="agente">Agente</option>
                  </select>
                  <button type="button" className={BTN_SEC} onClick={() => void ejecutar(() => api.setUserStatus(p.id, p.estado === 'inactivo'), 'Estado del acceso guardado')}>
                    {p.estado === 'inactivo' ? 'Activar acceso' : 'Desactivar acceso'}
                  </button>
                  <button type="button" aria-label={`Quitar acceso a ${p.nombre}`} onClick={() => setQuitar(p)} className="w-9 h-9 rounded-full flex items-center justify-center text-rose-600 hover:bg-rose-500/10"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </fieldset>
      </Tarjeta>
      <div className="space-y-5">
        <Tarjeta titulo="Equipo registrado">
          <p className="text-[13px] text-brand-ink/60">{equipo ? `${equipo.filter((p) => p.rol === 'admin').length} administradores · ${equipo.filter((p) => p.rol === 'supervisor').length} supervisores · ${equipo.filter((p) => p.rol === 'agente').length} agentes` : 'Sin datos'}</p>
        </Tarjeta>
        <Tarjeta titulo="Preferencias de seguridad" detalle="Se guardan para tu organización. No activan por sí solas la verificación en dos pasos ni el cierre automático de sesiones.">
          {errorSeguridad && <p role="alert" className="text-[12px] text-rose-700">{errorSeguridad}</p>}
          {!seguridad && !errorSeguridad && <p role="status">Cargando seguridad…</p>}
          {seguridad && <fieldset disabled={ocupado}>
            <Fila icono={<ShieldCheck size={16} />} titulo="Solicitar verificación en dos pasos" detalle="Cada usuario la activa desde su perfil.">
              <Interruptor activo={seguridad.dosPasos} onChange={(v) => setSeguridad({ ...seguridad, dosPasos: v })} etiqueta="Verificación en dos pasos" />
            </Fila>
            <Fila icono={<Lock size={16} />} titulo="Solicitar cierre tras 20 min" detalle="Preferencia del equipo; su aplicación automática está pendiente.">
              <Interruptor activo={seguridad.inactividad} onChange={(v) => setSeguridad({ ...seguridad, inactividad: v })} etiqueta="Cerrar sesión por inactividad" />
            </Fila>
            <button type="button" className={BTN_PRI + ' mt-4'} onClick={() => void ejecutar(async () => {
              const saved = await api.updateSettings({ collectionSecurity: seguridad });
              setSeguridad(saved.collectionSecurity);
            }, 'Preferencias de seguridad guardadas')}><Check size={13} /> Guardar seguridad</button>
          </fieldset>}
        </Tarjeta>
      </div>
      {invitar && <InvitarVentana onCerrar={() => setInvitar(false)} onInvitar={async (datos) => {
        const result = await api.inviteUser({ name: datos.nombre, email: datos.correo, ...perfilDeRol(datos.rol) });
        actualizarEquipo();
        setInvitar(false);
        avisar(result.emailSent ? 'Invitación creada y correo enviado.' : 'Acceso creado. No se pudo enviar el correo de invitación.', { error: !result.emailSent });
      }} />}
      {quitar && <QuitarVentana persona={quitar} otros={(equipo ?? []).filter((p) => p.rol === 'agente' && p.estado === 'activo' && p.id !== quitar.id)}
        onCerrar={() => setQuitar(null)} onQuitar={async (destino) => {
          await quitarUsuario(quitar.id, destino);
          await recargarCartera();
          setQuitar(null);
          avisar('Acceso eliminado y cartera actualizada.');
        }} />}
      {nodo}
    </div>
  );
}

function InvitarVentana({ onCerrar, onInvitar }: { onCerrar: () => void; onInvitar: (p: { nombre: string; correo: string; rol: Rol }) => Promise<void> }) {
  const [rol, setRol] = React.useState<Rol>('agente');
  const [nombre, setNombre] = React.useState('');
  const [correo, setCorreo] = React.useState('');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const valido = nombre.trim().length > 1 && /\S+@\S+\.\S+/.test(correo);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido || ocupado) return;
    setOcupado(true); setError(null);
    try { await onInvitar({ nombre: nombre.trim(), correo: correo.trim(), rol }); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la invitación.'); }
    finally { setOcupado(false); }
  };
  return <Ventana titulo="Invitar a tu equipo" subtitulo="El acceso se registra al confirmar el servidor." onCerrar={onCerrar} ancho="max-w-md">
    <form onSubmit={enviar} className="space-y-4">
      <fieldset disabled={ocupado} className="space-y-4">
        <label className="block"><span className={ETIQUETA}>Perfil</span><select value={rol} onChange={(e) => setRol(e.target.value as Rol)} className={CONTROL}>{(['admin', 'supervisor', 'agente'] as Rol[]).map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</select></label>
        <label className="block"><span className={ETIQUETA}>Nombre</span><input autoFocus className={CONTROL} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo" maxLength={120} /></label>
        <label className="block"><span className={ETIQUETA}>Correo</span><input type="email" className={CONTROL} value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Correo del usuario" /></label>
        {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onCerrar} className={BTN_SEC}>Cancelar</button><button type="submit" disabled={!valido} className={BTN_PRI}><Send size={13} /> {ocupado ? 'Creando…' : 'Mandar invitación'}</button></div>
      </fieldset>
    </form>
  </Ventana>;
}

function QuitarVentana({ persona, otros, onCerrar, onQuitar }: { persona: Persona; otros: Persona[]; onCerrar: () => void; onQuitar: (destino: string | null) => Promise<void> }) {
  const [clientes, setClientes] = React.useState<number | null>(null);
  const [destino, setDestino] = React.useState(otros[0]?.id ?? '');
  const [ocupado, setOcupado] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let vigente = true;
    api.getPortfolio().then((rows) => { if (vigente) setClientes(rows.filter((c) => c.agent?.id === persona.id).length); })
      .catch(() => { if (vigente) setError('No se pudieron revisar los clientes asignados. Vuelve a abrir esta ventana.'); });
    return () => { vigente = false; };
  }, [persona.id]);
  const quitar = async () => {
    setOcupado(true); setError(null);
    try { await onQuitar(destino || null); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar el acceso.'); }
    finally { setOcupado(false); }
  };
  return <Ventana titulo={`¿Quitar el acceso a ${persona.nombre}?`} subtitulo="Se elimina el acceso cuando el servidor confirma el cambio." onCerrar={onCerrar} ancho="max-w-md">
    <fieldset disabled={ocupado} className="space-y-4">
      <p className="text-[13px]">{clientes === null ? 'Revisando clientes…' : `${clientes} clientes asignados.`}</p>
      {!!clientes && <label className="block"><span className={ETIQUETA}>Pasar sus clientes a</span><select value={destino} onChange={(e) => setDestino(e.target.value)} className={CONTROL}>
        <option value="">Elige un agente activo</option>{otros.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select></label>}
      {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
      <p className="text-[12px] text-brand-ink/55">Primero se reasignan sus clientes. Si falla una reasignación no se elimina el acceso; puedes reintentar.</p>
      <div className="flex justify-end gap-2"><button type="button" onClick={onCerrar} className={BTN_SEC}>Volver</button><button type="button" disabled={clientes === null || (!!clientes && !destino)} onClick={() => void quitar()} className={BTN_PRI + ' !bg-rose-600'}><Trash2 size={13} /> {ocupado ? 'Guardando…' : 'Quitar acceso'}</button></div>
    </fieldset>
  </Ventana>;
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

export function Reglas() {
  const { avisar, nodo } = useAviso();
  const [r, setR] = React.useState<(CollectionRulesSettings & { dias: boolean[]; maxSemana: number }) | null>(null);
  const [politica, setPolitica] = React.useState<Pick<CollectionLevelPlan, 'id' | 'maxContactsPerWeek' | 'blackoutDates' | 'timezone'> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ocupado, setOcupado] = React.useState(false);
  const [carga, setCarga] = React.useState(0);
  const [referencia, setReferencia] = React.useState(() => new Date());
  React.useEffect(() => {
    let vigente = true;
    Promise.all([api.getSettings(), api.getLevelPlan()]).then(([settings, plan]) => {
      if (!vigente) return;
      const hoy = new Date();
      const policy = plan.policy;
      const dias = policy ? diasDePolitica(policy.blackoutDates, policy.timezone, hoy) : Array(7).fill(true) as boolean[];
      setReferencia(hoy);
      setPolitica(policy);
      setR({ ...settings.collectionRules, dias, maxSemana: policy?.maxContactsPerWeek ?? 0 });
      setError(null);
    }).catch(() => { if (vigente) setError('No se pudieron cargar las reglas. No se guardará ningún cambio hasta recuperarlas.'); });
    return () => { vigente = false; };
  }, [carga]);
  if (!r) return <Tarjeta titulo="Reglas de cobranza">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => setCarga((n) => n + 1)} className={BTN_SEC}>Reintentar</button></> : <p role="status">Cargando reglas…</p>}</Tarjeta>;
  const cambiar = (c: Partial<NonNullable<typeof r>>) => setR((x) => x ? { ...x, ...c } : x);
  const guardarReglas = async () => {
    setOcupado(true);
    try {
      const { dias: _dias, maxSemana: _max, ...collectionRules } = r;
      const saved = await api.updateSettings({ collectionRules });
      setR((x) => x ? { ...x, ...saved.collectionRules } : x);
      avisar('Reglas guardadas');
    } catch (e) { avisar(e instanceof Error ? e.message : 'No se pudieron guardar las reglas.', { error: true }); }
    finally { setOcupado(false); }
  };
  const guardarPolitica = async () => {
    if (!politica) return;
    setOcupado(true);
    try {
      if (r.maxSemana < 1) throw new Error('El máximo de mensajes por semana debe ser al menos 1.');
      const blackoutDates = fechasDePolitica(politica.blackoutDates, r.dias, politica.timezone, referencia);
      const saved = await api.updateCollectionPolicy(politica.id, { maxContactsPerWeek: r.maxSemana, blackoutDates });
      setPolitica(saved);
      setR((x) => x ? { ...x, maxSemana: saved.maxContactsPerWeek, dias: diasDePolitica(saved.blackoutDates, saved.timezone, referencia) } : x);
      avisar('Calendario y límite de mensajes guardados');
    } catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo guardar la política.', { error: true }); }
    finally { setOcupado(false); }
  };
  const crearPlan = async () => {
    setOcupado(true);
    try { await api.ensureLevelPlan(); setCarga((n) => n + 1); }
    catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo crear el plan.', { error: true }); }
    finally { setOcupado(false); }
  };
  return (
    <fieldset disabled={ocupado} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* key: si el plan se crea desde "Cuándo se manda", esta tarjeta se recarga;
          alCrearPlan: si el plan se crea al prender el modo sombra, se recarga el calendario. */}
      <SeguridadEnvios key={politica ? politica.id : 'sin-plan'} alCrearPlan={politica ? undefined : () => { setCarga((n) => n + 1); }} />
      <Tarjeta titulo="Cuándo se manda" detalle="Calendario y límite de contactos del plan de cobranza.">
        <div className="mb-4">
          <ModoEnvio />
        </div>
        <Fila titulo="Hora de envío" detalle="Cuando salen los mensajes automáticos del día (hora del centro de México). Se guarda en el servidor.">
          <HoraMotor />
        </Fila>
        {!politica && <div className="mb-4"><p className="text-[13px]">Sin plan de cobranza. Crea uno con aprobación manual para configurar su calendario (empieza con 3 mensajes por semana; ningún mensaje sale sin que alguien lo apruebe).</p><button type="button" onClick={() => void crearPlan()} className={BTN_SEC + ' mt-2'}>Crear plan con aprobación</button></div>}
        {/* Sin plan no hay calendario ni límite que mostrar (antes salía un 0 engañoso). */}
        {politica && <fieldset>
        <Fila titulo="Días con mensajes" detalle={`Al guardar, se registran fechas excluidas para los próximos ${VIGENCIA_DIAS} días. Hay que renovar el calendario antes de que venza. Al habilitar un día antes bloqueado se quitan sus exclusiones dentro del periodo.`}>
          <div className="flex gap-1">
            {DIAS.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Mensajes en ${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'][i]}`}
                aria-pressed={r.dias[i]}
                onClick={() => cambiar({ dias: r.dias.map((x, j) => (j === i ? !x : x)) })}
                className={`w-8 h-8 rounded-full text-[12px] font-semibold transition-colors ${r.dias[i] ? 'bg-brand-ink text-white' : 'bg-brand-ink/[0.05] text-brand-ink/40 hover:text-brand-ink'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </Fila>
        <Fila titulo="Máximo de mensajes por semana" detalle="Tope de contactos de cada secuencia del plan de cobranza.">
          <Stepper valor={r.maxSemana} min={1} max={100} sufijo="por semana" onChange={(v) => cambiar({ maxSemana: v })} />
        </Fila>
        <button type="button" onClick={() => void guardarPolitica()} className={BTN_PRI + ' mt-4'}><Check size={13} /> Guardar calendario y límite</button>
        </fieldset>}
      </Tarjeta>

      <Tarjeta titulo="Lo que se puede ofrecer" detalle="Preferencias para propuestas de cobranza. Los acuerdos requieren revisión humana.">
        <Fila titulo="Respetar días festivos" detalle="Preferencia de la organización. No agrega fechas automáticamente; las exclusiones concretas se guardan en la política.">
          <Interruptor activo={r.festivos} onChange={(v) => cambiar({ festivos: v })} etiqueta="Respetar días festivos" />
        </Fila>
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
        <button type="button" onClick={() => void guardarReglas()} className={BTN_PRI + ' mt-4'}>
          <Check size={13} /> Guardar reglas
        </button>
      </Tarjeta>
      {nodo}
    </fieldset>
  );
}

/** Hora del motor de cobranza (conectada al backend: collectionEngineHour). */
function HoraMotor() {
  const { avisar, nodo } = useAviso();
  const [hora, setHora] = React.useState<number | null>(null);
  React.useEffect(() => {
    api
      .getSettings()
      .then((s) => setHora(s.collectionEngineHour ?? 11))
      .catch(() => setHora(null));
  }, []);
  const guardar = async (h: number) => {
    const antes = hora;
    setHora(h);
    try {
      await api.updateSettings({ collectionEngineHour: h });
      avisar('Hora de envío guardada');
    } catch (e) {
      setHora(antes);
      avisar(e instanceof Error ? e.message : 'No se pudo guardar', { error: true });
    }
  };
  if (hora === null) return <span className="text-[12px] text-brand-ink/40">—</span>;
  return (
    <>
      <select
        value={hora}
        onChange={(e) => guardar(Number(e.target.value))}
        className="glass-campo rounded-full px-3.5 py-2 text-[12.5px] font-semibold outline-none"
        aria-label="Hora de envío"
      >
        {[9, 10, 11, 12, 13, 14, 16].map((h) => (
          <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
        ))}
      </select>
      {nodo}
    </>
  );
}

/**
 * Lo que el modo sombra habría enviado (últimas 24 h o 7 días). Se muestra
 * siempre: con el modo apagado explica qué va a aparecer aquí, para que el
 * criterio de la semana de prueba ("0 mensajes a facturas pagadas") se vea.
 */
function ReporteSombra({ activo }: { activo: boolean }) {
  const [dias, setDias] = React.useState<1 | 7>(1);
  const [rep, setRep] = React.useState<ShadowReport | null | undefined>(undefined);
  React.useEffect(() => {
    setRep(undefined);
    api.getShadowReport(dias).then(setRep).catch(() => setRep(null));
  }, [dias]);
  const periodo = dias === 1 ? 'En las últimas 24 horas' : 'En los últimos 7 días';
  return (
    <div className="mt-2 mb-1 rounded-2xl bg-brand-ink/[0.03] p-3" aria-label="Reporte del modo sombra">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[12.5px] font-semibold text-brand-ink">Lo que se habría enviado</div>
        <div className="flex gap-1" role="group" aria-label="Periodo del reporte">
          {([1, 7] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dias === d}
              onClick={() => setDias(d)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${dias === d ? 'bg-brand-ink text-white' : 'text-brand-ink/55 hover:bg-brand-ink/5'}`}
            >
              {d === 1 ? '24 h' : '7 días'}
            </button>
          ))}
        </div>
      </div>
      {rep === undefined ? (
        <p className="text-[12px] text-brand-ink/45">Cargando…</p>
      ) : rep === null ? (
        <p className="text-[12px] text-brand-ink/45">No se pudo cargar lo que se habría enviado.</p>
      ) : rep.total === 0 ? (
        <p className="text-[12px] text-brand-ink/55">
          {activo
            ? `${periodo} no se habría enviado nada.`
            : 'El modo sombra está apagado, así que no hay nada registrado. Al prenderlo, aquí verás cada día a quién se le habría escrito y si alguno ya había pagado (la meta de la semana de prueba es 0).'}
        </p>
      ) : (
        <>
          <div className="text-[12.5px] text-brand-ink mb-2">
            {periodo} se habrían enviado {rep.total} mensaje(s){rep.truncated ? ' o más' : ''}.
          </div>
          {(rep.alreadyPaidCount ?? 0) > 0 ? (
            <p role="alert" className="text-[12px] font-semibold text-red-700 mb-2">
              {rep.alreadyPaidCount} habrían ido a facturas que ya estaban pagadas. Revisa la carga de pagos antes de activar los envíos reales.
            </p>
          ) : (
            <p className="text-[12px] text-emerald-700 mb-2">Ninguno habría ido a una factura ya pagada.</p>
          )}
          {rep.truncated && (
            <p className="text-[12px] text-amber-700 mb-2">Hay más registros de los que se revisan; elige un periodo más corto.</p>
          )}
          <ul className="space-y-1 max-h-48 overflow-auto">
            {rep.items.slice(0, 50).map((it, i) => (
              <li key={i} className="text-[12px] text-brand-ink/65">
                {dias === 7 ? `${new Date(it.at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · ` : ''}
                {it.customerName ?? 'Cliente'} · factura {it.folio ?? '—'} · {it.channel ?? '—'}
                {it.template ? ` (${it.template})` : ''}
                {typeof it.daysOverdue === 'number' ? ` · ${it.daysOverdue} día(s) respecto al vencimiento` : ''}
                {it.alreadyPaid ? <span className="text-red-700 font-semibold"> · ya estaba pagada</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Seguridad de los envíos (conectado al backend, no se guarda en el
 * navegador): interruptor de emergencia de la organización, modo sombra del
 * plan por niveles y guardia de frescura del estado de cuenta.
 */
function SeguridadEnvios({ alCrearPlan }: { key?: string; alCrearPlan?: () => void }) {
  const { avisar, nodo } = useAviso();
  const { confirmar, nodo: nodoConfirmar } = useConfirmar();
  const [estado, setEstado] = React.useState<CollectionStatus | null | undefined>(undefined);
  const [sombra, setSombra] = React.useState<boolean | null>(null);
  const [frescura, setFrescura] = React.useState<number | null | undefined>(undefined);
  const [ocupado, setOcupado] = React.useState(false);

  React.useEffect(() => {
    api.getCollectionStatus().then(setEstado).catch(() => setEstado(null));
    api
      .getLevelPlan()
      .then((r) => {
        setSombra(r.policy?.shadowMode ?? false);
        setFrescura(r.policy?.paymentDataMaxAgeHours ?? null);
      })
      .catch(() => {
        setSombra(null);
        setFrescura(undefined);
      });
  }, []);

  const guardarPlan = async (cambio: { shadowMode?: boolean; paymentDataMaxAgeHours?: number | null }) => {
    setOcupado(true);
    try {
      const r = await api.updateLevelPlanSettings(cambio);
      setSombra(r.policy.shadowMode ?? false);
      setFrescura(r.policy.paymentDataMaxAgeHours ?? null);
      avisar('Guardado');
      // Guardar aquí crea el plan si no existía: el calendario de al lado se recarga.
      alCrearPlan?.();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'No se pudo guardar', { error: true });
    } finally {
      setOcupado(false);
    }
  };

  const pausar = () =>
    confirmar({
      titulo: 'Pausar todos los envíos',
      mensaje: 'Ningún cliente recibirá mensajes automáticos (WhatsApp ni correo) hasta que lo reanudes. Los envíos manuales siguen disponibles.',
      accion: 'Pausar envíos',
      peligro: true,
      campo: { tipo: 'texto', etiqueta: 'Motivo', placeholder: 'Ej. revisando un pago masivo' },
      alConfirmar: async (motivo) => {
        try {
          setEstado(await api.pauseCollection(motivo || undefined));
          avisar('Envíos pausados');
        } catch (e) {
          return e instanceof Error ? e.message : 'No se pudo pausar';
        }
      },
    });

  const reanudar = () =>
    confirmar({
      titulo: 'Reanudar los envíos',
      mensaje: 'Los mensajes automáticos vuelven a salir en la siguiente corrida del día.',
      accion: 'Reanudar',
      alConfirmar: async () => {
        try {
          setEstado(await api.resumeCollection());
          avisar('Envíos reanudados');
        } catch (e) {
          return e instanceof Error ? e.message : 'No se pudo reanudar';
        }
      },
    });

  const pausada = !!estado?.paused;
  return (
    <Tarjeta
      className="lg:col-span-2"
      titulo="Seguridad de los envíos"
      detalle="Antes de cada mensaje automático se revisa que el cliente no haya pagado ya (depósito sin revisar, un “ya pagué” reciente o un cobro recién revertido). Esto se guarda en el servidor."
    >
      <Fila
        icono={<ShieldCheck size={16} />}
        titulo={pausada ? 'Envíos pausados' : 'Interruptor de emergencia'}
        detalle={
          estado === undefined
            ? 'Cargando…'
            : estado === null
              ? 'No se pudo consultar el estado.'
              : pausada
                ? `Pausados desde ${new Date(estado.collectionPausedAt!).toLocaleString('es-MX')}${estado.collectionPausedReason ? ` · ${estado.collectionPausedReason}` : ''}`
                : 'Detiene de inmediato todos los mensajes automáticos a tus clientes.'
        }
      >
        {estado !== undefined && estado !== null && (
          <button type="button" onClick={pausada ? reanudar : pausar} className={pausada ? BTN_PRI : BTN_SEC}>
            {pausada ? 'Reanudar envíos' : 'Pausar todos los envíos'}
          </button>
        )}
      </Fila>
      <Fila
        icono={<Moon size={16} />}
        titulo="Modo sombra"
        detalle="El sistema calcula a quién le escribiría cada día y lo registra, pero no envía nada. Úsalo la primera semana con datos reales."
      >
        {sombra === null ? (
          <span className="text-[12px] text-brand-ink/40">Sin plan por niveles</span>
        ) : (
          <Interruptor activo={sombra} onChange={(v) => !ocupado && guardarPlan({ shadowMode: v })} etiqueta="Modo sombra" />
        )}
      </Fila>
      {sombra !== null && <ReporteSombra activo={!!sombra} />}
      <Fila
        icono={<Database size={16} />}
        titulo="Exigir estado de cuenta reciente"
        detalle="Si el último estado de cuenta subido es más viejo que esto, no se envía y se te avisa. Apagado si no subes estados de cuenta."
      >
        {frescura === undefined ? (
          <span className="text-[12px] text-brand-ink/40">Sin plan por niveles</span>
        ) : (
          <select
            value={frescura === null ? '' : String(frescura)}
            disabled={ocupado}
            onChange={(e) => guardarPlan({ paymentDataMaxAgeHours: e.target.value ? Number(e.target.value) : null })}
            className="glass-campo rounded-full px-3.5 py-2 text-[12.5px] font-semibold outline-none"
            aria-label="Antigüedad máxima del estado de cuenta"
          >
            <option value="">Apagado</option>
            <option value="24">24 horas</option>
            <option value="36">36 horas</option>
            <option value="48">48 horas</option>
            <option value="72">72 horas</option>
          </select>
        )}
      </Fila>
      {nodo}
      {nodoConfirmar}
    </Tarjeta>
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
  const { equipo, error } = useEquipo();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Tarjeta titulo="Equipo registrado" detalle="Conteo de usuarios reales de tu organización.">
        {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
        {equipo ? <ul className="space-y-2 text-[13px]">
          <li>Administradores: {equipo.filter((p) => p.rol === 'admin').length}</li>
          <li>Supervisores: {equipo.filter((p) => p.rol === 'supervisor').length}</li>
          <li>Agentes: {equipo.filter((p) => p.rol === 'agente').length}</li>
        </ul> : <p>{error ? 'Sin datos' : 'Cargando equipo…'}</p>}
        <button type="button" onClick={() => irA('equipo')} className={BTN_SEC + ' mt-4'}><UserPlus size={14} /> Ver equipo</button>
      </Tarjeta>
      <Tarjeta titulo="Plan y consumo">
        <p className="text-[13px] text-brand-ink/55">Sin datos de licencias o consumo de mensajes en esta vista.</p>
      </Tarjeta>
    </div>
  );
}
