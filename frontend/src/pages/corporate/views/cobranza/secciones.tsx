import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  BellRing,
  Brain,
  Database,
  Megaphone,
  MessageSquareText,
  Settings,
  Shapes,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';
import type { Rol } from './RolSelector.tsx';
import { SPRING } from './campanasUi.tsx';

// Secciones de Cobranza IA: viven en la barra lateral (no en pestañas
// arriba). Aquí está todo lo que las describe para que la barra, el título
// y el color de acento de cada una salgan del mismo lugar.

export type Section =
  | 'recordatorios'
  | 'alertas'
  | 'campanas'
  | 'pagos'
  | 'segmentos'
  | 'plantillas'
  | 'reportes'
  | 'datos'
  | 'equipo'
  | 'configuracion';

export type MetaSeccion = {
  nombre: string;
  /** Lo que se lee en la URL (?seccion=…). */
  slug: string;
  titulo: string;
  texto: string;
  Icono: typeof Users;
  /** Color de acento en RGB separado por espacios (para rgb(var(--acento) / a)). */
  acento: string;
};

export const SECCIONES: Record<Section, MetaSeccion> = {
  recordatorios: {
    nombre: 'Clientes',
    slug: 'clientes',
    titulo: 'Clientes',
    texto: 'Cada cliente con su plan, sus facturas y lo que toca hoy.',
    Icono: Users,
    acento: '6 182 212', // cian
  },
  alertas: {
    nombre: 'Alertas',
    slug: 'alertas',
    titulo: 'Alertas',
    texto: 'Lo que hay que atender, con quién y cuánto está en juego. Cada alerta trae su botón para resolverla.',
    Icono: BellRing,
    acento: '244 63 94', // rosa
  },
  campanas: {
    nombre: 'Campañas',
    slug: 'campanas',
    titulo: 'Campañas',
    texto: 'El cobro diario lo hace el plan de cada cliente. Una campaña es un mensaje extra en una fecha especial, solo para quien elijas.',
    Icono: Megaphone,
    acento: '139 92 246', // violeta
  },
  pagos: {
    nombre: 'Pagos',
    slug: 'pagos',
    titulo: 'Pagos',
    texto: 'Lo que ya entró, conciliado entre ERP, REP y cobros registrados.',
    Icono: Wallet,
    acento: '16 185 129', // esmeralda
  },
  segmentos: {
    nombre: 'Segmentos',
    slug: 'segmentos',
    titulo: 'Segmentos',
    texto: 'Cómo paga cada cliente y qué plan le toca por eso.',
    Icono: Shapes,
    acento: '245 158 11', // ámbar
  },
  plantillas: {
    nombre: 'Plantillas',
    slug: 'plantillas',
    titulo: 'Plantillas',
    texto: 'Lo que dice cada mensaje, etapa por etapa.',
    Icono: MessageSquareText,
    acento: '14 165 233', // cielo
  },
  reportes: {
    nombre: 'Reportes',
    slug: 'reportes',
    titulo: 'Reportes',
    texto: 'Cómo va la cobranza del periodo y reportes a tu medida.',
    Icono: BarChart3,
    acento: '99 102 241', // índigo
  },
  datos: {
    nombre: 'Datos',
    slug: 'datos',
    titulo: 'Datos',
    texto: 'Tus clientes, sus facturas y la carga de información.',
    Icono: Database,
    acento: '20 184 166', // turquesa
  },
  equipo: {
    nombre: 'Equipo',
    slug: 'equipo',
    titulo: 'Equipo',
    texto: 'Cómo va cada persona y a quién le toca cada cuenta.',
    Icono: UsersRound,
    acento: '249 115 22', // naranja
  },
  configuracion: {
    nombre: 'Configuración',
    slug: 'configuracion',
    titulo: 'Configuración',
    texto: 'Tu equipo, quién recibe las alertas en su celular y las reglas con las que se cobra.',
    Icono: Settings,
    acento: '100 116 139', // pizarra
  },
};

/** Grupos de la barra: lo del día a día y lo que se configura. */
export const GRUPOS_POR_ROL: Record<Exclude<Rol, 'agente'>, { nombre: string; secciones: Section[] }[]> = {
  admin: [
    { nombre: 'Operación', secciones: ['recordatorios', 'alertas', 'campanas', 'pagos'] },
    { nombre: 'Configuración', secciones: ['segmentos', 'plantillas', 'reportes', 'datos', 'equipo'] },
  ],
  supervisor: [
    { nombre: 'Operación', secciones: ['recordatorios', 'campanas', 'pagos', 'equipo'] },
    { nombre: 'Análisis', secciones: ['segmentos', 'reportes'] },
  ],
};

export const seccionesDe = (rol: Rol): Section[] =>
  rol === 'agente' ? [] : GRUPOS_POR_ROL[rol].flatMap((g) => g.secciones);

export const grupoDe = (rol: Rol, s: Section): string =>
  rol === 'agente' ? 'Agente' : GRUPOS_POR_ROL[rol].find((g) => g.secciones.includes(s))?.nombre ?? '';

export const seccionDeSlug = (slug: string | null): Section | null =>
  (Object.keys(SECCIONES) as Section[]).find((k) => SECCIONES[k].slug === slug) ?? null;

export const ROLES_VALIDOS: Rol[] = ['admin', 'supervisor', 'agente'];

/**
 * Navegación de Cobranza IA para la barra lateral oscura. El resaltado viaja
 * entre secciones y cada una lleva un punto con su color de acento.
 */
export function NavCobranza({
  rol,
  seccion,
  onSeccion,
  pendientesAlertas = 0,
}: {
  rol: Rol;
  seccion: Section;
  onSeccion: (s: Section) => void;
  pendientesAlertas?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 px-3">
        <span className="w-7 h-7 rounded-xl bg-brand-gold/15 text-brand-gold flex items-center justify-center">
          <Brain size={15} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-white">Cobranza IA</span>
      </div>

      {rol === 'agente' ? (
        <p className="px-3 text-[12px] leading-relaxed text-white/45">Como agente ves una sola lista: tus cuentas de hoy.</p>
      ) : (
        GRUPOS_POR_ROL[rol].map((g) => (
          <div key={g.nombre}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">{g.nombre}</div>
            <ul className="space-y-0.5">
              {g.secciones.map((id) => {
                const m = SECCIONES[id];
                const activa = id === seccion;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        // Tocar la sección en la que ya estás la regresa a su inicio (p. ej. la lista de clientes).
                        window.dispatchEvent(new CustomEvent('cobranza:inicio-seccion', { detail: id }));
                        onSeccion(id);
                      }}
                      aria-current={activa ? 'page' : undefined}
                      className={`group relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/70 ${
                        activa ? 'text-white' : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {activa && (
                        <motion.span
                          layoutId={reduce ? undefined : 'nav-cobranza'}
                          transition={SPRING}
                          className="absolute inset-0 rounded-xl bg-white/[0.1] ring-1 ring-white/10"
                          style={{ boxShadow: `inset 3px 0 0 rgb(${m.acento})` }}
                        />
                      )}
                      <m.Icono
                        size={16}
                        className="relative shrink-0 transition-colors"
                        style={{ color: activa ? `rgb(${m.acento})` : undefined }}
                      />
                      <span className="relative flex-1 truncate">{m.nombre}</span>
                      {id === 'alertas' && pendientesAlertas > 0 && (
                        <span className="relative min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10.5px] font-bold tabular-nums flex items-center justify-center">
                          {pendientesAlertas}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

/** Estado de la sección y el perfil en la URL (?seccion=…&rol=…): recargar o "atrás" no te saca de donde estabas. */
export function useSeccionEnUrl(
  buscar: string,
  navegar: (busqueda: string) => void,
): { seccion: Section; rol: Rol; irA: (s: Section) => void; cambiarRol: (r: Rol) => void } {
  const params = new URLSearchParams(buscar);
  // Por ahora todos entran como Administrador; los perfiles de Supervisor y
  // Agente se darán según el acceso de cada cliente.
  const rol = 'admin' as Rol;
  const permitidas = seccionesDe(rol);
  const pedida = seccionDeSlug(params.get('seccion'));
  // Configuración no va en la lista de secciones (vive al pie de la barra), solo la abre el Administrador.
  const seccion: Section =
    pedida && (permitidas.includes(pedida) || rol === 'agente' || (pedida === 'configuracion' && rol === 'admin')) ? pedida : 'recordatorios';
  const armar = (s: Section, r: Rol) => {
    const p = new URLSearchParams();
    p.set('seccion', SECCIONES[s].slug);
    if (r !== 'admin') p.set('rol', r);
    navegar(`?${p.toString()}`);
  };
  return {
    seccion,
    rol,
    irA: (s) => armar(s, rol),
    cambiarRol: (r) => armar(seccionesDe(r).includes(seccion) ? seccion : 'recordatorios', r),
  };
}

/** Pinta el color de acento de la sección en el contenedor (variable CSS). */
export const estiloAcento = (s: Section): React.CSSProperties => ({ ['--acento' as string]: SECCIONES[s].acento });
