import type { FunctionDeclaration } from '@google-cloud/vertexai';

/**
 * Catálogo de herramientas que Gemini puede invocar durante una conversación.
 *
 * IMPORTANTE — multi-tenant: ninguna herramienta recibe `organizationId` como
 * parámetro. El backend lo inyecta SIEMPRE desde el JWT al ejecutar la
 * herramienta (ver AiToolsService.execute), de modo que el modelo no puede
 * pedir datos de otra organización aunque "alucine" un id.
 *
 * Los tipos del SDK (`SchemaType`) son un string-enum; para no forzar la carga
 * del paquete @google-cloud/vertexai en el arranque (se importa dinámicamente),
 * declaramos los schemas como objetos planos y casteamos una sola vez.
 */
const T = {
  STRING: 'string',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
} as const;

const INVOICE_STATUSES = [
  'PENDING',
  'AUDITED',
  'APPROVED',
  'PAID',
  'REJECTED',
];
const FORENSIC_STATUSES = ['PENDING', 'VALIDATED', 'DISCREPANCY', 'BLOCKED'];
const PAYMENT_STATUSES = ['SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED'];
const FACTORAJE_STATUSES = ['PENDING', 'APPROVED', 'DISBURSED', 'REJECTED'];

const limitParam = {
  type: T.INTEGER,
  description: 'Máximo de registros a devolver (1-50, por defecto 20).',
};

export const AI_TOOL_DECLARATIONS = [
  {
    name: 'get_dashboard_overview',
    description:
      'Resumen general de cuentas por pagar de la organización: conteo de ' +
      'facturas por estado, montos facturado/pagado/pendiente, número de ' +
      'proveedores (totales y aprobados) y estado de factoraje. Úsala para ' +
      'preguntas generales tipo "cómo vamos" o "resumen del mes".',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_aging_report',
    description:
      'Reporte de antigüedad de saldos (aging de CxP). Clasifica las facturas ' +
      'no pagadas en cubetas por días vencidos (vigente, 1-30, 31-60, 61-90, ' +
      '90+) e incluye el desglose por proveedor. Úsala para preguntas sobre ' +
      'vencimientos, deuda atrasada o cuánto se debe.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_invoices',
    description:
      'Lista facturas de la organización, de la más reciente a la más antigua. ' +
      'Permite filtrar por estado, estado forense y proveedor.',
    parameters: {
      type: T.OBJECT,
      properties: {
        status: {
          type: T.STRING,
          enum: INVOICE_STATUSES,
          description: 'Filtra por estado de la factura.',
        },
        forensicStatus: {
          type: T.STRING,
          enum: FORENSIC_STATUSES,
          description: 'Filtra por resultado de la auditoría forense.',
        },
        supplierId: {
          type: T.STRING,
          description: 'UUID del proveedor para filtrar sus facturas.',
        },
        limit: limitParam,
      },
    },
  },
  {
    name: 'get_suppliers',
    description:
      'Lista proveedores de la organización con su score de confiabilidad, ' +
      'estado de aprobación, categoría y capital. Permite filtrar por ' +
      'aprobados/no aprobados y buscar por nombre o RFC.',
    parameters: {
      type: T.OBJECT,
      properties: {
        approved: {
          type: T.BOOLEAN,
          description:
            'true = solo aprobados, false = solo NO aprobados. Omitir = todos.',
        },
        search: {
          type: T.STRING,
          description: 'Texto a buscar en el nombre, razón social o RFC.',
        },
        limit: limitParam,
      },
    },
  },
  {
    name: 'get_supplier_detail',
    description:
      'Detalle de un proveedor específico: datos generales, score, conteo de ' +
      'documentos KYC, resumen de sus facturas por estado y monto total, y ' +
      'solicitudes de factoraje. Requiere el UUID del proveedor.',
    parameters: {
      type: T.OBJECT,
      properties: {
        supplierId: {
          type: T.STRING,
          description: 'UUID del proveedor.',
        },
      },
      required: ['supplierId'],
    },
  },
  {
    name: 'get_payments',
    description:
      'Lista pagos (lotes de pago) de la organización con su monto total, ' +
      'estado, ruta y número de facturas incluidas. Permite filtrar por estado.',
    parameters: {
      type: T.OBJECT,
      properties: {
        status: {
          type: T.STRING,
          enum: PAYMENT_STATUSES,
          description: 'Filtra por estado del pago.',
        },
        limit: limitParam,
      },
    },
  },
  {
    name: 'get_audit_summary',
    description:
      'Resumen de la pestaña de AUDITORÍA. Incluye el resultado de la auditoría ' +
      'forense de facturas por estado (validadas, con discrepancia, bloqueadas, ' +
      'pendientes) con conteos y montos, el monto total en riesgo, las facturas ' +
      'de mayor riesgo, y el cumplimiento de complementos de pago REP (cuántas ' +
      'facturas PPD están pendientes del complemento). Úsala para preguntas ' +
      'sobre auditoría, riesgo, facturas bloqueadas/sospechosas o cumplimiento REP.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_financial_statements',
    description:
      'Pestaña de HISTORIAL → Estados Financieros. Lista los estados de ' +
      'resultados generados por período (ingresos, costos, gastos de operación ' +
      'y utilidad neta), del más reciente al más antiguo. Úsala para preguntas ' +
      'sobre resultados, utilidad, ingresos o desempeño financiero por período.',
    parameters: {
      type: T.OBJECT,
      properties: {
        limit: {
          type: T.INTEGER,
          description: 'Máximo de períodos a devolver (1-50, por defecto 12).',
        },
      },
    },
  },
  {
    name: 'get_activity_log',
    description:
      'Pestaña de HISTORIAL → bitácora de actividad. Devuelve los eventos ' +
      'recientes de la organización (acción realizada, entidad afectada, ' +
      'usuario y fecha). Úsala para preguntas sobre qué ha pasado últimamente, ' +
      'auditoría de acciones o historial de cambios.',
    parameters: {
      type: T.OBJECT,
      properties: {
        limit: {
          type: T.INTEGER,
          description: 'Máximo de eventos a devolver (1-50, por defecto 20).',
        },
      },
    },
  },
  {
    name: 'get_financial_ratios',
    description:
      'Razones financieras de cuentas por pagar (la pestaña de Contabilidad). ' +
      'Incluye: DPO (días promedio de pago a proveedores), puntualidad de pago ' +
      '(% de facturas pagadas a tiempo), rotación de CxP, concentración de los ' +
      'principales proveedores, costo del factoraje y ahorro generado por la ' +
      'auditoría forense (montos bloqueados/con discrepancia). Úsala para ' +
      'preguntas de análisis financiero, salud de la CxP, KPIs o indicadores.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_factoraje_requests',
    description:
      'Lista solicitudes de factoraje de la organización con monto solicitado, ' +
      'comisión, neto, estado y el proveedor que la solicitó.',
    parameters: {
      type: T.OBJECT,
      properties: {
        status: {
          type: T.STRING,
          enum: FACTORAJE_STATUSES,
          description: 'Filtra por estado de la solicitud de factoraje.',
        },
        limit: limitParam,
      },
    },
  },

  // ── Herramientas de CxC / cobranza (AR / collections) ──────────

  {
    name: 'get_receivables_aging_report',
    description:
      'Reporte de antigüedad de saldos POR COBRAR (aging de CxC). Clasifica ' +
      'las facturas de venta pendientes de cobro en cubetas por días vencidos ' +
      '(vigente, 1-30, 31-60, 61-90, 90+) e incluye el desglose por cliente, ' +
      'con el monto total y vencido de cada uno. Úsala para preguntas sobre ' +
      'cuánto le deben a la organización, qué tan vencida está la cartera, o ' +
      'qué clientes concentran más saldo pendiente.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_at_risk_customers',
    description:
      'Lista los clientes en riesgo de impago: aquellos con morosidad actual ' +
      '(varias facturas vencidas o una con atraso significativo) combinada con ' +
      'mal historial de puntualidad o sin historial de pagos. Incluye el motivo ' +
      'explícito, el monto vencido y el % histórico de pagos a tiempo de cada ' +
      'cliente. Úsala para identificar a quién priorizar en la estrategia de ' +
      'cobranza o a quién conviene escalar.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_ranked_customers',
    description:
      'Ranking de todos los clientes con historial de pagos, del mejor al peor ' +
      'pagador: % de facturas cobradas a tiempo, atraso promedio en días de las ' +
      'facturas tardías y volumen total pagado. Úsala para calibrar el tono de ' +
      'la comunicación de cobranza (firme vs. flexible) según el comportamiento ' +
      'histórico real de cada cliente, o para preguntas sobre cuáles clientes ' +
      'pagan mejor o peor.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_reminder_effectiveness',
    description:
      'Efectividad de los recordatorios de cobranza enviados a clientes: ' +
      'cuántas facturas cobradas tuvieron un recordatorio previo (cobertura), ' +
      'el promedio de días entre el último recordatorio y el pago, y el total ' +
      'de recordatorios enviados. Úsala para preguntas sobre si los ' +
      'recordatorios de cobranza están funcionando.',
    parameters: { type: T.OBJECT, properties: {} },
  },
  {
    name: 'get_cash_conversion_cycle',
    description:
      'Ciclo de conversión de efectivo (CCC = DSO − DPO), incluyendo el DSO ' +
      '(días promedio de cobro) y el DPO (días promedio de pago) vigentes, con ' +
      'una interpretación de si la operación se autofinancia o no. Úsala para ' +
      'preguntas sobre DSO, salud del flujo de efectivo o comparación entre lo ' +
      'que tarda en cobrar vs. lo que tarda en pagar.',
    parameters: { type: T.OBJECT, properties: {} },
  },
] as unknown as FunctionDeclaration[];
