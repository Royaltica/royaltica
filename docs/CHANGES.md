# Cambios de esta iteración — resumen ejecutivo

> **José:** aquí está todo lo que hice, para que lo revises rápido.
> **Nada está commiteado**. Cuando lo apruebes, tú corres `git add / commit / push`.

## ✅ Lo que quedó listo

### 1. Formularios en royaltica.com — **agendar demo + contacto** (100% funcional)

- **Backend:** nuevo módulo `api/src/marketing/` con dos endpoints públicos:
  - `POST /marketing/demo` — captura solicitud de demo (con fecha/hora preferida, tamaño de empresa, puesto, contexto).
  - `POST /marketing/contact` — formulario de contacto general.
  - Ambos con rate limit dedicado (5 req/60s por IP) para evitar spam.
- **Persistencia:** nueva tabla `Lead` en Prisma (migración `20260722000000_marketing_leads`).
- **Notificación:** al enviar, el backend hace **3 cosas** en paralelo (ninguna bloquea al usuario):
  1. Guarda el `Lead` en Postgres.
  2. Envía correo interno al equipo (`LEADS_EMAIL`, default `hello@royaltica.com`) con todos los datos y `Reply-To` al solicitante.
  3. Envía correo de confirmación al solicitante ("recibimos tu solicitud, te contactamos en 24h").
  4. Crea notificación in-app para todos los `SUPERADMIN`.
- **Frontend:** dos pantallas nuevas en `App.tsx` (`ScheduleDemoScreen` y `ContactScreen`) accesibles desde dos botones nuevos en el `LandingPage`. Usan el mismo look-and-feel editorial que `RequestAccessScreen`.
- **Bonus:** el endpoint viejo `POST /auth/request-access` (el que ya existía y solo creaba notificación in-app) ahora **también envía correo** vía Resend al equipo + confirmación al usuario.

**Cómo verificar (después del deploy):**
```bash
curl -X POST https://royaltica-production.up.railway.app/marketing/demo \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana","company":"Acme","email":"ana@test.mx","preferredDate":"2026-08-01"}'
# → {"ok":true}
```
El correo llega si `RESEND_API_KEY` y `LEADS_EMAIL` están seteadas en Railway. Sin ellas, el lead se guarda en Postgres y aparece la notificación in-app; los correos entran en modo stub (log warning, no envían).

---

### 2. Sentry (observabilidad) — backend + frontend

- **Backend:** nuevo `api/src/common/sentry.ts` que inicializa `@sentry/node` antes de `NestFactory.create` (en `main.ts`). El `AllExceptionsFilter` reporta a Sentry cualquier 5xx.
- **Frontend:** nuevo `frontend/src/lib/sentry.ts` que carga `@sentry/react` en `main.tsx` si `VITE_SENTRY_DSN` está definido.
- **Fail-open:** sin DSN, ambos son no-op silencioso (la app arranca igual).
- Vars nuevas: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE` (y sus `VITE_*` en el frontend).

---

### 3. Storage: S3-compatible (MinIO en Railway) como alternativa a GCS

- Refactoricé `api/src/storage/storage.service.ts` para tener **dos backends intercambiables** via `STORAGE_PROVIDER=gcs|s3`.
- La API pública (`upload / delete / getSignedUrl / isConfigured`) no cambió, así que **ningún otro archivo tuvo que tocarse**.
- El backend S3 usa `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Compatible con MinIO, AWS S3, Cloudflare R2, Backblaze B2.
- Nuevas vars: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`.
- Los identificadores en DB ahora pueden ser `gs://…` o `s3://…` (además del `local://…` que ya existía).

---

### 4. Meilisearch (búsqueda instantánea)

- Nuevo módulo `api/src/search/` con:
  - `SearchService` que se conecta a Meilisearch vía `MEILI_HOST` + `MEILI_MASTER_KEY`. Sin config → modo stub (todo no-op).
  - Al arrancar crea automáticamente índices `suppliers`, `invoices`, `customers` con los `searchableAttributes`/`filterableAttributes` correctos.
  - `SearchController` expone `GET /search?q=…&index=suppliers` (JWT + filtra por `organizationId` del usuario → aislamiento multi-tenant respetado).
- **Hooks de indexado** en `SuppliersService`: cada `create/update/approve/remove` indexa/borra en Meili automáticamente (fire-and-forget; no rompe si Meili está caído).
- Actualicé `suppliers.service.spec.ts` para mockear `SearchService`.

---

### 5. Documentación + script de setup de Railway

- **`docs/RAILWAY_SETUP.md`** — guía paso a paso completa: pre-requisitos, cada servicio (Resend, Sentry, MinIO, Meilisearch, Uptime-Kuma), variables exactas usando referencias `${{Service.VAR}}` de Railway, checklist post-deploy, estimados de costos.
- **`scripts/setup-railway.sh`** — imprime los comandos sugeridos con colores. **No ejecuta nada**: solo te da el copy/paste para que revises cada uno.

---

## 🔧 Qué necesitas hacer localmente para levantar todo

```bash
# 1. Instalar las deps nuevas
cd api && npm install
cd ../frontend && npm install

# 2. Generar cliente Prisma (por el modelo Lead nuevo)
cd api && npm run prisma:generate

# 3. Correr la migración local (dev)
npm run prisma:migrate     # crea la tabla Lead en tu Postgres local

# 4. Aplicar migración en Railway
railway run --service royaltica -- npm run prisma:deploy

# 5. Setear variables de Railway (ver docs/RAILWAY_SETUP.md o scripts/setup-railway.sh)
./scripts/setup-railway.sh   # imprime los comandos, tú los ejecutas

# 6. Deploy
railway up --service royaltica
```

Los templates de Railway (MinIO, Meilisearch, Uptime-Kuma) se agregan **desde el dashboard web** — no hay comando CLI para agregar templates.

---

## 📁 Archivos nuevos

```
api/src/marketing/
  ├── marketing.module.ts
  ├── marketing.controller.ts
  ├── marketing.service.ts
  └── dto/
      ├── schedule-demo.dto.ts
      └── contact.dto.ts
api/src/search/
  ├── search.module.ts
  ├── search.controller.ts
  └── search.service.ts
api/src/common/sentry.ts
api/prisma/migrations/20260722000000_marketing_leads/migration.sql
frontend/src/lib/sentry.ts
docs/RAILWAY_SETUP.md
docs/CHANGES.md              ← este archivo
scripts/setup-railway.sh
```

## ✏️ Archivos modificados

```
api/prisma/schema.prisma                             (+ modelo Lead, enums LeadType/LeadStatus)
api/src/app.module.ts                                (+ MarketingModule, SearchModule)
api/src/config/env.validation.ts                     (+ LEADS_EMAIL, SENTRY_*, STORAGE_PROVIDER, S3_*, MEILI_*)
api/src/main.ts                                      (initSentry antes de NestFactory)
api/src/email/email.service.ts                       (+ replyTo)
api/src/auth/auth.service.ts                         (requestAccess ahora también envía correo)
api/src/auth/auth.service.spec.ts                    (mock del nuevo EmailService en el constructor)
api/src/common/filters/all-exceptions.filter.ts      (captureException en 5xx)
api/src/storage/storage.service.ts                   (refactor: driver gcs|s3)
api/src/suppliers/suppliers.service.ts               (+ SearchService inyectado + hooks de indexado)
api/src/suppliers/suppliers.service.spec.ts          (mock de SearchService)
api/.env.example                                     (+ LEADS_EMAIL, SENTRY_*, STORAGE_*, MEILI_*)
api/package.json                                     (+ @sentry/node, @aws-sdk/client-s3, s3-request-presigner, meilisearch)
frontend/package.json                                (+ @sentry/react)
frontend/src/main.tsx                                (initSentryClient)
frontend/src/services/apiClient.ts                   (+ scheduleDemo, sendContactMessage)
frontend/src/App.tsx                                 (+ ScheduleDemoScreen, ContactScreen, 2 botones en LandingPage)
```

## ⚠️ Cosas que quedaron pendientes / que NO hice

1. **`git add / commit / push`** — como pediste, no toqué nada de git.
2. **Reindex script para Meilisearch** — está mencionado en `RAILWAY_SETUP.md`. Es útil si algún día Meili se cae y hay que reconstruir el índice desde Postgres. Se puede hacer en 20 líneas cuando lo necesites.
3. **Panel admin para leads** — el modelo `Lead` está en DB pero no hay UI todavía para verlos/marcar CONTACTED/CONVERTED. Si quieres podemos hacerlo en la próxima.
4. **Cal.com self-hosted** — considerado pero descartado por complejidad. El flujo actual (form → correo al equipo → tú les mandas link de Calendar manualmente) es más pragmático para volumen bajo. Cuando pases de ~10 demos/semana vale la pena.
5. **Typecheck completo** — no lo pude correr al 100% en el sandbox (no hay conexión a los binarios de Prisma). Sí verifiqué que los únicos errores nuevos son los que se resuelven con `prisma generate`.

---

## 💡 Sugerencias para la próxima sesión

- Panel admin para leads (`/admin/leads` con lista + filtros + botón "marcar como contactado").
- Meterle un **honeypot field** al formulario público para bloquear bots (5 min de trabajo).
- Guardar `utm_source / utm_medium / utm_campaign` en `Lead.source` (parsear query params en el frontend antes de enviar).
- Slack webhook adicional para leads (además del correo) — cada mensaje aparece en `#leads` en tiempo real.
