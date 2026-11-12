import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowRight, BellOff, Check, Clock, Eye, RotateCcw, Siren } from 'lucide-react';
import { CURRENCY_FORMATTER } from '../../../../utils/format.ts';
import { saldoDe } from './mockV1.ts';
import { planCuenta, useCobranza, type CuentaViva } from './store.tsx';
import { PLANTILLA_DE_PASO } from './plan.tsx';
import { telefonosRepetidos } from './clientes.tsx';
import { SPRING } from './campanasUi.tsx';
import { Subpestanas, Vacio } from './vidrio.tsx';

// Alertas de Cobranza IA: se calculan de la cartera (no son fijas) y cada
// una trae qué hacer. Se pueden marcar como atendidas o posponer; si cambia
// lo que la causa (ej. otro cliente se queda sin contacto), vuelve a salir.

export type Severidad = 'critica' | 'alta' | 'media';
export type Destino = 'datos' | 'campanas' | 'pagos' | 'segmentos';
/** Parte del expediente donde se resuelve una alerta de cliente. */
export type SubCliente = 'facturas' | 'plan' | 'whatsapp' | 'historial' | 'riesgo';

/** Lo que hace el botón principal de la alerta. */
export type Accion =
  | { tipo: 'ir'; destino: Destino; texto: string }
  | { tipo: 'cliente'; cliente: string; sub: SubCliente; texto: string };

export type Alerta = {
  id: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  cuando: string;
  /** Clientes involucrados (para "Ver cliente"). */
  clientes: string[];
  /** Saldo en juego de esos clientes. */
  monto: number;
  accion?: Accion;
  /** Ejemplo para conocer el flujo (sin datos reales detrás). */
  ejemplo?: boolean;
};

const lista = (nombres: string[], max = 3) =>
  nombres.length <= max ? nombres.join(', ') : `${nombres.slice(0, max).join(', ')} y ${nombres.length - max} más`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const dinero = (n: number) => CURRENCY_FORMATTER.format(n);

/**
 * Alertas específicas calculadas de la cartera y su plan: qué pasó, con
 * quién, cuánto está en juego y el botón que lo resuelve. Con datos de
 * ejemplo se agregan las que en producción llegan del WhatsApp y los pagos.
 */
function calcular(cartera: CuentaViva[], demo: boolean, envioAutomatico: boolean | null | undefined): Alerta[] {
  const abiertas = cartera.filter((c) => !c.saldada);
  const out: Alerta[] = [];
  const suma = (xs: CuentaViva[]) => xs.reduce((a, c) => a + saldoDe(c), 0);
  const add = (a: Omit<Alerta, 'monto' | 'clientes'> & { de: CuentaViva[] }) => {
    const { de, ...resto } = a;
    out.push({ ...resto, clientes: de.map((c) => c.cliente), monto: suma(de) });
  };

  // ── Críticas ──
  // 1. El mensaje de hoy no ha salido (y por qué).
  const conPaso = abiertas.map((c) => ({ c, paso: planCuenta(c).actual })).filter(({ c, paso }) => paso && PLANTILLA_DE_PASO[paso.id] && c.contactable);
  if (conPaso.length) {
    const sinTel = conPaso.filter(({ c }) => !c.finanzas?.telefono);
    const porAprobar = conPaso.filter(({ c }) => c.finanzas?.telefono);
    const motivo = [
      porAprobar.length && !envioAutomatico ? `${porAprobar.length} esperan tu aprobación` : porAprobar.length ? `${porAprobar.length} salen a las 11:00` : '',
      sinTel.length ? `${sinTel.length} sin teléfono` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const primero = (porAprobar[0] ?? conPaso[0]).c;
    add({
      id: 'plan-sin-salir',
      severidad: envioAutomatico && !sinTel.length ? 'alta' : 'critica',
      titulo: `${plural(conPaso.length, 'cliente debía', 'clientes debían')} recibir su mensaje de hoy y no ha salido`,
      detalle: `${lista(conPaso.map(({ c, paso }) => `${c.cliente} (${paso!.etiqueta})`))}. ${motivo}.`,
      cuando: 'Hoy',
      de: conPaso.map(({ c }) => c),
      accion: { tipo: 'cliente', cliente: primero.cliente, sub: 'whatsapp', texto: 'Aprobar y mandar' },
    });
  }

  // 2. Hoy toca llamada.
  const llamadas = abiertas.filter((c) => planCuenta(c).actual?.canal === 'Llamada');
  if (llamadas.length)
    add({
      id: 'toca-llamada',
      severidad: 'critica',
      titulo: `Hoy toca llamarle a ${plural(llamadas.length, 'cliente', 'clientes')}`,
      detalle: `${lista(llamadas.map((c) => `${c.cliente} → ${c.agente}`))}. Es la etapa de negociación: un mensaje ya no basta.`,
      cuando: 'Hoy',
      de: llamadas,
      accion: { tipo: 'cliente', cliente: llamadas[0].cliente, sub: 'plan', texto: 'Ver guion de llamada' },
    });

  // 3. Más de 90 días.
  const graves = abiertas.filter((c) => c.dias >= 90);
  if (graves.length)
    add({
      id: 'mas-90',
      severidad: 'critica',
      titulo: `${plural(graves.length, 'cliente lleva', 'clientes llevan')} más de 90 días vencidos`,
      detalle: `${lista(graves.map((c) => `${c.cliente} (${c.dias} días)`))}. Después de 200 días se considera incobrable: hay que negociar ya.`,
      cuando: 'Hoy',
      de: graves,
      accion: { tipo: 'cliente', cliente: graves[0].cliente, sub: 'plan', texto: 'Ver cliente' },
    });

  // ── Altas ──
  // 4. Se está retrasando: cada mes paga más tarde.
  const retrasan = abiertas.filter((c) => {
    const h = c.historial.slice(-3);
    return h.length === 3 && h[0] < h[1] && h[1] < h[2] && h[2] > 5;
  });
  if (retrasan.length) {
    const c0 = retrasan[0];
    const h = c0.historial.slice(-3);
    add({
      id: 'se-retrasa',
      severidad: 'alta',
      titulo: retrasan.length === 1 ? `${c0.cliente} paga cada mes más tarde` : `${retrasan.length} clientes pagan cada mes más tarde`,
      detalle: `${c0.cliente} se atrasó ${h[0]}, luego ${h[1]} y ahora ${h[2]} días.${retrasan.length > 1 ? ` También ${lista(retrasan.slice(1).map((c) => c.cliente))}.` : ''} Conviene entender qué cambió antes de presionar.`,
      cuando: 'Esta semana',
      de: retrasan,
      accion: { tipo: 'cliente', cliente: c0.cliente, sub: 'riesgo', texto: 'Ver su historial' },
    });
  }

  // 5. No contesta: los últimos 3 mensajes sin respuesta.
  const ignoran = abiertas.filter((c) => {
    const hechos = planCuenta(c).pasos.filter((p) => p.estado === 'hecho' && p.resultado);
    return hechos.length >= 3 && hechos.slice(-3).every((p) => /sin respuesta/i.test(p.resultado!));
  });
  if (ignoran.length)
    add({
      id: 'no-contesta',
      severidad: 'alta',
      titulo: `${plural(ignoran.length, 'cliente no contesta', 'clientes no contestan')} sus últimos 3 mensajes`,
      detalle: `${lista(ignoran.map((c) => c.cliente))}. Por ese canal ya no responde: prueba llamada o correo.`,
      cuando: 'Esta semana',
      de: ignoran,
      accion: { tipo: 'cliente', cliente: ignoran[0].cliente, sub: 'plan', texto: 'Cambiar de canal' },
    });

  // 6. Disputa abierta.
  const disputas = abiertas.filter((c) => c.segmento === 'disputa');
  if (disputas.length)
    add({
      id: 'disputa',
      severidad: 'alta',
      titulo: `${plural(disputas.length, 'aclaración abierta', 'aclaraciones abiertas')} frenan el cobro`,
      detalle: `${lista(disputas.map((c) => c.cliente))}. Mientras siga abierta no se le cobra: resuélvela para reactivar su plan.`,
      cuando: 'Esta semana',
      de: disputas,
      accion: { tipo: 'cliente', cliente: disputas[0].cliente, sub: 'facturas', texto: 'Ver la aclaración' },
    });

  // 7. Facturas sin plan.
  const sinPlan = abiertas.filter((c) => c.facturas.some((f) => !f.planInicio));
  if (sinPlan.length)
    add({
      id: 'sin-plan',
      severidad: 'alta',
      titulo: `${plural(sinPlan.length, 'cliente tiene', 'clientes tienen')} facturas sin plan de cobro`,
      detalle: `${lista(sinPlan.map((c) => c.cliente))}. Nadie les recuerda esas facturas hasta que inicies su plan.`,
      cuando: 'Esta semana',
      de: sinPlan,
      accion: { tipo: 'cliente', cliente: sinPlan[0].cliente, sub: 'facturas', texto: 'Iniciar plan' },
    });

  // 8. Teléfono repetido.
  const repetidos = [...telefonosRepetidos(cartera).values()];
  if (repetidos.length) {
    const nombres = new Set(repetidos.flat());
    add({
      id: 'telefono-repetido',
      severidad: 'alta',
      titulo: `${plural(repetidos.length, 'teléfono está', 'teléfonos están')} en más de un cliente`,
      detalle: `${repetidos.map((g) => g.join(' y ')).join(' · ')}. Las respuestas de WhatsApp pueden quedar en el cliente equivocado.`,
      cuando: 'Esta semana',
      de: cartera.filter((c) => nombres.has(c.cliente)),
      accion: { tipo: 'ir', destino: 'datos', texto: 'Corregir en Datos' },
    });
  }

  // ── Para vigilar ──
  const vencidas = abiertas.filter((c) => c.dias > 0);
  const totalVencido = suma(vencidas);
  const mayor = [...vencidas].sort((x, y) => saldoDe(y) - saldoDe(x))[0];
  if (mayor && totalVencido > 0 && saldoDe(mayor) / totalVencido >= 0.2 && vencidas.length > 2)
    add({
      id: `concentracion-${mayor.id}`,
      severidad: 'media',
      titulo: `El ${Math.round((saldoDe(mayor) / totalVencido) * 100)}% de lo vencido depende de ${mayor.cliente}`,
      detalle: `${dinero(saldoDe(mayor))} de ${dinero(totalVencido)}. Si esa cuenta se complica, el golpe es grande: dale seguimiento cercano.`,
      cuando: 'Hoy',
      de: [mayor],
      accion: { tipo: 'cliente', cliente: mayor.cliente, sub: 'riesgo', texto: 'Ver riesgo' },
    });

  const esperan = abiertas.filter((c) => c.comportamiento.esperaDescuentos);
  if (esperan.length)
    add({
      id: 'espera-descuentos',
      severidad: 'media',
      titulo: `${plural(esperan.length, 'cliente solo paga', 'clientes solo pagan')} cuando hay descuento`,
      detalle: `${lista(esperan.map((c) => c.cliente))}. Si siempre les llega oferta, aprenden a esperarla: déjalos fuera de la próxima campaña con descuento.`,
      cuando: 'Esta semana',
      de: esperan,
      accion: { tipo: 'ir', destino: 'campanas', texto: 'Revisar campañas' },
    });

  const sinFinanzas = abiertas.filter((c) => !c.finanzas);
  if (sinFinanzas.length)
    add({
      id: 'sin-finanzas',
      severidad: 'media',
      titulo: `${plural(sinFinanzas.length, 'cliente no tiene', 'clientes no tienen')} contacto de finanzas`,
      detalle: `${lista(sinFinanzas.map((c) => c.cliente))}. No reciben WhatsApp ni campañas hasta registrar a tesorería.`,
      cuando: 'Hoy',
      de: sinFinanzas,
      accion: { tipo: 'ir', destino: 'datos', texto: 'Registrar contacto' },
    });

  const pausados = vencidas.filter((c) => !c.contactable);
  if (pausados.length)
    add({
      id: 'pausados-vencidos',
      severidad: 'media',
      titulo: `${plural(pausados.length, 'cliente vencido tiene', 'clientes vencidos tienen')} el contacto en pausa`,
      detalle: `${lista(pausados.map((c) => `${c.cliente} (${c.dias} días)`))}. Nadie les escribe: revisa si la pausa sigue teniendo sentido.`,
      cuando: 'Hoy',
      de: pausados,
      accion: { tipo: 'cliente', cliente: pausados[0].cliente, sub: 'facturas', texto: 'Revisar pausa' },
    });

  // ── Las que llegan en vivo (WhatsApp y pagos): de ejemplo mientras no hay datos reales ──
  if (demo) {
    const conTel = abiertas.filter((c) => c.finanzas?.telefono && c.contactable);
    const contesto = conTel[0];
    if (contesto)
      add({
        id: 'demo-contesto',
        severidad: 'critica',
        titulo: `${contesto.finanzas!.nombre} (${contesto.cliente}) te escribió hace 20 h y nadie le ha contestado`,
        detalle: 'Quedan 4 horas para responderle libremente por WhatsApp. Después solo se le puede mandar una plantilla.',
        cuando: 'Hace 20 h',
        de: [contesto],
        accion: { tipo: 'cliente', cliente: contesto.cliente, sub: 'whatsapp', texto: 'Responder' },
        ejemplo: true,
      });
    const prometio = abiertas.filter((c) => c.dias > 0).sort((x, y) => saldoDe(y) - saldoDe(x))[1];
    if (prometio)
      add({
        id: 'demo-promesa',
        severidad: 'critica',
        titulo: `${prometio.cliente} prometió pagar ${dinero(saldoDe(prometio))} el viernes y no pagó`,
        detalle: 'Es su segunda promesa rota este trimestre. Escríbele hoy con una fecha concreta, sin tono de reclamo.',
        cuando: 'Hace 3 h',
        de: [prometio],
        accion: { tipo: 'cliente', cliente: prometio.cliente, sub: 'whatsapp', texto: 'Escribirle' },
        ejemplo: true,
      });
    const rebote = conTel[2];
    if (rebote)
      add({
        id: 'demo-rebote',
        severidad: 'critica',
        titulo: `Meta rechazó el mensaje a ${rebote.cliente}: el número no tiene WhatsApp`,
        detalle: `Se intentó enviar al ${rebote.finanzas!.telefono}. Hasta corregirlo, no le llega ningún recordatorio.`,
        cuando: 'Hace 1 h',
        de: [rebote],
        accion: { tipo: 'ir', destino: 'datos', texto: 'Corregir teléfono' },
        ejemplo: true,
      });
    add({
      id: 'demo-pago',
      severidad: 'alta',
      titulo: 'Entró un pago de $78,100.00 que no se pudo ligar a ningún cliente',
      detalle: 'Transferencia SPEI de hoy 9:42 con referencia "PAGO FACT". Asígnalo para que el plan de ese cliente se detenga.',
      cuando: 'Hoy 9:42',
      de: [],
      accion: { tipo: 'ir', destino: 'pagos', texto: 'Asignar pago' },
      ejemplo: true,
    });
  }

  const orden: Record<Severidad, number> = { critica: 0, alta: 1, media: 2 };
  return out.sort((x, y) => orden[x.severidad] - orden[y.severidad] || y.monto - x.monto);
}

type Estado = Record<string, { firma: string; hasta?: string }>;
const LLAVE = 'royaltica.cobranza.alertas';
const firmaDe = (a: Alerta) => `${a.titulo}|${a.clientes.join(',')}`;
const hoyIso = () => new Date().toISOString().slice(0, 10);

function leer(): Estado {
  try {
    return JSON.parse(window.localStorage.getItem(LLAVE) ?? '{}') as Estado;
  } catch {
    return {};
  }
}

// Estado compartido entre la pestaña (contador) y el panel.
const oyentes = new Set<() => void>();
function guardar(e: Estado) {
  try {
    window.localStorage.setItem(LLAVE, JSON.stringify(e));
  } catch {
    /* sin almacenamiento: dura la sesión */
  }
  memoria = e;
  oyentes.forEach((f) => f());
}
let memoria: Estado | null = null;

/** Alertas vigentes y atendidas. Una atendida vuelve si cambia su causa. */
export function useAlertas(_ejemplo: unknown = null) {
  const { cartera, fuente, envioAutomatico } = useCobranza();
  const [, forzar] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    oyentes.add(forzar);
    return () => {
      oyentes.delete(forzar);
    };
  }, []);
  const estado = memoria ?? (memoria = leer());
  const todas = React.useMemo(() => calcular(cartera, fuente !== 'real', envioAutomatico), [cartera, fuente, envioAutomatico]);
  const hoy = hoyIso();
  const atendida = (a: Alerta) => {
    const e = estado[a.id];
    if (!e || e.firma !== firmaDe(a)) return false;
    return e.hasta ? e.hasta > hoy : true;
  };
  return {
    vigentes: todas.filter((a) => !atendida(a)),
    atendidas: todas.filter(atendida),
    atender: (a: Alerta) => guardar({ ...estado, [a.id]: { firma: firmaDe(a) } }),
    posponer: (a: Alerta, dias = 1) => {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      guardar({ ...estado, [a.id]: { firma: firmaDe(a), hasta: d.toISOString().slice(0, 10) } });
    },
    reactivar: (a: Alerta) => {
      const out = { ...estado };
      delete out[a.id];
      guardar(out);
    },
  };
}

const BTN =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/60 ring-1 ring-brand-ink/10 text-[11.5px] font-semibold text-brand-ink/70 hover:bg-white hover:text-brand-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70';

/** Cómo se ve y se explica cada nivel de urgencia. */
const NIVEL: Record<Severidad, { titulo: string; cuando: string; rgb: string; Icono: typeof Siren }> = {
  critica: { titulo: 'Críticas', cuando: 'Atiéndelas hoy', rgb: '244 63 94', Icono: Siren },
  alta: { titulo: 'Altas', cuando: 'Esta semana', rgb: '245 158 11', Icono: AlertTriangle },
  media: { titulo: 'Para vigilar', cuando: 'Sin prisa, pero no las pierdas', rgb: '6 182 212', Icono: Eye },
};
const ORDEN_NIVEL: Severidad[] = ['critica', 'alta', 'media'];

export function AlertasPanel({
  onVerCliente,
  onIr,
}: {
  ejemplo?: unknown;
  onVerCliente: (cliente: string, sub?: SubCliente) => void;
  onIr: (destino: Destino) => void;
}) {
  const reduce = useReducedMotion();
  const { cartera } = useCobranza();
  const { vigentes, atendidas, atender, posponer, reactivar } = useAlertas();
  const saldoDeCliente = (n: string) => {
    const c = cartera.find((x) => x.cliente === n);
    return c ? saldoDe(c) : 0;
  };
  // Cada cliente cuenta una sola vez aunque aparezca en varias alertas.
  const criticas = vigentes.filter((a) => a.severidad === 'critica');
  const nombresCriticos = new Set<string>(criticas.flatMap((a) => a.clientes));
  const clientesCriticos = nombresCriticos.size;
  const enJuego = [...nombresCriticos].reduce((t: number, n: string) => t + saldoDeCliente(n), 0) + criticas.filter((a) => !a.clientes.length).reduce((t, a) => t + a.monto, 0);
  const ejecutar = (a: Alerta) => {
    if (!a.accion) return;
    if (a.accion.tipo === 'ir') onIr(a.accion.destino);
    else onVerCliente(a.accion.cliente, a.accion.sub);
  };
  const [vista, setVista] = React.useState<'pendientes' | 'atendidas'>('pendientes');
  const [nivel, setNivel] = React.useState<Severidad | null>(null);
  const base = vista === 'pendientes' ? vigentes : atendidas;
  const mostradas = nivel ? base.filter((a) => a.severidad === nivel) : base;
  const cuenta = (n: Severidad) => vigentes.filter((a) => a.severidad === n).length;

  return (
    <div className="space-y-6">
      {/* Lo que está en juego hoy, en una línea */}
      {enJuego > 0 && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[22px] bg-gradient-to-r from-rose-500/12 via-rose-500/[0.04] to-transparent ring-1 ring-rose-500/15 px-5 py-3.5"
        >
          <Siren size={18} className="text-rose-600 shrink-0" />
          <p className="text-[14px] text-brand-ink/70">
            <span className="text-[20px] font-semibold text-brand-ink tabular-nums">{dinero(enJuego)}</span> en juego en alertas críticas ·{' '}
            {plural(clientesCriticos, 'cliente', 'clientes')}
          </p>
          <span className="ml-auto text-[12px] text-brand-ink/45">Las críticas también llegan al WhatsApp de dirección (Configuración)</span>
        </motion.div>
      )}

      {/* Resumen por urgencia: también filtra */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ORDEN_NIVEL.map((n, i) => {
          const m = NIVEL[n];
          const activo = nivel === n;
          const total = cuenta(n);
          return (
            <motion.button
              key={n}
              type="button"
              onClick={() => {
                setVista('pendientes');
                setNivel(activo ? null : n);
              }}
              aria-pressed={activo}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={reduce ? undefined : { y: -3 }}
              transition={{ ...SPRING, delay: reduce ? 0 : i * 0.05 }}
              className="glass relative overflow-hidden rounded-[24px] p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
              style={activo ? { boxShadow: `0 0 0 2px rgb(${m.rgb} / 0.55), 0 16px 36px -18px rgb(${m.rgb} / 0.6)` } : undefined}
            >
              <span aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(135deg, rgb(${m.rgb} / ${activo ? 0.16 : 0.09}), transparent 65%)` }} />
              <span className="relative flex items-center justify-between">
                <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: `rgb(${m.rgb} / 0.14)`, color: `rgb(${m.rgb})` }}>
                  <m.Icono size={18} />
                </span>
                <span className="text-[34px] font-semibold tracking-tight tabular-nums text-brand-ink leading-none">{total}</span>
              </span>
              <span className="relative block text-[15px] font-semibold text-brand-ink mt-4">{m.titulo}</span>
              <span className="relative block text-[12.5px] text-brand-ink/50">{m.cuando}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Subpestanas
          grupo="alertas"
          etiqueta="Qué alertas ver"
          valor={vista}
          onChange={(v) => {
            setVista(v);
            setNivel(null);
          }}
          opciones={[
            { id: 'pendientes', nombre: 'Pendientes', n: vigentes.length, alerta: true },
            { id: 'atendidas', nombre: 'Atendidas y pospuestas', n: atendidas.length },
          ]}
        />
      </div>

      {nivel && (
        <button type="button" onClick={() => setNivel(null)} className={BTN}>
          Mostrando solo {NIVEL[nivel].titulo.toLowerCase()} · Ver todas
        </button>
      )}

      {!mostradas.length ? (
        <div className="glass rounded-[28px]">
          <Vacio
            icono={<BellOff size={20} />}
            titulo={vista === 'atendidas' ? 'No hay alertas atendidas' : 'Sin alertas pendientes'}
            detalle={vista === 'atendidas' ? 'Las que marques como atendidas o pospongas aparecen aquí.' : 'Si algo cambia en tu cartera, aparecerá aquí.'}
          />
        </div>
      ) : (
        ORDEN_NIVEL.filter((n) => mostradas.some((a) => a.severidad === n)).map((n) => {
          const m = NIVEL[n];
          const grupo = mostradas.filter((a) => a.severidad === n);
          return (
            <section key={n} aria-label={m.titulo}>
              <div className="flex items-center gap-2.5 mb-3 px-1">
                <span className="w-2 h-2 rounded-full" style={{ background: `rgb(${m.rgb})` }} />
                <h3 className="text-[15px] font-semibold text-brand-ink">{m.titulo}</h3>
                <span className="text-[12.5px] text-brand-ink/45">
                  {grupo.length} · {m.cuando.toLowerCase()}
                </span>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                <AnimatePresence initial={false}>
                  {grupo.map((a, i) => (
                    <motion.article
                      key={a.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                      transition={{ ...SPRING, delay: reduce ? 0 : i * 0.03 }}
                      className={`glass relative overflow-hidden rounded-[24px] flex flex-col ${vista === 'atendidas' ? 'opacity-75' : ''}`}
                    >
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: `rgb(${m.rgb})` }} />
                      <div className="flex-1 pl-6 pr-5 pt-5 pb-4">
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `rgb(${m.rgb} / 0.12)`, color: `rgb(${m.rgb})` }}>
                            <m.Icono size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h4 className="text-[15px] font-semibold text-brand-ink leading-snug">{a.titulo}</h4>
                              <span className="flex flex-col items-end shrink-0 mt-0.5">
                                <span className="text-[11px] text-brand-ink/40 whitespace-nowrap">{a.cuando}</span>
                                {a.ejemplo && <span className="mt-1 rounded-full bg-amber-500/12 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">Ejemplo</span>}
                              </span>
                            </div>
                            <p className="text-[13px] text-brand-ink/60 leading-relaxed mt-1">{a.detalle}</p>
                          </div>
                        </div>
                        {a.clientes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-3 pl-12">
                            {a.clientes.slice(0, 3).map((nombre) => (
                              <button key={nombre} type="button" onClick={() => onVerCliente(nombre)} className={BTN}>
                                {nombre}
                                <span className="text-brand-ink/40 tabular-nums font-normal">{dinero(saldoDeCliente(nombre))}</span>
                                <ArrowRight size={11} />
                              </button>
                            ))}
                            {a.clientes.length > 3 && <span className="text-[11.5px] text-brand-ink/40">y {a.clientes.length - 3} más</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6 pr-4 py-3 border-t border-white/70 bg-white/35">
                        {a.accion && vista === 'pendientes' && (
                          <button
                            type="button"
                            onClick={() => ejecutar(a)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-ink text-white px-4 py-2 text-[12.5px] font-semibold hover:bg-black transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/70"
                          >
                            {a.accion.texto} <ArrowRight size={12} />
                          </button>
                        )}
                        {a.monto > 0 && <span className="text-[12px] text-brand-ink/45 tabular-nums">{dinero(a.monto)} en juego</span>}
                        <span className="flex-1" />
                        {vista === 'atendidas' ? (
                          <button type="button" onClick={() => reactivar(a)} className={BTN}>
                            <RotateCcw size={12} /> Volver a pendientes
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => posponer(a, 1)} className={BTN} title="Vuelve a aparecer mañana">
                              <Clock size={12} /> Mañana
                            </button>
                            <button type="button" onClick={() => atender(a)} className={BTN} title="Se oculta hasta que cambie lo que la causa">
                              <Check size={12} /> Atendida
                            </button>
                          </>
                        )}
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
