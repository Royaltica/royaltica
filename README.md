# Royáltica

**Plataforma fintech B2B de orquestación de pagos y auditoría fiscal automatizada para corporativos en México.**

Royáltica actúa como una capa de eficiencia entre el corporativo, sus proveedores y el ERP existente. Automatiza el cumplimiento fiscal (REP, DIOT, 69-B), orquesta el flujo de aprobación de facturas y expone un portal de visibilidad para proveedores — sin reemplazar el ERP del cliente.

| | |
|---|---|
| **Frontend en producción** | https://royaltica.vercel.app |
| **Backend en producción** | https://royaltica-production.up.railway.app (`/health` para status, `/docs` para Swagger) |
| **Estado** | Demo/staging desplegada y funcional — ver [Pendientes y roadmap](#pendientes-y-roadmap) antes de considerarla lista para clientes reales |

---

## Tabla de contenidos

- [Arquitectura general](#arquitectura-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos previos](#requisitos-previos)
- [Configuración local (dev)](#configuración-local-dev)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue](#despliegue)
- [Roles y acceso](#roles-y-acceso)
- [Módulos del backend](#módulos-del-backend)
- [Módulos del frontend](#módulos-del-frontend)
- [Seguridad implementada](#seguridad-implementada)
- [Base de datos](#base-de-datos)
- [Backups](#backups)
- [Tests](#tests)
- [Cómo trabajamos](#cómo-trabajamos)
- [Objetivo final de producto](#objetivo-final-de-producto)
- [Pendientes y roadmap](#pendientes-y-roadmap)
- [Más documentación](#más-documentación)

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (React 19)                │
│   Portal Corporativo │ Portal Proveedor │ Admin      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / Vite proxy (/api/*)
┌──────────────────────▼──────────────────────────────┐
│               BACKEND (NestJS + REST)                │
│  Auth · Invoices · Payments · DIOT · REP · AI · ERP │
└──────────┬────────────────────┬─────────────────────┘
           │                    │
    ┌──────▼──────┐    ┌────────▼────────┐
    │ PostgreSQL  │    │     Redis        │
    │ (Docker)    │    │  (throttle/cache)│
    └─────────────┘    └─────────────────┘
```

- El frontend hace todas sus peticiones a rutas relativas `/api/*`; en desarrollo Vite las proxea al backend (`vite.config.ts`).
- En producción (Vercel), un `rewrite` de `vercel.json` hace lo mismo hacia el backend en Railway — no hay reverse proxy propio.
- Postgres y Redis en producción corren como servicios administrados en Railway (no en Docker); en desarrollo local sí usan `docker-compose.yml`.
- Row Level Security (RLS) está activa en Postgres para las tablas multi-tenant: cada request de un servicio abre su transacción con `PrismaService.withOrg()`, que fija `app.org_id` como defensa adicional al filtro manual por `organizationId`.
- La IA de auditoría de facturas corre en Vertex AI (Google Cloud); si no hay credenciales, cae a modo simulación sin romper el flujo.
- WhatsApp y Email degradan gracefully al modo stub si no hay token configurado.

---

## Stack tecnológico

### Frontend (`/frontend`)
| Tecnología | Versión | Uso |
|---|---|---|
| React | 19 | UI |
| TypeScript | 5 | Tipado |
| Vite | 6 | Bundler + dev server |
| TailwindCSS | 4 | Estilos |
| Framer Motion | latest | Animaciones |
| Lucide React | latest | Íconos |
| Recharts | latest | Gráficas |

### Backend (`/api`)
| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | 10 | Framework |
| TypeScript | 5 | Tipado |
| Prisma | 5 | ORM |
| PostgreSQL | 16 | Base de datos principal |
| Redis | 7 | Rate limiting |
| JWT | — | Autenticación |
| otplib | 12 | 2FA TOTP |
| Helmet | latest | Security headers |
| @nestjs/throttler | latest | Rate limiting |

---

## Estructura del monorepo

```
royaltica/
├── frontend/                  # React 19 + Vite (portal corporativo y proveedor)
│   ├── src/
│   │   ├── App.tsx            # Componente raíz — toda la UI (~15,800 líneas,
│   │   │                        ver docs/plan-division-apptsx.md para el plan de división)
│   │   ├── main.tsx           # Entry point
│   │   ├── types.ts           # Tipos TypeScript y datos mock
│   │   ├── index.css          # Design tokens y estilos globales
│   │   ├── lib/
│   │   │   └── validators.ts  # validateRFC / validateCLABE (primera pieza extraída de App.tsx)
│   │   └── services/
│   │       ├── apiClient.ts   # Cliente HTTP hacia el backend (BASE = '/api')
│   │       └── geminiService.ts # IA (modo mock en frontend, real en backend)
│   ├── public/
│   │   └── _headers           # Security headers para Netlify/Cloudflare
│   ├── .env.example
│   ├── vercel.json            # Config de deploy en Vercel (rewrite /api/* → backend Railway)
│   ├── vite.config.ts
│   └── package.json
│
├── api/                       # NestJS backend
│   ├── src/
│   │   ├── main.ts            # Bootstrap: Helmet, CORS, throttler, Swagger (Basic Auth en /docs)
│   │   ├── app.module.ts      # Módulo raíz
│   │   ├── auth/              # JWT + TOTP 2FA + dev-login (ver Variables de entorno)
│   │   ├── users/             # Gestión de usuarios por org
│   │   ├── invoices/          # CRUD + bulk CFDI import (ZIP/XML)
│   │   ├── suppliers/         # CRUD + scoring + KYC docs + 69-B
│   │   ├── payments/          # Pagos desde facturas aprobadas + REP
│   │   ├── fiscal/            # DIOT (layout TXT SAT) + estados financieros
│   │   ├── ai/                # Chat + auditoría forense (Vertex AI)
│   │   ├── webhooks/          # Webhooks salientes con HMAC
│   │   ├── erp/               # Conectores ERP (Aspel/Bind/Odoo stubs)
│   │   ├── whatsapp/          # Alertas WhatsApp (Meta API / Twilio)
│   │   ├── notifications/     # Notificaciones in-app + SSE
│   │   ├── factoraje/         # Flujo de factoraje corporativo
│   │   ├── admin/             # Panel superadmin (orgs + costos + stats)
│   │   ├── usage/             # Eventos de uso y pricing por feature
│   │   ├── jobs/              # Cron jobs (vencimientos, REP reminders)
│   │   ├── portal/            # Endpoints read-only para proveedores
│   │   ├── organization/      # Settings de la org
│   │   ├── activity/          # Log de auditoría (LOGIN, pagos, cambios)
│   │   └── common/
│   │       └── prisma/        # PrismaService.withOrg() — RLS real, enganchado en todos los servicios
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos de datos
│   │   ├── seed.ts            # Datos de demo (1 org, 3 usuarios, 5 proveedores, 20 facturas)
│   │   └── migrations/        # Migraciones SQL versionadas (incluye la de RLS)
│   ├── scripts/
│   │   └── backup-db.sh       # Script de backup automático (launchd, entorno local)
│   ├── Dockerfile             # Build multi-stage usado por Railway
│   ├── docker-compose.yml     # PostgreSQL + Redis (solo desarrollo local)
│   ├── .env.example           # Plantilla de variables de entorno
│   └── package.json
│
├── .gitignore                 # Raíz del monorepo
└── README.md                  # Este archivo
```

---

## Requisitos previos

- Node.js >= 20
- Docker Desktop (para PostgreSQL y Redis locales)
- Git

Opcional (para features específicas):
- Cuenta en Google Cloud (Vertex AI) — la IA cae a modo mock sin esto
- Token de WhatsApp Business API (Meta) o Twilio — los mensajes se loguean en stub sin esto
- API key de Resend — los emails caen a modo silencioso sin esto

---

## Configuración local (dev)

### 1. Clonar y preparar

```bash
git clone https://github.com/TU_ORG/royaltica.git
cd royaltica
```

### 2. Backend

```bash
cd api

# Copiar y editar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección Variables de entorno)

# Levantar PostgreSQL + Redis
docker-compose up -d

# Instalar dependencias
npm install

# Correr migraciones y generar Prisma client
npm run prisma:deploy

# Crear el rol de BD restringido para la app (solo primera vez)
docker exec -i royaltica-postgres psql -U royaltica -d royaltica << 'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'royaltica_app') THEN
    CREATE ROLE royaltica_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS
      PASSWORD 'CAMBIA_ESTA_PASSWORD';
    GRANT CONNECT ON DATABASE royaltica TO royaltica_app;
    GRANT USAGE ON SCHEMA public TO royaltica_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO royaltica_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO royaltica_app;
  END IF;
END
$$;
SQL

# Iniciar en modo desarrollo
npm run start:dev
# Backend disponible en http://localhost:8080
# Swagger docs en http://localhost:8080/docs (Basic Auth: SWAGGER_USER / SWAGGER_PASS del .env)
```

### 3. Frontend

```bash
cd ../frontend

# Copiar variables de entorno
cp .env.example .env
# VITE_API_URL no es necesario en desarrollo (el proxy de Vite apunta a :8080)

# Instalar dependencias
npm install

# Iniciar dev server
npm run dev
# Frontend disponible en http://localhost:5173
```

### Sembrar datos de demo

```bash
npm run seed
# Crea: 1 organización, 3 usuarios, 5 proveedores con KYC, 20 facturas, notificaciones
```

### Login en desarrollo

El proyecto usa `POST /auth/dev-login` en lugar de Firebase Auth real: emite un JWT por email, sin verificar contraseña contra Firebase (el frontend sí pide una contraseña de demo fija, pero es solo un gate visual — ver `DEMO_CREDENTIALS` en `App.tsx`). Usuarios creados por `npm run seed`:

```
director@royaltica.com          → CORPORATE_ADMIN (ve todas las áreas)
analista@royaltica.com          → CORPORATE_USER  (permisos: finanzas, pagos, estados)
proveedor@logisticaandrade.mx   → PROVIDER (portal de proveedor)
```

`dev-login` está deshabilitado por código cuando `NODE_ENV=production`, salvo que se active explícitamente con `ALLOW_DEV_LOGIN=true` (ver [Variables de entorno](#variables-de-entorno)) — útil para un ambiente de demo temporal sin Firebase configurado, pero debe apagarse en cuanto haya login real, porque mientras esté prendida cualquiera con la URL puede entrar como cualquiera de estos usuarios solo sabiendo el email.

---

## Variables de entorno

Validadas por Zod en `api/src/config/env.validation.ts` — si falta una obligatoria o el formato no calza, el backend no arranca (falla rápido en vez de correr mal configurado).

### Backend (`api/.env`) — obligatorias

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL (formato URL) |
| `REDIS_URL` | Conexión Redis (rate limiting) |
| `JWT_SECRET` | Secreto para firmar JWT (mínimo 16 caracteres) |

### Backend — recomendadas / con default sensato

| Variable | Descripción | Default |
|---|---|---|
| `NODE_ENV` | `development` \| `test` \| `production` | `development` |
| `PORT` | Puerto HTTP | `8080` |
| `ALLOWED_ORIGINS` | Orígenes permitidos en CORS, separados por coma. **Obligatorio en producción** (sin lista, el server no arranca; `*` no se acepta) | `http://localhost:5173,http://localhost:3000` |
| `JWT_EXPIRES_IN` | Vigencia del JWT | `8h` |
| `TOTP_ENCRYPTION_KEY` | Llave AES-256 para cifrar secretos TOTP (si falta, se deriva de `JWT_SECRET`) | — |
| `SWAGGER_USER` / `SWAGGER_PASS` | Basic Auth para `/docs` | `admin` / `change-me` |
| `SAT_VERIFY_MODE` | `mock` (default, valida formato) o `live` (pendiente de implementar) | `mock` |
| `JOBS_ENABLED` | `false` desactiva los cron jobs (útil en CI) | `true` |

### Backend — integraciones opcionales (degradan a modo stub si faltan)

| Variable | Para qué |
|---|---|
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase Admin (login real). Sin esto, las rutas de auth vía Firebase devuelven 503 |
| `ALLOW_DEV_LOGIN` | `true` permite `POST /auth/dev-login` aunque `NODE_ENV=production` (ver [Login en desarrollo](#login-en-desarrollo)). **Apagar en cuanto haya login real** |
| `GCS_BUCKET_NAME`, `GCS_KEY_FILE` | Google Cloud Storage (documentos KYC). Sin esto, los archivos se registran en modo stub (`local://`) |
| `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `VERTEX_KEY_FILE` | Vertex AI (asistente de IA + auditoría forense). Si falta `VERTEX_PROJECT_ID`, el chat de IA devuelve 503 y la auditoría usa solo heurísticas |
| `GEMINI_API_KEY` | Alternativa legada a Vertex (API key directa de Gemini) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Envío de correo real (invitaciones, alertas). Sin `RESEND_API_KEY`, los correos se registran sin enviarse |
| `FACTORAJE_API_URL`, `FACTORAJE_API_KEY` | Proveedor externo de factoraje. Sin esto, las dispersiones se simulan en modo stub |
| `ERP_API_URL`, `ERP_API_KEY` | Conector ERP del corporativo (el proveedor se elige en `Organization.settings.erpProvider`, no por env var) |
| `WHATSAPP_PROVIDER` (`meta` o `twilio`), `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_FROM` | Alertas críticas por WhatsApp. Sin `WHATSAPP_TOKEN`, se registran en modo stub |

### Migraciones (no validada por Zod, solo la usan los scripts de Prisma)

| Variable | Descripción |
|---|---|
| `DATABASE_ADMIN_URL` | Conexión con rol owner, usada por `npm run prisma:deploy` / `prisma:migrate` para aplicar migraciones (el runtime usa `DATABASE_URL`, que en producción debería tener menos privilegios) |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | **No se usa actualmente en el código** (`apiClient.ts` tiene la ruta fija `/api`). En producción, el ruteo real hacia el backend lo hace el `rewrite` de `vercel.json`, no esta variable |

**Importante:** NUNCA pongas API keys privadas en variables `VITE_*` — esas se incluyen en el bundle del navegador y son visibles públicamente.

---

## Despliegue

Guía completa paso a paso en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Resumen:

| | Dónde | Notas |
|---|---|---|
| Frontend | Vercel (`vercel --prod` desde `frontend/`) | `vercel.json` trae el `rewrite` de `/api/*` hacia el backend — actualizar la URL ahí si el backend cambia de dominio |
| Backend | Railway (Docker, `railway up` desde `api/`) | Genera dominio público con `railway domain`; healthcheck en `/health` |
| Base de datos | Postgres + Redis administrados por Railway | Migraciones con `DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma migrate deploy` |

**Antes de considerar esto producción real** (no solo demo): configurar Firebase Admin real y apagar `ALLOW_DEV_LOGIN`, crear el rol de BD restringido `royaltica_app` en la base de producción (hoy corre con el rol owner), y resolver las vulnerabilidades de `npm audit` pendientes (ver [Pendientes y roadmap](#pendientes-y-roadmap)).

---

## Roles y acceso

| Rol | Acceso |
|---|---|
| `SUPERADMIN` | Panel admin completo: todas las organizaciones, costos, stats globales |
| `CORPORATE_ADMIN` | Portal corporativo completo de su organización |
| `CORPORATE_USER` | Portal corporativo limitado según permisos asignados al invitarlos |
| `PROVIDER` | Portal proveedor: solo sus facturas y estado de pagos |

Los permisos de `CORPORATE_USER` se asignan al invitar (áreas: facturas, proveedores, pagos, auditoría, fiscal, configuración, financiamiento).

---

## Módulos del backend

| Módulo | Endpoints principales | Estado |
|---|---|---|
| Auth | POST /auth/dev-login, /auth/verify-token, /auth/2fa/* | Producción |
| Users | GET/POST/PATCH /users | Producción |
| Invoices | GET/POST /invoices, POST /invoices/bulk, GET /invoices/aging | Producción |
| Suppliers | CRUD /suppliers, GET /suppliers/:id/score | Producción |
| Payments | CRUD /payments, GET /payments/csv | Producción |
| Fiscal | POST /fiscal/diot, GET /fiscal/statements | Producción |
| AI | POST /ai/chat, POST /ai/audit, POST /ai/feedback | Producción (Vertex AI) |
| Webhooks | CRUD /webhooks, log de entregas | Producción |
| ERP | GET /erp/status, POST /erp/sync/:type | Stub (listo para conectar) |
| WhatsApp | POST /whatsapp/notify, POST /whatsapp/opt-in | Stub (listo para activar) |
| Notifications | GET /notifications, SSE /notifications/stream | Producción |
| Factoraje | CRUD /factoraje, aprobación/desembolso | Producción (flujo interno) |
| Admin | GET /admin/organizations, /admin/stats, /admin/costs | Producción |
| Usage | Registro interno de eventos de uso y pricing | Producción |
| Jobs | Cron: vencimientos KYC, facturas vencidas, REP reminders | Producción |
| Portal | GET /portal/invoices, /portal/profile (proveedores) | Producción |

---

## Módulos del frontend

| Sección | Descripción |
|---|---|
| Dashboard | KPIs, gráficas de flujo, razones financieras CxP |
| Validación | Auditoría IA triple match (monto, proveedor, fecha) |
| Facturas por pagar | Selección masiva, programación de pagos, drag-select |
| Financiamiento | Routing cash/fintech, simulador de factoraje |
| Auditoría | Motor REP PPD, DIOT, Webhooks ERP, Pagos Globales |
| Configuración | KYC proveedores, usuarios, 2FA, ERP, webhooks, presupuesto |
| Portal proveedor | Estado de facturas, expediente KYC, historial de pagos |
| Admin (superadmin) | Gestión de organizaciones, costos por feature, actividad |

---

## Seguridad implementada

- **2FA TOTP** (RFC 6238): secreto cifrado AES-256-GCM en BD; Google Authenticator / Authy
- **JWT** con expiración corta + refresh; token temporal de 5 min para el paso de 2FA
- **Rate limiting**: global 100 req/min; estricto en auth (5/min en login y 2FA)
- **Row Level Security** en PostgreSQL: cada servicio abre su transacción con `PrismaService.withOrg()`, que fija `app.org_id` — Postgres refuerza el aislamiento por organización aunque una query olvide el filtro manual (defensa en profundidad, no el único mecanismo)
- **Helmet**: X-Frame-Options DENY, CSP frame-ancestors none, HSTS, nosniff, no-referrer
- **CORS**: whitelist explícita de orígenes; bloquea wildcard en producción
- **ValidationPipe**: whitelist + forbidNonWhitelisted en todos los endpoints
- **Prisma parametrizado**: cero SQL crudo — sin riesgo de SQLi
- **Sin secretos en el frontend**: el bundle del navegador no contiene ninguna API key
- **Webhooks salientes firmados con HMAC-SHA256**: el secreto se muestra una sola vez al crear el endpoint
- **Backups automáticos** (entorno local): diario 03:00 AM con launchd, verificación de integridad, rotación 14 días
- **Log de auditoría**: ActivityLog registra logins, cambios críticos y acciones fiscales

**Pendiente de endurecer** (ver [`docs/SECURITY.md`](docs/SECURITY.md) para el detalle): rol de BD de mínimo privilegio `royaltica_app` aún no creado en producción (corre con el rol owner), `ALLOW_DEV_LOGIN` activo mientras no haya Firebase real configurado, y vulnerabilidades de dependencias (`npm audit`) pendientes de resolver con `--force`.

---

## Base de datos

**PostgreSQL 16** con Prisma ORM. Modelos principales:

```
Organization → User (roles: CORPORATE_ADMIN, CORPORATE_USER, PROVIDER, SUPERADMIN)
Organization → Supplier → Invoice → Payment
Invoice → CfdiXml (importación masiva CFDI 4.0)
Supplier → SupplierDocument (KYC)
Payment → ActivityLog
Organization → WebhookEndpoint → WebhookDelivery
Organization → Notification
Organization → UsageEvent
Organization → AiFeedback
User → TotpSecret (cifrado AES-256)
```

### Comandos Prisma

```bash
# Aplicar migraciones (usa DATABASE_ADMIN_URL)
npm run prisma:deploy

# Abrir Prisma Studio (visualizar BD)
npx prisma studio

# Crear nueva migración (desarrollo)
npx prisma migrate dev --name nombre_migracion
```

---

## Backups

**Nota:** lo siguiente aplica al Postgres local de `docker-compose`. La base de producción en Railway no usa este script — depende de los backups/snapshots administrados de Railway (revisar su configuración de retención en el dashboard, no asumir que hay uno automático hasta confirmarlo).

El script `api/scripts/backup-db.sh` hace:
1. `pg_dump` del contenedor Docker
2. Comprime con gzip
3. Verifica integridad (gzip -t + presencia de `CREATE TABLE`)
4. Rota backups manteniendo los últimos 14

**Restaurar un backup:**
```bash
gunzip -c ~/RoyalticaBackups/royaltica_YYYY-MM-DD_HH-MM.sql.gz \
  | docker exec -i royaltica-postgres psql -U royaltica -d royaltica
```

---

## Tests

```bash
cd api

# Correr todos los tests
npm test

# Tests con coverage
npm run test:cov

# Tests en modo watch
npm run test:watch
```

El backend tiene 72+ tests unitarios. El frontend usa `tsc --noEmit` para validación de tipos:

```bash
cd frontend
npm run lint
```

---

## Cómo trabajamos

Este proyecto se desarrolló en sesiones iterativas usando **Claude Code** (Anthropic) como asistente de ingeniería principal, trabajando directamente sobre el código fuente en la máquina del desarrollador.

**Flujo de trabajo:**
1. Cada sesión tiene un objetivo concreto (un módulo, una feature, un hardening de seguridad)
2. Se implementa, se verifica con `curl`, `psql` o en el navegador, y se documenta
3. Los cambios quedan en el código; el historial de decisiones importantes vive en `CLAUDE.md` (en cada subdirectorio)

**Convenciones de código:**
- TypeScript estricto en frontend y backend
- Idioma de la UI: Español México
- Design system: colores `brand-ink`, `brand-paper`, `brand-gold`, `brand-sand`, `brand-bone`
- Tipografía: DM Serif Display (headers) + Inter (body)
- Estilo visual: editorial/luxury, glassmorphism sutil
- Sin comentarios obvios; solo se comentan invariantes no obvias o workarounds

**Ramas (uso real, no aspiracional):**
```
main    → única rama estable, protegida. No hay rama develop.
fix/*   → bugfixes y hardening, PR directo a main
feature/* → features nuevas, PR directo a main
```
Cada cambio va en su propia rama con PR (aunque sea de un desarrollador). Antes de mergear: `npm test` y `npm run lint` deben salir limpios (ver [Tests](#tests)).

---

## Objetivo final de producto

Royáltica es una **capa de cumplimiento fiscal y orquestación de CxP** para corporativos mexicanos medianos (50-500 proveedores). No es un ERP ni un banco — se integra con ambos.

**Propuesta de valor diferenciada:**
1. **REP automático** (Complemento de Pago PPD): el mayor dolor fiscal de tesorería
2. **Validación 69-B (EFOS) en tiempo real**: previene deducciones inválidas y fraude de proveedores
3. **DIOT automática**: ahorra horas contables mensualmente
4. **Auditoría IA de facturas**: triple match + análisis forense con Vertex AI
5. **Portal de proveedores**: reduce llamadas de "¿cuándo me pagas?"

**Posicionamiento:** No competimos con Higo/Mendel/Clara en pagos (requieren licencia fintech y capital). Competimos en el nicho de cumplimiento fiscal donde los ERPs son débiles y las multas del SAT son reales.

---

## Pendientes y roadmap

### Ya resuelto (no repetir el trabajo)
- [x] Dependencia faltante `class-validator`/`class-transformer` (bloqueaba 9/17 suites de test)
- [x] `PrismaService.withOrg()` enganchado en los 10 modelos con RLS (Supplier, Invoice, Payment, DiotDeclaration, FinancialStatement, WebhookEndpoint, AiFeedback, UsageEvent, User, ActivityLog)
- [x] Deploy inicial: frontend en Vercel, backend + Postgres + Redis en Railway

### Inmediato
- [ ] Configurar Firebase Admin real y apagar `ALLOW_DEV_LOGIN` — hoy el login de producción depende de ese flag temporal
- [ ] Crear el rol de BD restringido `royaltica_app` en producción (hoy `DATABASE_URL` usa el rol owner)
- [ ] Resolver vulnerabilidades de `npm audit` (29 en backend: 3 baja/22 moderada/4 alta; 3 en frontend) — requieren `--force` con breaking changes en `@nestjs/cli`, `@nestjs/platform-express`, `@nestjs/swagger`, `@nestjs/schedule` y `exceljs`
- [ ] Conectar adapter ERP real (Aspel Plan Facture) — stubs listos, necesita credenciales del cliente
- [ ] Activar WhatsApp real — stubs listos, necesita token Meta Business API o Twilio
- [ ] Activar Resend (email real) — stub listo, necesita `RESEND_API_KEY`

### Roadmap corto plazo
- [ ] Agente local para ERPs de escritorio (Aspel COI/SAE)
- [ ] Conectar SPEI real para ejecución de pagos (requiere licencia o partner STP)
- [ ] Supplier scoring → reglas de aprobación automática (score < 40 → requiere aprobación extra)
- [ ] App móvil para aprobación de pagos (notificaciones push)

### Arquitectura futura
- [ ] Dividir `frontend/src/App.tsx` en componentes separados por módulo — plan detallado en `docs/plan-division-apptsx.md`, Fase A (extracción de `validators.ts`) ya arrancada
- [ ] CI/CD con GitHub Actions (correr `npm test` + `npm run lint` en cada PR automáticamente)

---

## Más documentación

| Documento | Contenido |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Flujo de ramas/PR, convenciones de commits, checklist antes de mergear |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Modelo de datos, multi-tenancy y RLS, límites entre módulos, decisiones de diseño |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Runbook completo de despliegue (Vercel + Railway), paso a paso |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Postura de seguridad, qué está implementado, qué falta, cómo reportar un hallazgo |
| [`api/prisma/schema.prisma`](api/prisma/schema.prisma) | Fuente de verdad del modelo de datos (más confiable que cualquier diagrama) |

---

## Licencia

Propietario — todos los derechos reservados. No distribuir sin autorización de Royáltica.
