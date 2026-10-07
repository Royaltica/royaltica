import React from 'react';
import {
  CARTERA,
  GESTIONES,
  HOY,
  CAMPANAS,
  PLANTILLAS,
  RESPUESTAS_SIM,
  TOQUES_INICIALES,
  PAGOS_INICIALES,
  SYNC_ERP_SIM,
  ZIP_REP_SIM,
  CSV_SIM,
  comportamientoDe,
  diagnosticoDe,
  gestion,
  planConfig,
  type Agente,
  type Campana,
  type CuentaCartera,
  type Comportamiento,
  type Diagnostico,
  type Factura,
  type Gestion,
  type Pago,
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
export type NoReconocido = { uuid: string; rfc: string; nombre: string; monto: number; fecha: string };
export type CambioSegmento = { cliente: string; de: Segmento; a: Segmento; motivo: string; hora: string };

/** Cuenta tal como la ven los 3 perfiles: con segmento, agente y lo hecho hoy. */
/** Factura tal como se muestra: la principal (la que está en cobro) y las demás. */
export type FacturaViva = Factura & { principal: boolean; pagado: number };

export type CuentaViva = CuentaCartera & {
  saldada: boolean;
  facturas: FacturaViva[];
  comportamiento: Comportamiento;
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
  pagos: Pago[];
  csvCargado: boolean;
  subirCsv: () => string;
  iniciarPlanes: (folios: string[]) => void;
  noReconocidos: NoReconocido[];
  erp: { ultima: string; sincronizado: boolean };
  zipCargado: boolean;
  sincronizarErp: () => string;
  subirRep: () => string;
  resolverDiscrepancia: (id: string, usar: 'ERP' | 'REP') => void;
  avisarRep: (id: string) => void;
  marcarEnErp: (id: string) => void;
  descartarNoReconocido: (uuid: string) => void;
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
  const [pagos, setPagos] = React.useState<Pago[]>(PAGOS_INICIALES);
  const [noReconocidos, setNoReconocidos] = React.useState<NoReconocido[]>([]);
  const [erp, setErp] = React.useState({ ultima: 'hoy 06:00', sincronizado: false });
  const [zipCargado, setZipCargado] = React.useState(false);
  const [csvCargado, setCsvCargado] = React.useState(false);
  const [planesIniciados, setPlanesIniciados] = React.useState<Record<string, string>>({});
  const [facturasNuevas, setFacturasNuevas] = React.useState<Record<string, Factura[]>>({});

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
        // El saldo sale de sumar los pagos aplicados (ERP y/o REP).
        const pagado = pagos.filter((p) => p.cuentaId === c.id).reduce((a, p) => a + p.monto, 0);
        return {
          ...c,
          pagado,
          saldada: c.monto - pagado <= 1, // tolerancia de centavos
          facturas: [
            { folio: c.folio, monto: c.monto, emision: c.emision, vence: c.vence, dias: c.dias, planInicio: c.planInicio, principal: true, pagado },
            ...[...(c.facturasExtra ?? []), ...(facturasNuevas[c.id] ?? [])].map((f) => ({
              ...f,
              planInicio: planesIniciados[f.folio] ?? f.planInicio,
              principal: false,
              pagado: 0,
            })),
          ],
          comportamiento: comportamientoDe(c),
          agente: agentes[c.id] ?? c.agente,
          finanzas: contactos[c.id] ?? c.finanzas,
          resultados: res,
          segmento,
          diagnostico,
          segmentoManual: manual ? { motivo: manual.motivo } : undefined,
        };
      }),
    [agentes, contactos, segManual, envios, resultadosHoy, pagos, planesIniciados, facturasNuevas],
  );

  const anotar = (c: CuentaViva, r: Resultado, monto?: number) =>
    setBitacora((b) => [...b, { ...gestion(HOY, HORA_ACTUAL, c.cliente, r, monto), agente: c.agente }]);

  // Lanzar una campaña especial: el mensaje va solo a los clientes elegidos
  // que se pueden contactar. No toca su plan: el plan sigue su curso aparte.
  const lanzar = (camp: Campana): Campana => {
    const nuevosToques: Record<string, Toque> = {};
    for (const id of camp.config.clientes) {
      const c = cartera.find((x) => x.id === id);
      if (!c || c.saldada || !c.contactable || !c.finanzas) continue;
      nuevosToques[id] = { campanaId: camp.id, campana: camp.nombre, plantilla: camp.config.plantilla, hora: HORA_ACTUAL, respuesta: RESPUESTAS_SIM[id] };
    }
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
    pagos,
    noReconocidos,
    erp,
    zipCargado,
    // Sincronización del ERP: compara saldos y registra la diferencia como pago.
    csvCargado,
    // CSV de cartera: igual que el ERP, compara saldos contra el último reporte.
    subirCsv: () => {
      if (csvCargado) return 'Ese reporte ya se había cargado: no cambió ningún saldo.';
      setCsvCargado(true);
      setPagos((ps) => [CSV_SIM.pago, ...ps]);
      setFacturasNuevas((f) => ({ ...f, [CSV_SIM.facturaNueva.cuentaId]: [CSV_SIM.facturaNueva.factura] }));
      const c = cartera.find((x) => x.id === CSV_SIM.pago.cuentaId)!;
      const nueva = cartera.find((x) => x.id === CSV_SIM.facturaNueva.cuentaId)!;
      anotar(c, 'Pagó', CSV_SIM.pago.monto);
      return `14 facturas leídas: ${c.cliente} pagó $30,000 (queda $68,400) y apareció una factura nueva de ${nueva.cliente} (F-2983), lista para iniciar su plan.`;
    },
    iniciarPlanes: (folios) =>
      setPlanesIniciados((p) => ({ ...p, ...Object.fromEntries(folios.map((f) => [f, `hoy ${HORA_ACTUAL}`])) })),
    sincronizarErp: () => {
      setErp({ ultima: `hoy ${HORA_ACTUAL}`, sincronizado: true });
      if (erp.sincronizado) return 'Sin cambios: ningún saldo se movió desde la última sincronización.';
      setPagos((ps) => [SYNC_ERP_SIM, ...ps]);
      const c = cartera.find((x) => x.id === SYNC_ERP_SIM.cuentaId)!;
      anotar(c, 'Pagó', SYNC_ERP_SIM.monto);
      return `1 pago nuevo: ${c.cliente} pagó $60,000. Queda saldo de $66,300 y la cobranza sigue sobre eso.`;
    },
    // ZIP de REP: cada complemento se empata por UUID con su factura.
    subirRep: () => {
      if (zipCargado) return 'Ese ZIP ya se había procesado: no se duplicó ningún pago.';
      setZipCargado(true);
      const z = ZIP_REP_SIM;
      const lumen = cartera.find((x) => x.id === z.nuevo.cuentaId)!;
      setPagos((ps) => [
        {
          id: 'p7', cuentaId: z.nuevo.cuentaId, monto: z.nuevo.monto, fechaPago: z.nuevo.fechaPago, metodo: 'PPD', estado: 'solo_rep', parcialidad: 1,
          nota: 'El ERP todavía no lo refleja: se avisó a contabilidad para aplicarlo en Odoo.',
          evidencias: [{ fuente: 'REP', fecha: `hoy ${HORA_ACTUAL}`, texto: `REP ${z.nuevo.uuid} · liquida la factura · vigente en el SAT` }],
        },
        ...ps.map((p): Pago => {
          if (p.cuentaId === z.confirma.cuentaId && p.estado === 'solo_erp')
            return { ...p, estado: 'confirmado', limiteRep: undefined, evidencias: [...p.evidencias, { fuente: 'REP', fecha: `hoy ${HORA_ACTUAL}`, texto: `REP ${z.confirma.uuid} · parcialidad 1 · coincide con el ERP` }] };
          if (p.cuentaId === z.discrepa.cuentaId && p.estado === 'solo_erp')
            return { ...p, estado: 'discrepancia', montoRep: z.discrepa.monto, limiteRep: undefined, evidencias: [...p.evidencias, { fuente: 'REP', fecha: `hoy ${HORA_ACTUAL}`, texto: `REP ${z.discrepa.uuid} · dice $78,000 y el ERP $78,100` }] };
          return p;
        }),
      ]);
      setNoReconocidos((n) => [...n, z.desconocido]);
      anotar(lumen, 'Pagó', z.nuevo.monto);
      return '4 REP leídos: 1 confirmó un pago, 1 liquidó una factura que el ERP aún no tenía, 1 no cuadra y 1 no corresponde a ninguna factura.';
    },
    resolverDiscrepancia: (id, usar) =>
      setPagos((ps) =>
        ps.map((p) =>
          p.id === id
            ? { ...p, estado: 'confirmado', monto: usar === 'REP' ? (p.montoRep ?? p.monto) : p.monto, nota: usar === 'REP' ? 'Se usó el monto del REP; el saldo de la factura se ajustó.' : 'Se mantuvo el monto del ERP; contabilidad corregirá el REP.' }
            : p,
        ),
      ),
    avisarRep: (id) => setPagos((ps) => ps.map((p) => (p.id === id ? { ...p, avisado: true } : p))),
    // Contabilidad registró en el ERP un pago que solo conocíamos por su REP.
    marcarEnErp: (id) =>
      setPagos((ps) =>
        ps.map((p) =>
          p.id === id
            ? { ...p, estado: 'confirmado', nota: undefined, evidencias: [...p.evidencias, { fuente: 'ERP', fecha: `hoy ${HORA_ACTUAL}`, texto: 'Contabilidad lo aplicó en el ERP: ya coinciden' }] }
            : p,
        ),
      ),
    descartarNoReconocido: (uuid) => setNoReconocidos((n) => n.filter((x) => x.uuid !== uuid)),
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
