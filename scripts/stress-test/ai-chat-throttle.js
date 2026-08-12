// ⚠️ COSTO REAL: /ai/chat y /ai/chat/stream llaman a Vertex AI (Gemini) por
// cada request que SÍ pasa el rate-limit. Este script está diseñado para
// verificar que el throttle dedicado (20 req/60s, ver AiController) corta a
// tiempo — NO para generar carga sostenida sobre el modelo. Por default manda
// una ráfaga corta y se detiene.
//
// Requiere un JWT válido de un usuario con organización (AUTH_TOKEN): sin
// token, todas las requests regresan 401 antes de llegar a Vertex, lo cual
// sigue sirviendo para probar el guard pero no ejercita el flujo completo.
//
// Uso (ráfaga default, ~25 requests, se detiene solo):
//   k6 run -e BASE_URL=http://localhost:8080 -e AUTH_TOKEN=xxx scripts/stress-test/ai-chat-throttle.js
//
// Si de verdad quieres medir latencia del modelo bajo carga sostenida (no
// solo el throttle), tienes que pedirlo explícitamente y aun así se limita
// a pocos VUs — esto cuesta dinero real en Google Cloud:
//   k6 run -e BASE_URL=... -e AUTH_TOKEN=... -e CONFIRM_REAL_LOAD=yes scripts/stress-test/ai-chat-throttle.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.AUTH_TOKEN || '';
const CONFIRM_REAL_LOAD = __ENV.CONFIRM_REAL_LOAD === 'yes';
const got429 = new Counter('got_429');

export const options = CONFIRM_REAL_LOAD
  ? {
      // Carga sostenida y aun así modesta a propósito (esto cuesta dinero).
      scenarios: { sustained: { executor: 'constant-vus', vus: 5, duration: '30s' } },
    }
  : {
      // Ráfaga corta: manda ~25 requests (más que el límite de 20/60s) y
      // se detiene. Suficiente para confirmar que el 429 aparece.
      scenarios: { burst_then_stop: { executor: 'shared-iterations', vus: 5, iterations: 25, maxDuration: '40s' } },
    };

const headers = {
  'Content-Type': 'application/json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

export default function () {
  const res = http.post(
    `${BASE_URL}/ai/chat`,
    JSON.stringify({ message: 'ping de prueba de carga, responde solo "ok"' }),
    { headers },
  );
  check(res, { 'no 5xx inesperado': (r) => r.status < 500 || r.status === 503 });
  if (res.status === 429) got429.add(1);
  sleep(0.3);
}

export function handleSummary(data) {
  const hit429 = data.metrics.got_429 && data.metrics.got_429.values.count > 0;
  if (!CONFIRM_REAL_LOAD) {
    console.log(
      hit429
        ? '✅ El throttle de /ai/chat (20/60s) se activó como se esperaba.'
        : '⚠️ No se vio 429 — con TOKEN válido revisa si el límite sigue en 20/60s; sin TOKEN esto es esperable (todo 401 antes del guard de org).',
    );
  }
  return {};
}
