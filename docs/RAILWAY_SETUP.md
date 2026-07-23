# Railway — Setup de servicios extra

Guía paso a paso para ampliar el proyecto en Railway con los servicios que
agregamos en esta iteración:

1. **Observabilidad** — Sentry (SaaS) + Uptime-Kuma (opcional, Railway template)
2. **Storage** — MinIO (S3-compatible, Railway template) — alternativa a GCS
3. **Búsqueda** — Meilisearch (Railway template)
4. **Marketing/leads** — Resend (SaaS, transaccional) + tabla `Lead` en Postgres
5. **Sistema de alertas y monitoreo** — Better Stack / Uptime-Kuma pegando a `/health`

> **TL;DR:** corre `./scripts/setup-railway.sh` desde la raíz del monorepo con
> la CLI de Railway ya autenticada y linkeada al proyecto. El script solo
> imprime los comandos que sugerimos — los revisa uno por uno y ejecuta los
> que quieras. Los templates de Railway se agregan desde el dashboard
> (los links aparecen abajo).

---

## 0. Pre-requisitos

```bash
# CLI de Railway (una vez)
brew install railway            # macOS
# o: npm i -g @railway/cli

railway login
cd ~/ruta/al/monorepo
railway link                    # elige el proyecto "royaltica"
railway environment production  # o el env que estés usando
```

Verifica:

```bash
railway status
railway variables --service royaltica   # lista actual del servicio api
```

---

## 1. Marketing / leads (Resend + tabla Lead)

**Qué se agregó en el código:**
- `POST /marketing/demo` — agenda de demo desde royaltica.com
- `POST /marketing/contact` — formulario de contacto
- Modelo `Lead` en Prisma + migración `20260722000000_marketing_leads`
- El endpoint `POST /auth/request-access` ahora también envía correo (además
  de la notificación in-app que ya existía).

**Variables a setear:**

```bash
# Cuenta de Resend: https://resend.com/api-keys
railway variables --service royaltica \
  --set RESEND_API_KEY=re_xxx_yyyy \
  --set RESEND_FROM_EMAIL=hola@royaltica.com \
  --set LEADS_EMAIL=leads@royaltica.com
```

**Verificación de dominio en Resend** (obligatorio para no caer en spam):
1. En Resend → Domains → Add Domain → `royaltica.com`
2. Copia los registros DKIM/SPF/DMARC en el DNS de tu proveedor (Vercel/Cloudflare).
3. Espera propagación (~30 min) y presiona "Verify" en Resend.

**Correr migración:**

```bash
# desde /api
railway run --service royaltica -- npm run prisma:deploy
```

**Probar en producción:**

```bash
curl -X POST https://royaltica-production.up.railway.app/marketing/demo \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Test","company":"Test SA","email":"ana@test.mx","preferredDate":"2026-08-01"}'
# → {"ok":true}
```

Deberías recibir el correo interno en `LEADS_EMAIL` y el de confirmación en
`ana@test.mx` (si Resend está configurado con el dominio verificado).

---

## 2. Sentry (observabilidad, backend + frontend)

**SaaS**, no vive en Railway. Solo setea variables:

```bash
# Crear proyecto en https://sentry.io — uno para Node.js y otro para React

# Backend (Railway):
railway variables --service royaltica \
  --set SENTRY_DSN=https://xxx@oyyy.ingest.sentry.io/zzz \
  --set SENTRY_ENVIRONMENT=production \
  --set SENTRY_TRACES_SAMPLE_RATE=0.1

# Frontend (Vercel):
vercel env add VITE_SENTRY_DSN production
vercel env add VITE_SENTRY_ENVIRONMENT production
vercel env add VITE_SENTRY_TRACES_SAMPLE_RATE production
```

Sentry se inicializa en `api/src/main.ts` (llama a `initSentry` antes que
`NestFactory.create`) y en `frontend/src/main.tsx` (importa
`initSentryClient`). Si el DSN no está seteado, el SDK queda en modo no-op y
la app arranca normal.

**Verificación:**
- Backend: forza un 500 (p.ej. `GET /health/does-not-exist`) y revisa Issues.
- Frontend: en la consola del navegador → `throw new Error('sentry test')`.

---

## 3. MinIO (S3-compatible storage)

El proyecto ya usa GCS por default. Meter MinIO da un backend de objetos
que vive dentro de Railway (mismo VPC, sin depender de GCP) — útil para dev
y para clientes que no quieren mezclar con GCP.

**Agregar el servicio (Dashboard):**
1. En el proyecto Railway → **New** → **Template** → busca `MinIO`.
2. Deploy. Railway te da automáticamente:
   - `MINIO_ROOT_USER`
   - `MINIO_ROOT_PASSWORD`
   - URL interna (algo como `minio.railway.internal:9000`)
   - URL pública (opcional, para consola)
3. Entra a la consola web de MinIO (`:9001`) y crea el bucket:
   - Nombre sugerido: `royaltica-files`
   - Access policy: private

**Variables en el servicio `royaltica` (api):**

```bash
railway variables --service royaltica \
  --set STORAGE_PROVIDER=s3 \
  --set S3_ENDPOINT='https://${{MinIO.RAILWAY_PRIVATE_DOMAIN}}:9000' \
  --set S3_REGION=us-east-1 \
  --set S3_BUCKET=royaltica-files \
  --set S3_ACCESS_KEY_ID='${{MinIO.MINIO_ROOT_USER}}' \
  --set S3_SECRET_ACCESS_KEY='${{MinIO.MINIO_ROOT_PASSWORD}}' \
  --set S3_FORCE_PATH_STYLE=true
```

> Los `${{Service.VAR}}` son references de Railway — se resuelven en
> deploy-time desde el servicio MinIO al servicio `royaltica`.

Al primer deploy con `STORAGE_PROVIDER=s3` el log mostrará:
`S3 inicializado (bucket: royaltica-files, endpoint: https://…)`.

**Cambio a GCS:** vuelve a poner `STORAGE_PROVIDER=gcs` y quita las S3_*.
No hace falta migrar datos — los archivos viejos se identifican por su
prefijo (`gs://` vs `s3://`).

---

## 4. Meilisearch (búsqueda instantánea)

**Agregar el servicio (Dashboard):**
1. New → Template → `Meilisearch`.
2. Deploy. Railway expone `MEILI_MASTER_KEY` y la URL interna.

**Variables:**

```bash
railway variables --service royaltica \
  --set MEILI_HOST='http://${{Meilisearch.RAILWAY_PRIVATE_DOMAIN}}:7700' \
  --set MEILI_MASTER_KEY='${{Meilisearch.MEILI_MASTER_KEY}}'
```

Al primer arranque el `SearchService` crea automáticamente los índices
`suppliers`, `invoices`, `customers` con los `searchableAttributes` y
`filterableAttributes` correctos.

**Backfill inicial** (indexar lo que ya está en Postgres):

```bash
# Script one-shot — corre desde /api tras deploy
railway run --service royaltica -- npm run tsx scripts/reindex-search.ts
```

> Este script no existe todavía; ver "Pendientes" al final. Mientras tanto,
> cada supplier que crees/edites/apruebes se indexa on-the-fly.

**Probar:**

```bash
curl -H "Authorization: Bearer $TOKEN" \
  'https://royaltica-production.up.railway.app/search?q=logistica&index=suppliers'
```

---

## 5. Uptime monitoring

Dos opciones (elige una):

### (a) Uptime-Kuma (self-hosted, Railway template)

1. New → Template → `Uptime Kuma` → Deploy.
2. Abre la URL pública, crea admin.
3. Add Monitor → HTTP(s) → `https://royaltica-production.up.railway.app/health` cada 60s.
4. Configura notificaciones (Slack, correo, WhatsApp).

Ventaja: gratis, todo en Railway. Desventaja: si Railway se cae, no notifica.

### (b) Better Stack (SaaS) — recomendado para producción real

1. https://betterstack.com → Uptime → New Monitor → URL `.../health`.
2. Agrega on-call rotation + integración Slack/PagerDuty.

Ventaja: incidencia externa detecta caída total de Railway.

---

## 6. Costos estimados (referencia julio 2026)

| Servicio     | Free tier                     | Costo típico prod   |
|--------------|-------------------------------|---------------------|
| Resend       | 3k emails/mes, 100/día        | $20/mes (50k)       |
| Sentry       | 5k errores/mes, 10k perf.     | $26/mes team plan   |
| MinIO        | Autohosted en Railway         | ~$5/mes container   |
| Meilisearch  | Autohosted en Railway         | ~$5/mes container   |
| Uptime-Kuma  | Autohosted                    | ~$3/mes container   |
| Better Stack | 10 monitores gratis           | $18/mes team        |

---

## 7. Después del deploy — checklist

- [ ] `RESEND_API_KEY` seteado y dominio royaltica.com verificado en Resend.
- [ ] `LEADS_EMAIL` apunta a un buzón real que revisas todos los días.
- [ ] Migración `20260722000000_marketing_leads` aplicada (`railway run npm run prisma:deploy`).
- [ ] `POST /marketing/demo` responde 200 desde curl.
- [ ] Sentry recibiendo eventos (test manual).
- [ ] `GET /search?q=…` responde con al menos los proveedores indexados.
- [ ] `/health` monitoreado desde afuera de Railway.

---

## Pendientes / ideas futuras

- **Script de reindexado**: `scripts/reindex-search.ts` que recorre suppliers/
  invoices/customers y llama `search.indexBatch`. Útil para inicializar el
  índice si Meilisearch se cayó o se cambió el schema.
- **Cal.com self-hosted**: para reemplazar el "agendar demo" manual por un
  calendario real embebible. Se puede montar como servicio adicional en
  Railway (template `Cal.com`) y embeber `<iframe>` en la landing.
- **Grafana + Prometheus** (Railway templates) si quieres dashboards custom
  de métricas del backend en vez de Sentry Performance.
- **PostHog** para analytics de producto (self-host o cloud).
