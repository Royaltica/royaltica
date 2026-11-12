import {
  HOY,
  OCASIONES,
  PLANTILLAS,
  saldoDe,
  type Campana,
  type CampanaConfig,
  type Objetivo,
  type Ocasion,
} from './mockV1.ts';
import type { CuentaViva } from './store.tsx';

// Reglas de las campañas especiales, separadas de la vista para que el
// dashboard y el asistente decidan igual.

export const OBJETIVOS: {
  id: Objetivo;
  nombre: string;
  detalle: string;
  /** Fechas que tienen sentido para este objetivo (la primera es la sugerida). */
  ocasiones: Ocasion[];
}[] = [
  {
    id: 'recuperar',
    nombre: 'Recuperar lo vencido',
    detalle: 'Clientes con más de 15 días de atraso, con una oferta para liquidar.',
    ocasiones: ['buen_fin', 'black_friday', 'personalizada'],
  },
  {
    id: 'adelantar',
    nombre: 'Adelantar pagos por vencer',
    detalle: 'Facturas que aún no vencen: un incentivo para pagar antes.',
    ocasiones: ['personalizada', 'buen_fin', 'black_friday'],
  },
  {
    id: 'cierre',
    nombre: 'Cerrar el año al corriente',
    detalle: 'Todo lo vencido, antes del cierre contable de diciembre.',
    ocasiones: ['cierre', 'personalizada'],
  },
  {
    id: 'contactos',
    nombre: 'Validar contactos',
    detalle: 'Sin oferta: confirmar quién paga en cada cliente.',
    ocasiones: ['contacto'],
  },
];

export const objetivoDe = (cfg: CampanaConfig): Objetivo =>
  cfg.objetivo ?? (cfg.ocasion === 'contacto' ? 'contactos' : cfg.ocasion === 'cierre' ? 'cierre' : 'recuperar');

/** Por qué un cliente no puede recibir la campaña (o null si sí puede). */
export function bloqueo(c: CuentaViva): string | null {
  if (!c.finanzas) return 'Sin contacto de finanzas';
  if (c.segmento === 'disputa') return 'En disputa';
  return null;
}

/** Clientes sugeridos según el objetivo. Quien suele esperar descuentos queda fuera. */
export function sugeridos(cartera: CuentaViva[], objetivo: Objetivo): string[] {
  return cartera
    .filter((c) => !c.saldada && !bloqueo(c))
    .filter((c) => {
      if (objetivo === 'contactos') return true;
      if (c.comportamiento.esperaDescuentos) return false;
      if (objetivo === 'adelantar') return c.dias <= 0;
      if (objetivo === 'cierre') return c.dias > 0;
      return c.dias > 15 && !c.promesa;
    })
    .map((c) => c.id);
}

export function configDe(objetivo: Objetivo, ocasion: Ocasion, cartera: CuentaViva[]): CampanaConfig {
  const o = OCASIONES.find((x) => x.id === ocasion)!;
  const oferta =
    objetivo === 'adelantar' && o.oferta.tipo !== 'ninguna' ? { tipo: 'descuento' as const, valor: 3 } : o.oferta;
  return {
    objetivo,
    ocasion,
    plantilla: o.plantilla,
    oferta,
    inicio: o.inicio < HOY ? HOY : o.inicio,
    fin: o.fin < HOY ? HOY : o.fin,
    canal: PLANTILLAS.find((p) => p.id === o.plantilla)?.canal === 'Correo' ? 'Correo' : 'WhatsApp',
    clientes: sugeridos(cartera, objetivo),
  };
}

/** Las campañas listas para usar (las fechas fuertes del año). */
export const PREDETERMINADAS: { id: string; objetivo: Objetivo; ocasion: Ocasion; nombre: string; fechas: string }[] = [
  { id: 'p-buen-fin', objetivo: 'recuperar', ocasion: 'buen_fin', nombre: 'Buen Fin', fechas: '13 al 16 nov' },
  { id: 'p-black', objetivo: 'recuperar', ocasion: 'black_friday', nombre: 'Black Friday', fechas: '27 nov' },
  { id: 'p-cierre', objetivo: 'cierre', ocasion: 'cierre', nombre: 'Cierre de año', fechas: '1 al 20 dic' },
  { id: 'p-contactos', objetivo: 'contactos', ocasion: 'contacto', nombre: 'Validar contactos', fechas: 'Cuando quieras' },
];

export const fmtFecha = (iso: string) => {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(iso.slice(8))} ${meses[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};

export const montoDe = (cartera: CuentaViva[], ids: string[]) =>
  cartera.filter((c) => ids.includes(c.id)).reduce((a, c) => a + saldoDe(c), 0);

/** Avance de la campaña en el tiempo (0 a 1). */
export function avance(c: Campana): number {
  const ini = Date.parse(c.config.inicio);
  const fin = Date.parse(c.config.fin) + 86_400_000;
  const hoy = Date.parse(HOY) + 43_200_000;
  if (hoy <= ini) return 0;
  if (hoy >= fin) return 1;
  return (hoy - ini) / (fin - ini);
}

/** Qué se puede hacer con una campaña según su estado (mapa completo de acciones). */
export type AccionCampana =
  | 'lanzar'
  | 'reanudar'
  | 'pausar'
  | 'editar'
  | 'renombrar'
  | 'duplicar'
  | 'finalizar'
  | 'eliminar'
  | 'repetir';

export function accionesDe(c: Campana): { principal: AccionCampana | null; menu: AccionCampana[] } {
  switch (c.estado) {
    case 'Borrador':
      return { principal: 'lanzar', menu: ['editar', 'renombrar', 'duplicar', 'eliminar'] };
    case 'Programada':
      return { principal: 'pausar', menu: ['editar', 'renombrar', 'duplicar', 'eliminar'] };
    case 'Activa':
      // Una campaña activa no se borra: primero se pausa o se finaliza.
      return { principal: 'pausar', menu: ['editar', 'renombrar', 'duplicar', 'finalizar'] };
    case 'Pausada':
      return { principal: 'reanudar', menu: ['editar', 'renombrar', 'duplicar', 'finalizar', 'eliminar'] };
    case 'Finalizada':
      return { principal: 'repetir', menu: ['renombrar', 'duplicar', 'eliminar'] };
  }
}
