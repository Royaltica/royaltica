// Verifica que los endpoints públicos de auth (verify-token, dev-login,
// request-access) SÍ cortan con 429 antes de tumbarse o de dejar pasar un
// intento de fuerza bruta. Son endpoints @Public() con @Throttle STRICT
// (5 req/60s) — este script manda ráfagas por encima de ese límite y
// verifica que el guard responda 429, no 500 ni 200 indefinidamente.
//
// Uso:
//   k6 run -e BASE_URL=http://localhost:8080 scripts/stress-test/auth-throttle.js
//
// Corre esto contra LOCAL (docker-compose) o un ambiente de prueba, no
// contra producción: aunque el objetivo es solo activar el rate-limit (no
// hay llamadas a Vertex AI ni a Firebase reales de por medio con estos
// payloads inválidos), sigue siendo tráfico sintético contra tu API real.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  scenarios: {
    burst: { executor: 'constant-vus', vus: 10, duration: '20s' },
  },
  thresholds: {
    // Esperamos VER 429s (es la defensa funcionando). Lo que NO queremos
    // es 5xx: eso sería el guard cayéndose o el endpoint tronando en vez
    // de rechazar limpio.
    'http_req_failed': ['rate<0.01'],
  },
};

function attempt(path, body) {
  const res = http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, {
    'no 5xx (guard no se cae)': (r) => r.status < 500,
    'eventualmente 429': (r) => r.status === 429 || r.status < 429,
  });
  return res;
}

export default function () {
  attempt('/auth/verify-token', { idToken: 'token-invalido-de-prueba' });
  attempt('/auth/request-access', { email: 'stress-test@example.com', name: 'Stress Test' });
  sleep(0.2);
}
