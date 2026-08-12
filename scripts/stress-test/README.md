# Stress testing — Royáltica

Suite para probar carga y resiliencia ante entradas hostiles. Requiere [k6](https://k6.io/docs/get-started/installation/) instalado; `malformed-payloads.sh` solo necesita `curl`.

## Orden recomendado

1. **Local primero** (`docker-compose up` en `/api`, backend en `http://localhost:8080`). Todo lo de abajo corre igual apuntando `BASE_URL` a local — así no arriesgas producción ni gastas cuota de Vertex AI mientras iteras.
2. Cuando local se vea bien, repite contra producción **con VUs bajos** y en horario de bajo tráfico. No hay ambiente de staging todavía (`royaltica-production.up.railway.app` es el único backend desplegado) — trátalo como producción real porque lo es.

## Scripts

| Script | Qué prueba | Contra prod: ¿seguro? |
|---|---|---|
| `api-stress.js` | Smoke + carga básica (health, invoices, payments, suppliers) — el que ya existía | Sí, bajo volumen |
| `read-endpoints-load.js` | Carga sostenida (hasta 60 VUs) sobre los endpoints de dashboard/aging/razones financieras — los que hacen más trabajo en Postgres | Con cuidado: empieza con el pico de `stages` más bajo |
| `auth-throttle.js` | Que `/auth/verify-token`, `/auth/request-access` corten con 429 (no 500) ante ráfagas | Sí |
| `marketing-throttle.js` | Que `/marketing/demo` (5 req/60s) corte antes de floodear tu bandeja de leads | Sí (usa correos @example.com) |
| `ai-chat-throttle.js` | Que el throttle nuevo de `/ai/chat` (20 req/60s) corte a tiempo | ⚠️ **Cuesta dinero real** si `AUTH_TOKEN` es válido — lee el header del archivo |
| `malformed-payloads.sh` | JSON roto, strings que exceden el límite, intento de inyección SQL en `?search=`, JWT basura, sin token | Sí |
| `marketing-site-load.js` | Carga sobre `royaltica.com`: home, `/gracias`, `/privacidad`, `robots.txt`, `sitemap.xml`, y que una URL inventada dé 404 real | Sí, es contenido estático público |

## Cómo correrlos

```bash
# Local
export BASE_URL=http://localhost:8080
export AUTH_TOKEN=$(curl -s -X POST $BASE_URL/auth/dev-login -H 'Content-Type: application/json' -d '{"email":"admin@royaltica.com"}' | jq -r .accessToken)

k6 run scripts/stress-test/api-stress.js
k6 run scripts/stress-test/read-endpoints-load.js
k6 run scripts/stress-test/auth-throttle.js
k6 run scripts/stress-test/marketing-throttle.js
k6 run scripts/stress-test/ai-chat-throttle.js          # ráfaga corta, se detiene sola
bash scripts/stress-test/malformed-payloads.sh
k6 run -e BASE_URL=http://localhost:5173 scripts/stress-test/marketing-site-load.js  # o el puerto del preview de Vite
```

Contra producción, cambia `BASE_URL` y usa un token real (login normal, no `dev-login`, que está deshabilitado fuera de development).

## Qué esperar (criterios de éxito)

- **Ningún script debería producir 5xx** salvo el 503 esperado de `/ai/chat` cuando Vertex AI no está configurado. Un 500 es un bug, no "el sistema resistiendo".
- Los scripts de throttle **deben** ver 429 en algún punto — si nunca aparece, el rate-limit no está protegiendo nada.
- `malformed-payloads.sh` debe terminar con `FAIL 0`. Cualquier fila en ❌ es una entrada que no se está validando bien.
- `read-endpoints-load.js`: p95 < 3s incluso en el pico de 60 VUs. Si se dispara mucho más, es señal de que falta un índice en Postgres o que alguna query no está paginando.

## Hallazgo de la auditoría: rate-limit en memoria, no en Redis

`ThrottlerModule.forRoot(...)` en `app.module.ts` usa el storage por default de `@nestjs/throttler`, que es **en memoria del proceso**. Ahora mismo probablemente da igual porque el backend corre en una sola instancia de Railway, pero si en algún momento escalan a 2+ instancias, cada una lleva su propio contador — un atacante (o un bug de cliente en loop) podría efectivamente multiplicar el límite por el número de instancias, porque el balanceador los reparte entre procesos que no se hablan entre sí. Ya tienen `RedisModule` en el proyecto; cuando escalen a más de una instancia vale la pena conectar el throttler a Redis (`@nestjs/throttler` soporta storage custom) para que el límite sea real y no por-instancia. No es urgente con una sola instancia, pero lo dejo anotado para no repetir la sorpresa el día que sí escalen.

## Lo que esto NO cubre (fuera de alcance de este script)

Esto es resiliencia básica ante carga y entradas malformadas, no un pentest. No prueba: XSS almacenado, CSRF, IDOR entre organizaciones (requiere cuentas de prueba en dos orgs distintas para confirmar que ninguna ve datos de la otra bajo carga concurrente), fuzzing exhaustivo de cada endpoint, ni ataques a nivel de red (DDoS volumétrico — eso lo filtra Vercel/Railway/Cloudflare antes de llegar a tu código). Para eso se necesita una herramienta dedicada (OWASP ZAP, Burp Suite) y, si quieren ir en serio, un pentest externo contratado.
