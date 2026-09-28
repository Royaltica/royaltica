import React from 'react';
import {
  CARTERA,
  GESTIONES,
  HOY,
  CAMPANAS,
  PLANTILLAS,
  PASOS_CAMPANA,
  RESPUESTAS_SIM,
  TOQUES_INICIALES,
  audiencia,
  diagnosticoDe,
  gestion,
  planConfig,
  type Agente,
  type Campana,
  type CuentaCartera,
  type Diagnostico,
  type Gestion,
  type PasoId,
  type Resultado,
  type Segmento,
} from './mockV1.ts';
import { construirPlan } from './plan.tsx';

/**
 * Estado compartido de Cobranza IA. Lo que hace un perfil se ve en los
 * otros: si el Supervisor reasigna una cuenta o cambia su segmento, el
 * Agente lo ve; si el Agente envía o registra un resultado, se refleja en el
 * plan del Administrador y en Reportes; si se lanza una campaña, sus
 * cuentas quedan marcadas, las respuestas le llegan al agente y las
 * llamadas se vuelven tareas suyas.
 */
export const HORA_ACTUAL = '11:24';

type Envio = { paso: PasoId; canal: string; origen: string; hora: string };
export type Toque = { campanaId: string; campana: string; plantilla: string; hora: string; respuesta?: string };
export type Tarea = { campana: string; motivo: string };
export type CambioSegmento = { cliente: string; de: Segmento; a: Segmento; motivo: string; hora: string };

/** Cuenta tal como la ven los 3 perfiles: con segmento, agente y lo hecho hoy. */
export type CuentaViva = CuentaCartera & {
  segmento: Segmento;
  diagnostico: Diagnostico;
  segmentoManual?: { motivo: string };
};

type Store = {
  cartera: CuentaViva[];
  campanas: Campana[];
  gestiones: Gestion[];
  envios: Record<string, Envio>;
  resultadosHoy: Record<string, string>;
  toques: Record<string, Toque[]>;
  tareas: Record<string, Tarea>;
  cambiosSegmento: CambioSegmento[];
  reasignar: (id: string, agente: Agente) => void;
  agregarContacto: (id: string, f: NonNullable<CuentaCartera['finanzas']>) => void;
  cambiarSegmento: (id: string, segmento: Segmento | null, motivo: string) => void;
  enviar: (id: string, paso: PasoId, canal: string, origen: string) => void;
  registrar: (id: string, resultado: string) => void;
  guardarCampana: (c: Campana) => void;
  cambiarEstadoCampana: (id: string, estado: Campana['estado']) => void;
};

const Ctx = React.createContext<Store | null>(null);

const A_RESULTADO: Record<string, Resultado> = {
  'Promesa de pago': 'Promesa de pago',
  Contactado: 'Sin respuesta',
  'No contestó': 'Sin respuesta',
  Disputa: 'Disputa',
  'Escalado a supervisor': 'Escalado',
};

export function CobranzaProvider({ children }: { children: React.ReactNode }) {
  const [agentes, setAgentes] = React.useState<Record<string, Agente>>({});
  const [contactos, setContactos] = React.useState<Record<string, NonNullable<CuentaCartera['finanzas']>>>({});
  const [segManual, setSegManual] = React.useState<Record<string, { segmento: Segmento; motivo: string }>>({});
  const [cambiosSegmento, setCambiosSegmento] = React.useState<CambioSegmento[]>([]);
  const [envios, setEnvios] = React.useState<Record<string, Envio>>({});
  const [resultadosHoy, setResultadosHoy] = React.useState<Record<string, string>>({});
  const [toques, setToques] = React.useState<Record<string, Toque[]>>(TOQUES_INICIALES);
  const [tareas, setTareas] = React.useState<Record<string, Tarea>>({});
  const [campanas, setCampanas] = React.useState<Campana[]>(CAMPANAS);
  const [bitacora, setBitacora] = React.useState<Gestion[]>([]);

  const cartera: CuentaViva[] = React.useMemo(
    () =>
      CARTERA.map((c) => {
        const diagnostico = diagnosticoDe(c);
        const manual = segManual[c.id];
        const segmento = manual?.segmento ?? diagnostico.segmento;
        const envio = envios[c.id];
        const res = { ...c.resultados };
        if (envio) res[envio.paso] = resultadosHoy[c.id] ?? `Enviado hoy ${envio.hora}`;
        else if (resultadosHoy[c.id]) {
          const actual = construirPlan(planConfig(c, segmento)).actual;
          if (actual) res[actual.id] = resultadosHoy[c.id];
        }
        return {
          ...c,
          agente: agentes[c.id] ?? c.agente,
          finanzas: contactos[c.id] ?? c.finanzas,
          resultados: res,
          segmento,
          diagnostico,
          segmentoManual: manual ? { motivo: manual.motivo } : undefined,
        };
      }),
    [agentes, contactos, segManual, envios, resultadosHoy],
  );

  const anotar = (c: CuentaViva, r: Resultado) =>
    setBitacora((b) => [...b, { ...gestion(HOY, HORA_ACTUAL, c.cliente, r), agente: c.agente }]);

  // Lanzar hoy: a cada cuenta contactable de la audiencia se le manda el
  // nivel/etapa elegido en la campaña (y queda marcado en su plan).
  const lanzar = (camp: Campana): Campana => {
    const { incluidas } = audiencia(camp.config, cartera);
    const nuevosEnvios: Record<string, Envio> = {};
    const nuevosToques: Record<string, Toque> = {};
    const nuevasTareas: Record<string, Tarea> = {};
    const pl = PLANTILLAS.find((p) => p.id === camp.config.plantilla);
    const esPaso = !!pl && PASOS_CAMPANA.includes(pl.id);
    for (const c of incluidas as CuentaViva[]) {
      if (!c.contactable || envios[c.id] || tareas[c.id]) continue;
      // La etapa D es llamada: la campaña no manda mensaje, le deja la tarea al agente.
      if (pl?.canal === 'Llamada') {
        nuevasTareas[c.id] = { campana: camp.nombre, motivo: `${pl.etapa} · ${pl.nombre}` };
        continue;
      }
      nuevosToques[c.id] = { campanaId: camp.id, campana: camp.nombre, plantilla: camp.config.plantilla, hora: HORA_ACTUAL, respuesta: RESPUESTAS_SIM[c.id] };
      if (esPaso) nuevosEnvios[c.id] = { paso: pl!.id as PasoId, canal: camp.config.canal, origen: `Campaña "${camp.nombre}"`, hora: HORA_ACTUAL };
    }
    setEnvios((e) => ({ ...e, ...nuevosEnvios }));
    setTareas((t) => ({ ...t, ...nuevasTareas }));
    setToques((t) => {
      const out = { ...t };
      for (const [id, tq] of Object.entries(nuevosToques)) out[id] = [...(out[id] ?? []), tq];
      return out;
    });
    for (const id of Object.keys(nuevosToques)) anotar(cartera.find((x) => x.id === id)!, 'Enviado');
    return { ...camp, enviados: camp.enviados + Object.keys(nuevosToques).length };
  };

  const value: Store = {
    cartera,
    campanas,
    gestiones: [...GESTIONES, ...bitacora],
    envios,
    resultadosHoy,
    toques,
    tareas,
    cambiosSegmento,
    reasignar: (id, agente) => setAgentes((a) => ({ ...a, [id]: agente })),
    agregarContacto: (id, f) => setContactos((c) => ({ ...c, [id]: f })),
    cambiarSegmento: (id, segmento, motivo) => {
      const c = cartera.find((x) => x.id === id)!;
      setSegManual((m) => {
        const out = { ...m };
        if (segmento) out[id] = { segmento, motivo };
        else delete out[id];
        return out;
      });
      setCambiosSegmento((h) => [
        {
          cliente: c.cliente,
          de: c.segmento,
          a: segmento ?? c.diagnostico.segmento,
          motivo: segmento ? motivo : 'Regresó al segmento calculado',
          hora: HORA_ACTUAL,
        },
        ...h,
      ]);
    },
    enviar: (id, paso, canal, origen) => {
      setEnvios((e) => ({ ...e, [id]: { paso, canal, origen, hora: HORA_ACTUAL } }));
      anotar(cartera.find((x) => x.id === id)!, 'Enviado');
    },
    registrar: (id, resultado) => {
      setResultadosHoy((r) => ({ ...r, [id]: resultado }));
      setTareas((t) => {
        const out = { ...t };
        delete out[id];
        return out;
      });
      anotar(cartera.find((x) => x.id === id)!, A_RESULTADO[resultado] ?? 'Sin respuesta');
    },
    guardarCampana: (c) => {
      const final = c.estado === 'Activa' && c.config.inicio <= HOY ? lanzar(c) : c;
      setCampanas((cs) => [final, ...cs.filter((x) => x.id !== c.id)]);
    },
    cambiarEstadoCampana: (id, estado) => {
      const camp = campanas.find((x) => x.id === id);
      if (!camp) return;
      let upd: Campana = { ...camp, estado };
      if (estado === 'Activa' && camp.config.inicio <= HOY) upd = lanzar(upd);
      setCampanas((cs) => cs.map((x) => (x.id === id ? upd : x)));
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCobranza(): Store {
  const s = React.useContext(Ctx);
  if (!s) throw new Error('useCobranza debe usarse dentro de <CobranzaProvider>');
  return s;
}

/** Plan calculado de una cuenta (con su segmento y lo enviado/registrado hoy). */
export function planCuenta(c: CuentaViva) {
  return construirPlan(planConfig(c, c.segmento));
}

/** Plantilla usada en un toque de campaña. */
export const plantillaPorId = (id: string) => PLANTILLAS.find((p) => p.id === id);
