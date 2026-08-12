// Carga sostenida sobre los endpoints de LECTURA más pesados (los que hacen
// varios groupBy/aggregate de Prisma): dashboard, aging de CxP y CxC,
// razones financieras, auditoría, factoraje y bitácora. Es la versión "a
// fondo" de scripts/stress-test/api-stress.js (que solo cubre health +
// invoices/payments/suppliers a bajo volumen).
//
// Uso:
//   k6 run -e BASE_URL=http://localhost:8080 -e AUTH_TOKEN=xxx scripts/stress-test/read-endpoints-load.js
//
// Corre esto contra LOCAL o staging primero. Contra producción, empieza con
// pocos VUs (edita STAGES abajo) y en horario de bajo tráfico: son queries
// reales contra Postgres, no mocks.
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.AUTH_TOKEN || '';
const errorRate = new Rate('errors');

if (!TOKEN) {
  throw new Error('Falta AUTH_TOKEN: este script necesita un JWT válido con organización.');
}

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 15 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 60 }, // pico: ajusta a la baja si es contra producción
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.05'],
  },
};

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const ENDPOINTS = [
  ['/dashboard', 'Dashboard overview'],
  ['/dashboard/aging', 'Aging CxP'],
  ['/dashboard/financial-ratios', 'Razones financieras'],
  ['/dashboard/receivables/aging', 'Aging CxC'],
  ['/dashboard/receivables/ratios', 'Razones CxC'],
  ['/dashboard/receivables/at-risk', 'Clientes en riesgo'],
  ['/dashboard/receivables/customer-ranking', 'Ranking clientes'],
  ['/dashboard/receivables/reminder-effectiveness', 'Efectividad recordatorios'],
  ['/dashboard/cash-conversion-cycle', 'CCC'],
  ['/invoices?page=1&limit=20', 'Facturas'],
  ['/suppliers?page=1&limit=20', 'Proveedores'],
  ['/payments?page=1&limit=10', 'Pagos'],
  ['/factoraje?page=1&limit=10', 'Factoraje'],
];

export default function () {
  for (const [path, label] of ENDPOINTS) {
    group(label, () => {
      const r = http.get(`${BASE_URL}${path}`, { headers });
      check(r, { [`${label} 200`]: (res) => res.status === 200 }) || errorRate.add(1);
    });
  }
  sleep(1);
}
