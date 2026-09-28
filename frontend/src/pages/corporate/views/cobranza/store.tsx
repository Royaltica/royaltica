import React from 'react';
import {
  CARTERA,
  GESTIONES,
  HOY,
  CAMPANAS,
  audiencia,
  gestion,
  type Agente,
  type Campana,
  type CuentaCartera,
  type Gestion,
  type PasoId,
  type Resultado,
} from './mockV1.ts';
import { construirPlan } from './plan.tsx';

/**
 * Estado compartido de Cobranza IA. Lo que hace un perfil se ve en los
 * otros: si el Supervisor reasigna una cuenta, aparece en la lista del
 * Agente; si el Agente envía un mensaje o registra un resultado, se refleja
 * en el plan que ve el Administrador y en los Reportes; si se lanza una
 * campaña, sus cuentas quedan marcadas como enviadas.
 */
export const HORA_ACTUAL = '11:24';

type Envio = { paso: PasoId; canal: string; origen: string; hora: string };

type Store = {
  cartera: CuentaCartera[];
  campanas: Campana[];
  gestiones: Gestion[];
  envios: Record<string, Envio>;
  resultadosHoy: Record<string, string>;
  reasignar: (id: string, agente: Agente) => void;
  agregarContacto: (id: string, f: NonNullable<CuentaCartera['finanzas']>) => void;
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
  const [envios, setEnvios] = React.useState<Record<string, Envio>>({});
  const [resultadosHoy, setResultadosHoy] = React.useState<Record<string, string>>({});
  const [campanas, setCampanas] = React.useState<Campana[]>(CAMPANAS);
  const [bitacora, setBitacora] = React.useState<Gestion[]>([]);

  const cartera = React.useMemo(
    () =>
      CARTERA.map((c) => {
        const envio = envios[c.id];
        const res = { ...c.resultados };
        if (envio) res[envio.paso] = resultadosHoy[c.id] ?? `Enviado hoy ${envio.hora}`;
        else if (resultadosHoy[c.id]) {
          const actual = construirPlan({ hoy: c.dias, canal: c.canal, perfil: c.perfil, resultados: c.resultados }).actual;
          if (actual) res[actual.id] = resultadosHoy[c.id];
        }
        return { ...c, agente: agentes[c.id] ?? c.agente, finanzas: contactos[c.id] ?? c.finanzas, resultados: res };
      }),
    [agentes, contactos, envios, resultadosHoy],
  );

  // Lanzar hoy = "enviar" el paso vigente del plan a toda la audiencia
  // contactable que aún no recibió nada hoy.
  const lanzar = (camp: Campana): Campana => {
    const { incluidas } = audiencia(camp.config, cartera);
    const nuevos: Record<string, Envio> = {};
    for (const c of incluidas) {
      if (!c.contactable || envios[c.id]) continue;
      const paso = construirPlan({ hoy: c.dias, canal: c.canal, perfil: c.perfil, resultados: c.resultados }).actual;
      if (!paso) continue;
      nuevos[c.id] = { paso: paso.id, canal: camp.config.canal, origen: `Campaña "${camp.nombre}"`, hora: HORA_ACTUAL };
    }
    setEnvios((e) => ({ ...e, ...nuevos }));
    setBitacora((b) => [
      ...b,
      ...Object.keys(nuevos).map((id) => {
        const c = cartera.find((x) => x.id === id)!;
        return { ...gestion(HOY, HORA_ACTUAL, c.cliente, 'Enviado'), agente: c.agente };
      }),
    ]);
    return { ...camp, enviados: camp.enviados + Object.keys(nuevos).length };
  };

  const value: Store = {
    cartera,
    campanas,
    gestiones: [...GESTIONES, ...bitacora],
    envios,
    resultadosHoy,
    reasignar: (id, agente) => setAgentes((a) => ({ ...a, [id]: agente })),
    agregarContacto: (id, f) => setContactos((c) => ({ ...c, [id]: f })),
    enviar: (id, paso, canal, origen) => {
      setEnvios((e) => ({ ...e, [id]: { paso, canal, origen, hora: HORA_ACTUAL } }));
      const c = CARTERA.find((x) => x.id === id)!;
      setBitacora((b) => [...b, { ...gestion(HOY, HORA_ACTUAL, c.cliente, 'Enviado'), agente: agentes[id] ?? c.agente }]);
    },
    registrar: (id, resultado) => {
      setResultadosHoy((r) => ({ ...r, [id]: resultado }));
      const c = CARTERA.find((x) => x.id === id)!;
      setBitacora((b) => [
        ...b,
        { ...gestion(HOY, HORA_ACTUAL, c.cliente, A_RESULTADO[resultado] ?? 'Sin respuesta'), agente: agentes[id] ?? c.agente },
      ]);
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

/** Plan calculado de una cuenta (con lo enviado/registrado hoy). */
export function planCuenta(c: CuentaCartera) {
  return construirPlan({ hoy: c.dias, canal: c.canal, perfil: c.perfil, resultados: c.resultados });
}
