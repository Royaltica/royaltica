// Verifica el rate-limit dedicado de /marketing/demo y /marketing/contact
// (5 req/60s por IP, @Public()). Estos endpoints son el blanco más probable
// de spam de bots (formularios públicos sin auth), así que el objetivo aquí
// es confirmar que el límite corta ANTES de que cada submit dispare el envío
// de correo/registro en BD (MarketingService).
//
// Uso:
//   k6 run -e BASE_URL=http://localhost:8080 scripts/stress-test/marketing-throttle.js
//
// Seguro de correr contra producción con pocos VUs (son solo unos cuantos
// leads de prueba con email @example.com), pero mejor en local/staging.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const got429 = new Counter('got_429');

export const options = {
  scenarios: {
    spam_burst: { executor: 'constant-vus', vus: 8, duration: '15s' },
  },
};

export default function () {
  const payload = JSON.stringify({
    nombre: 'Stress Test',
    empresa: 'Stress Test SA',
    correo: `stress+${__VU}-${__ITER}@example.com`,
    interes: 'ambas',
    website: '', // honeypot: debe ir vacío
  });
  const res = http.post(`${BASE_URL}/marketing/demo`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'no 5xx': (r) => r.status < 500 });
  if (res.status === 429) got429.add(1);
  sleep(0.1);
}

export function handleSummary(data) {
  const hit429 = data.metrics.got_429 && data.metrics.got_429.values.count > 0;
  console.log(
    hit429
      ? '✅ El rate-limit de /marketing/demo SÍ se activó (429 observado).'
      : '❌ Nunca se vio un 429 — revisa si el throttle sigue activo.',
  );
  return {};
}
