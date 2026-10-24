import type { PortfolioCustomer } from '../../../../services/apiClient.ts';
import { CARTERA, type Agente, type CuentaCartera, type Factura } from './mockV1.ts';

/**
 * Traduce la cartera REAL del backend (GET /receivables/portfolio) al
 * formato que ya usan todas las pestañas de Cobranza IA, para no tocar las
 * pantallas: lo real (clientes, facturas pendientes, contacto de finanzas,
 * agente, historial de pagos → segmento y plan) viene del backend.
 *
 * Lo que aún no tiene backend (ciudad, línea de negocio, campañas en las que
 * pagó, negociaciones) se toma del prototipo SOLO para los clientes de
 * prueba (externalId "demo:kNN", ver api/scripts/seed-cobranza-demo.ts); un
 * cliente real nuevo lleva valores neutros. El id de los de prueba se
 * conserva ("k01"…) para que pagos y campañas de ejemplo sigan ligados.
 */

const DIA = 86_400_000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "17 ago" (formato del prototipo). Fechas de calendario → UTC. */
function fechaCorta(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** Días respecto al vencimiento (positivo = vencida hace N días). */
function diasDe(dueDate: string | null, hoy: number): number {
  if (!dueDate) return 0;
  return Math.round((hoy - new Date(dueDate).getTime()) / DIA);
}

/** Hora actual en la Ciudad de México ("11:24"). */
function horaCdmx(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });
}

export function cuentaDesdeApi(p: PortfolioCustomer): CuentaCartera {
  const ahora = new Date();
  const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const demoId = p.externalId?.startsWith('demo:') ? p.externalId.slice(5) : null;
  const demo = demoId ? CARTERA.find((c) => c.id === demoId) : undefined;

  const [principal, ...otras] = p.pending;
  const telefono = p.financeContactPhone ?? null;

  const extras: Factura[] = otras.map((f) => ({
    folio: f.folio,
    monto: f.total,
    emision: fechaCorta(f.date),
    vence: fechaCorta(f.dueDate),
    dias: diasDe(f.dueDate, hoy),
    // Igual que en el prototipo: las facturas adicionales arrancan su plan
    // cuando alguien da "Iniciar plan".
    planInicio: null,
  }));

  return {
    // Campos que no tienen backend todavía: del prototipo (solo clientes de
    // prueba) o neutros.
    ciudad: '—',
    zona: 'UTC-6',
    linea: 'Servicios',
    promesas: { cumplidas: 0, rotas: 0 },
    ...(demo
      ? {
          ciudad: demo.ciudad,
          zona: demo.zona,
          linea: demo.linea,
          promesas: demo.promesas,
          promesa: demo.promesa,
          disputa: demo.disputa,
          cuentaGrande: demo.cuentaGrande,
          aclaraciones: demo.aclaraciones,
          campanasPagadas: demo.campanasPagadas,
          negociaciones: demo.negociaciones,
        }
      : {}),

    // Real (backend)
    id: demoId ?? p.id,
    dbId: p.id,
    cliente: p.name,
    folio: principal?.folio ?? '—',
    monto: principal?.total ?? 0,
    pagado: 0,
    dias: diasDe(principal?.dueDate ?? null, hoy),
    vence: fechaCorta(principal?.dueDate ?? null),
    emision: fechaCorta(principal?.date ?? null),
    planInicio: fechaCorta(principal?.date ?? null),
    agente: (p.agent?.name ?? 'Sin asignar') as Agente,
    registrado: p.contact ?? p.name,
    finanzas:
      p.financeContactName || telefono
        ? { nombre: p.financeContactName ?? 'Finanzas', puesto: 'Finanzas', telefono: telefono ?? '' }
        : null,
    horaLocal: horaCdmx(),
    contactable: !p.doNotContact,
    motivo: p.doNotContact ? (p.doNotContactReason ?? 'Pidió no ser contactado') : undefined,
    canal: telefono || p.phone ? 'WhatsApp' : 'Correo',
    facturasExtra: extras,
    historial: p.history,
    // Los resultados de cada etapa salen de lo que pasó por WhatsApp (store).
    resultados: {},
  };
}
