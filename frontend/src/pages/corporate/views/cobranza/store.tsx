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
import { construirPlan, PASO_DE_PLANTILLA } from './plan.tsx';
import { api, type WaPlanActivity, type PortfolioCustomer, type CustomerPayload } from '../../../../services/apiClient.ts';
import { cuentaDesdeApi } from './carteraReal.ts';

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
export type CambioSegmento = { cliente: string; de: Segmento; a: Segmento; motivo: string; hora: string; fecha?: string };
/** Usuario real que puede llevar cuentas (de Configuración → Usuarios). */
export type AgenteReal = { id: string; nombre: string; activo: boolean };

/** WhatsApp exige formato internacional: 10 dígitos de México → +52… */
export function normalizarTelefono(t: string): string {
  const digitos = t.replace(/\D/g, '');
  if (!digitos) return '';
  return t.trim().startsWith('+') ? `+${digitos}` : digitos.length === 10 ? `+52${digitos}` : `+${digitos}`;
}

const ES_EJEMPLO = 'Este cliente es de ejemplo. Carga tu cartera real en Datos para editarlo.';
const msg = (e: unknown, def: string) => (e instanceof Error && e.message ? e.message : def);

/**
 * Estado que debe sobrevivir a una recarga (campañas, segmentos manuales):
 * se guarda en el navegador. Si el almacenamiento falla, sigue en memoria.
 */
function usePersistido<T>(clave: string, inicial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const llave = `royaltica.cobranza.${clave}`;
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
      /* sin almacenamiento: queda en memoria */
    }
  }, [llave, v]);
  return [v, setV];
}

/** Cuenta tal como la ven los 3 perfiles: con segmento, agente y lo hecho hoy. */
/** Factura tal como se muestra: la principal (la que está en cobro) y las demás. */
export type FacturaViva = Factura & { principal: boolean; pagado: number };

export type CuentaViva = CuentaCartera & {
  /** Pasos del plan que ya salieron por WhatsApp (datos reales del backend). */
  pasosEnviados: string[];
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
  /** Usuarios reales que pueden llevar cuentas. null = sin acceso o sin conexión. */
  agentesReales: AgenteReal[] | null;
  /** Edita la ficha del cliente en la base. Regresa un error o null. */
  editarCliente: (id: string, cambios: CustomerPayload) => Promise<string | null>;
  crearCliente: (datos: CustomerPayload & { name: string; rfc: string; legalName: string }) => Promise<string | null>;
  /** Borrado lógico. Regresa un error (ej. tiene facturas abiertas) o null. */
  eliminarCliente: (id: string) => Promise<string | null>;
  restaurarCliente: (dbId: string) => Promise<string | null>;
  /** Detiene (o reanuda) todo contacto automático con el cliente. */
  pausarContacto: (id: string, pausar: boolean, motivo?: string) => Promise<string | null>;
  /** Registra el cobro de una factura real (fecha AAAA-MM-DD). */
  cobrarFactura: (facturaDbId: string, fecha: string, referencia?: string) => Promise<string | null>;
  cancelarFactura: (facturaDbId: string, motivo: string) => Promise<string | null>;
  revertirCobro: (facturaDbId: string, motivo: string) => Promise<string | null>;
  crearFactura: (
    id: string,
    f: { folio: string; uuid: string; total: number; fecha: string; vence: string },
  ) => Promise<string | null>;
  /** Guarda el contacto de finanzas (en la base si el cliente es real). Regresa un error o null. */
  agregarContacto: (id: string, f: NonNullable<CuentaCartera['finanzas']>) => Promise<string | null>;
  cambiarSegmento: (id: string, segmento: Segmento | null, motivo: string) => void;
  enviar: (id: string, paso: PasoId, canal: string, origen: string) => void;
  registrar: (id: string, resultado: string) => void;
  guardarCampana: (c: Campana) => void;
  cambiarEstadoCampana: (id: string, estado: Campana['estado']) => void;
  /** Quita una campaña (no activa). Regresa su posición para poder deshacer. */
  eliminarCampana: (id: string) => number;
  /** Deshace un eliminar: la regresa a la posición que tenía. */
  restaurarCampana: (c: Campana, index: number) => void;
  /**
   * ID real del cliente en el backend (para su conversación de WhatsApp).
   * undefined = cargando · null = no existe en la base · 'error' = no hubo conexión.
   */
  waClienteId: (cliente: string) => string | null | undefined | 'error';
  /** Vuelve a leer lo que pasó por WhatsApp (tras enviar, o al llegar respuestas). */
  refrescarWhatsapp: () => Promise<void>;
  /**
   * De dónde sale la cartera: 'real' = clientes de la base de datos;
   * 'ejemplo' = la base no tiene clientes (o no hubo conexión) y se muestra el prototipo.
   */
  fuente: 'cargando' | 'real' | 'ejemplo';
  /** Vuelve a leer la cartera real (tras importar un CSV). */
  recargarCartera: () => Promise<void>;
  /** Recordatorios automáticos (true) o con aprobación (false). null = sin conexión. */
  envioAutomatico: boolean | null | undefined;
  cambiarEnvioAutomatico: (auto: boolean) => Promise<void>;
  /** Tipos de deudor importados del análisis de la consultoría (null = sin importar). */
  tiposDeudor: TiposDeudorEstado | null;
  guardarTiposDeudor: (e: TiposDeudorEstado | null) => void;
};

/** Resultado de importar el análisis: qué tipos están activos y a qué tipo pertenece cada cliente. */
export type TiposDeudorEstado = {
  activos: string[];
  /** id de la cuenta → id del tipo de deudor. */
  asignaciones: Record<string, string>;
  archivo: string;
  fecha: string;
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
  const [segManual, setSegManual] = usePersistido<Record<string, { segmento: Segmento; motivo: string }>>('segmentos', {});
  const [cambiosSegmento, setCambiosSegmento] = usePersistido<CambioSegmento[]>('cambiosSegmento', []);
  const [tiposDeudor, setTiposDeudor] = usePersistido<TiposDeudorEstado | null>('tiposDeudor', null);
  const [envios, setEnvios] = React.useState<Record<string, Envio>>({});
  const [resultadosHoy, setResultadosHoy] = React.useState<Record<string, string>>({});
  const [toques, setToques] = React.useState<Record<string, Toque[]>>(TOQUES_INICIALES);
  const [tareas, setTareas] = React.useState<Record<string, Tarea>>({});
  const [campanas, setCampanas] = usePersistido<Campana[]>('campanas', CAMPANAS);
  const [bitacora, setBitacora] = React.useState<Gestion[]>([]);
  const [pagos, setPagos] = React.useState<Pago[]>(PAGOS_INICIALES);
  const [noReconocidos, setNoReconocidos] = React.useState<NoReconocido[]>([]);
  const [erp, setErp] = React.useState({ ultima: 'hoy 06:00', sincronizado: false });
  const [zipCargado, setZipCargado] = React.useState(false);
  const [csvCargado, setCsvCargado] = React.useState(false);
  const [planesIniciados, setPlanesIniciados] = React.useState<Record<string, string>>({});
  const [facturasNuevas, setFacturasNuevas] = React.useState<Record<string, Factura[]>>({});
  // Cartera real (GET /receivables/portfolio). undefined = cargando; null = sin conexión.
  const [real, setReal] = React.useState<PortfolioCustomer[] | null | undefined>(undefined);
  const recargarCartera = React.useCallback(async () => {
    try {
      setReal(await api.getPortfolio());
    } catch {
      setReal((prev) => prev ?? null);
    }
  }, []);
  React.useEffect(() => {
    void recargarCartera();
  }, [recargarCartera]);
  const fuente: Store['fuente'] = real === undefined ? 'cargando' : real && real.length > 0 ? 'real' : 'ejemplo';
  const base = React.useMemo(() => (real && real.length > 0 ? real.map(cuentaDesdeApi) : CARTERA), [real]);

  const [agentesReales, setAgentesReales] = React.useState<AgenteReal[] | null>(null);
  React.useEffect(() => {
    api
      .getUsers()
      .then((us) =>
        setAgentesReales(
          us
            .filter((u) => u.role === 'CORPORATE_USER' || u.role === 'CORPORATE_ADMIN' || u.operationalProfile === 'AGENTE_EJECUTIVO')
            .map((u) => ({ id: u.id, nombre: u.name, activo: u.status !== 'INACTIVE' && u.status !== 'DISABLED' })),
        ),
      )
      .catch(() => setAgentesReales(null));
  }, []);

  // Lo que pasó por WhatsApp (real). undefined = aún cargando; null = sin conexión.
  const [wa, setWa] = React.useState<WaPlanActivity | null | undefined>(undefined);

  const refrescarWhatsapp = React.useCallback(async () => {
    try {
      setWa(await api.getWaPlanActivity());
    } catch {
      // Si ya había datos se conservan (un fallo momentáneo no borra la vista);
      // si nunca cargó, queda como "sin conexión" (no como "no existe").
      setWa((prev) => prev ?? null);
    }
  }, []);
  React.useEffect(() => {
    void refrescarWhatsapp();
  }, [refrescarWhatsapp]);

  // Modo de envío del plan por niveles (lo comparten administrador y agentes).
  const [envioAutomatico, setEnvioAutomatico] = React.useState<boolean | null | undefined>(undefined);
  React.useEffect(() => {
    api
      .getLevelPlan()
      .then((r) => setEnvioAutomatico(r.policy ? r.policy.autoSend : false))
      .catch(() => setEnvioAutomatico(null));
  }, []);
  const cambiarEnvioAutomatico = React.useCallback(async (auto: boolean) => {
    const r = await api.setLevelPlanAutoSend(auto);
    setEnvioAutomatico(r.policy.autoSend);
  }, []);

  const cartera: CuentaViva[] = React.useMemo(
    () =>
      base.map((c) => {
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
        // WhatsApp real: cada nivel enviado queda hecho con lo que pasó.
        const pasosEnviados: string[] = [];
        const actividad = wa?.customers.find((x) => x.name === c.cliente);
        for (const [plantilla, nivel] of Object.entries(actividad?.levels ?? {})) {
          const paso = PASO_DE_PLANTILLA[plantilla];
          if (!paso || !nivel) continue;
          pasosEnviados.push(paso);
          res[paso] = resultadoWhatsapp(nivel as NivelWa, !!wa?.testMode);
        }
        // El saldo sale de sumar los pagos aplicados (ERP y/o REP).
        const pagado = pagos.filter((p) => p.cuentaId === c.id).reduce((a, p) => a + p.monto, 0);
        return {
          ...c,
          pasosEnviados,
          pagado,
          saldada: c.monto - pagado <= 1, // tolerancia de centavos
          facturas: [
            { dbId: c.facturaDbId, folio: c.folio, monto: c.monto, emision: c.emision, vence: c.vence, dias: c.dias, planInicio: c.planInicio, principal: true, pagado },
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
    [base, agentes, contactos, segManual, envios, resultadosHoy, pagos, planesIniciados, facturasNuevas, wa],
  );

  const anotar = (c: CuentaViva, r: Resultado, monto?: number) =>
    setBitacora((b) => [...b, { ...gestion(HOY, HORA_ACTUAL, c.cliente, r, monto, c), agente: c.agente }]);

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
    tiposDeudor,
    guardarTiposDeudor: setTiposDeudor,
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
      if (!cartera.some((x) => x.id === CSV_SIM.pago.cuentaId) || !cartera.some((x) => x.id === CSV_SIM.facturaNueva.cuentaId)) return 'Simulación de ejemplo: funciona con los clientes de prueba del prototipo.';
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
      if (!cartera.some((x) => x.id === SYNC_ERP_SIM.cuentaId)) return 'Simulación de ejemplo: funciona con los clientes de prueba del prototipo.';
      setPagos((ps) => [SYNC_ERP_SIM, ...ps]);
      const c = cartera.find((x) => x.id === SYNC_ERP_SIM.cuentaId)!;
      anotar(c, 'Pagó', SYNC_ERP_SIM.monto);
      return `1 pago nuevo: ${c.cliente} pagó $60,000. Queda saldo de $66,300 y la cobranza sigue sobre eso.`;
    },
    // ZIP de REP: cada complemento se empata por UUID con su factura.
    subirRep: () => {
      if (zipCargado) return 'Ese ZIP ya se había procesado: no se duplicó ningún pago.';
      if (!cartera.some((x) => x.id === ZIP_REP_SIM.nuevo.cuentaId)) return 'Simulación de ejemplo: funciona con los clientes de prueba del prototipo.';
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
    reasignar: (id, agente) => {
      setAgentes((a) => ({ ...a, [id]: agente }));
      // Cartera real: se guarda en la base si el agente es un usuario real.
      const c = cartera.find((x) => x.id === id);
      const u = agentesReales?.find((x) => x.nombre === agente);
      if (c?.dbId && u) void api.updateCustomer(c.dbId, { assignedAgentId: u.id }).catch(() => undefined);
    },
    agentesReales,
    editarCliente: async (id, cambios) => {
      const c = cartera.find((x) => x.id === id);
      if (!c?.dbId) return ES_EJEMPLO;
      try {
        await api.updateCustomer(c.dbId, cambios);
        // Si cambió el contacto de finanzas, la copia local ya no aplica.
        setContactos((m) => {
          const out = { ...m };
          delete out[id];
          return out;
        });
        await Promise.all([recargarCartera(), refrescarWhatsapp()]);
        return null;
      } catch (e) {
        return msg(e, 'No se pudo guardar el cliente.');
      }
    },
    crearCliente: async (datos) => {
      try {
        await api.createCustomer(datos);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo crear el cliente.');
      }
    },
    eliminarCliente: async (id) => {
      const c = cartera.find((x) => x.id === id);
      if (!c?.dbId) return ES_EJEMPLO;
      try {
        await api.deleteCustomer(c.dbId);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo eliminar el cliente.');
      }
    },
    restaurarCliente: async (dbId) => {
      try {
        await api.restoreCustomer(dbId);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo recuperar el cliente.');
      }
    },
    pausarContacto: async (id, pausar, motivo) => {
      const c = cartera.find((x) => x.id === id);
      if (!c?.dbId) return ES_EJEMPLO;
      try {
        await api.updateCustomer(
          c.dbId,
          pausar ? { doNotContact: true, doNotContactReason: motivo?.trim() || 'Pausado por el equipo' } : { doNotContact: false },
        );
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo cambiar el contacto.');
      }
    },
    cobrarFactura: async (facturaDbId, fecha, referencia) => {
      try {
        await api.updateReceivableStatus(facturaDbId, 'PAID', referencia?.trim() || 'Cobro registrado en Cobranza IA', fecha);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo registrar el cobro.');
      }
    },
    cancelarFactura: async (facturaDbId, motivo) => {
      try {
        await api.updateReceivableStatus(facturaDbId, 'REJECTED', motivo);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo cancelar la factura.');
      }
    },
    revertirCobro: async (facturaDbId, motivo) => {
      try {
        await api.updateReceivableStatus(facturaDbId, 'PENDING', motivo);
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo revertir el cobro.');
      }
    },
    crearFactura: async (id, f) => {
      const c = cartera.find((x) => x.id === id);
      if (!c?.dbId) return ES_EJEMPLO;
      try {
        // El total trae IVA (16%): se separa para el registro fiscal.
        const subtotal = Math.round((f.total / 1.16) * 100) / 100;
        await api.createReceivable({
          customerId: c.dbId,
          cfdiUuid: f.uuid.trim(),
          folio: f.folio.trim() || undefined,
          subtotal,
          iva: Math.round((f.total - subtotal) * 100) / 100,
          total: f.total,
          date: f.fecha,
          dueDate: f.vence || undefined,
        });
        await recargarCartera();
        return null;
      } catch (e) {
        return msg(e, 'No se pudo agregar la factura.');
      }
    },
    agregarContacto: async (id, f) => {
      const cuenta = cartera.find((x) => x.id === id);
      if (cuenta?.dbId) {
        // WhatsApp exige formato internacional: 10 dígitos de México → +52…
        const digitos = f.telefono.replace(/\D/g, '');
        const telefono = normalizarTelefono(f.telefono) || `+${digitos}`;
        try {
          await api.updateCustomer(cuenta.dbId, { financeContactName: f.nombre, financeContactPhone: telefono });
          await Promise.all([recargarCartera(), refrescarWhatsapp()]);
        } catch (e) {
          return e instanceof Error ? e.message : 'No se pudo guardar el contacto.';
        }
      }
      setContactos((c) => ({ ...c, [id]: f }));
      return null;
    },
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
          fecha: new Date().toISOString().slice(0, 10),
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
      // Editar o reanudar una campaña que ya salió no la vuelve a enviar.
      const previa = campanas.find((x) => x.id === c.id);
      const yaEnviada = (previa?.enviados ?? 0) > 0 || previa?.estado === 'Activa';
      const final = c.estado === 'Activa' && c.config.inicio <= HOY && !yaEnviada ? lanzar(c) : c;
      setCampanas((cs) =>
        previa ? cs.map((x) => (x.id === c.id ? final : x)) : [final, ...cs],
      );
    },
    eliminarCampana: (id) => {
      const index = campanas.findIndex((x) => x.id === id);
      setCampanas((cs) => cs.filter((x) => x.id !== id));
      return index;
    },
    restaurarCampana: (c, index) =>
      setCampanas((cs) => {
        if (cs.some((x) => x.id === c.id)) return cs;
        const out = [...cs];
        out.splice(Math.max(0, Math.min(index, out.length)), 0, c);
        return out;
      }),
    cambiarEstadoCampana: (id, estado) => {
      const camp = campanas.find((x) => x.id === id);
      if (!camp) return;
      let upd: Campana = { ...camp, estado };
      // Solo se envía la primera vez; reanudar una pausa no repite los mensajes.
      if (estado === 'Activa' && camp.config.inicio <= HOY && camp.enviados === 0) upd = lanzar(upd);
      setCampanas((cs) => cs.map((x) => (x.id === id ? upd : x)));
    },
    waClienteId: (cliente) =>
      wa === undefined
        ? undefined
        : wa === null
          ? 'error'
          : (wa.customers.find((x) => x.name === cliente)?.customerId ?? null),
    refrescarWhatsapp,
    envioAutomatico,
    cambiarEnvioAutomatico,
    fuente,
    recargarCartera,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** El estado si hay un <CobranzaProvider> arriba, o null (para no crear uno duplicado). */
export function useCobranzaOpcional(): Store | null {
  return React.useContext(Ctx);
}

export function useCobranza(): Store {
  const s = React.useContext(Ctx);
  if (!s) throw new Error('useCobranza debe usarse dentro de <CobranzaProvider>');
  return s;
}

/** Plan calculado de una cuenta (con su segmento y lo enviado/registrado hoy). */
export function planCuenta(c: CuentaViva) {
  return construirPlan({ ...planConfig(c, c.segmento), enviados: c.pasosEnviados });
}

type NivelWa = WaPlanActivity['customers'][number]['levels'][string];

/** Resultado del paso a partir de lo que pasó en WhatsApp (corto, para el plan). */
function resultadoWhatsapp(nivel: NivelWa, prueba: boolean): string {
  const r = nivel.reply;
  if (r?.kind === 'BUTTON') return r.body.startsWith('Ya pagué') ? 'Dice que ya pagó' : `Tocó "${r.body}"`;
  if (r?.kind === 'MEDIA') return 'Mandó un archivo';
  if (r) return `Respondió: "${r.body.length > 48 ? `${r.body.slice(0, 48)}…` : r.body}"`;
  const dia = new Date(nivel.sentAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `Enviado por WhatsApp ${dia}${prueba && !nivel.delivered ? ' (prueba)' : ''}`;
}

/** Plantilla usada en un toque de campaña. */
export const plantillaPorId = (id: string) => PLANTILLAS.find((p) => p.id === id);
