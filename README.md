# Royáltica

**Plataforma fintech B2B de orquestación de pagos y auditoría fiscal automatizada para corporativos en México.**

Royáltica actúa como una capa de eficiencia entre el corporativo, sus proveedores y el ERP existente. Automatiza el cumplimiento fiscal (REP, DIOT, 69-B), orquesta el flujo de aprobación de facturas y expone un portal de visibilidad para proveedores — sin reemplazar el ERP del cliente.

---

## Tabla de contenidos

- [Arquitectura general](#arquitectura-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del monorepo](#estructura-del-monorepo)
- [Requisitos previos](#requisitos-previos)
- [Configuración local (dev)](#configuración-local-dev)
- [Variables de entorno](#variables-de-entorno)
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

- El frontend hace todas sus peticiones a rutas relativas `/api/*`; Vite las proxea al backend en desarrollo.
- En producción, un reverse proxy (nginx/caddy) hace lo mismo.
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
│   │   ├── App.tsx            # Componente raíz — toda la UI (~10k líneas)
│   │   ├── main.tsx           # Entry point
│   │   ├── types.ts           # Tipos TypeScript y datos mock
│   │   ├── index.css          # Design tokens y estilos globales
│   │   └── services/
│   │       ├── apiClient.ts   # Cliente HTTP hacia el backend
│   │       └── geminiService.ts # IA (modo mock en frontend, real en backend)
│   ├── public/
│   │   └── _headers           # Security headers para Netlify/Cloudflare
│   ├── .env.example
│   ├── vite.config.ts
│   └── package.json
│
├── api/                       # NestJS backend
│   ├── src/
│   │   ├── main.ts            # Bootstrap: Helmet, CORS, throttler, Swagger
│   │   ├── app.module.ts      # Módulo raíz
│   │   ├── auth/              # JWT + TOTP 2FA + dev-login
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
│   │   ├── activity-log/      # Log de auditoría (LOGIN, pagos, cambios)
│   │   └── common/
│   │       └── prisma/        # PrismaService con withOrg() para RLS
│   ├── prisma/
│   │   ├── schema.prisma      # Modelos de datos
│   │   └── migrations/        # Migraciones SQL versionadas
│   ├── scripts/
│   │   └── backup-db.sh       # Script de backup automático (launchd)
│   ├── docker-compose.yml     # PostgreSQL + Redis
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
# Swagger docs en http://localhost:8080/api-docs (usuario: admin, contraseña: en .env)
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

### Login en desarrollo

El proyecto usa `POST /auth/dev-login` en lugar de Firebase Auth real (para evitar depender del reloj del sistema en entornos de desarrollo).

```
director@royaltica.com    → CORPORATE_ADMIN (org Royáltica Demo)
operaciones@royaltica.com → CORPORATE_USER  (permisos limitados)
proveedor@demo.com        → PROVIDER
superadmin@royaltica.com  → SUPERADMIN
```

---

## Variables de entorno

### Backend (`api/.env`)

Copia `api/.env.example` y rellena los valores. Los campos con `*` son obligatorios para arrancar:

| Variable | Descripción | Obligatorio |
|---|---|---|
| `DATABASE_URL` | Conexión PostgreSQL con rol `royaltica_app` (runtime) | * |
| `DATABASE_ADMIN_URL` | Conexión con rol owner (solo para migraciones) | * |
| `REDIS_URL` | Conexión Redis para rate limiting | * |
| `JWT_SECRET` | Secreto para firmar JWT (mínimo 32 chars) | * |
| `TOTP_ENCRYPTION_KEY` | Llave AES-256 para cifrar secretos TOTP (mínimo 32 chars) | Recomendado |
| `SWAGGER_PASSWORD` | Password del panel Swagger | * |
| `NODE_ENV` | `development` o `production` | * |
| `ALLOWED_ORIGINS` | Lista de orígenes permitidos en CORS (separados por coma) | * en prod |
| `VERTEX_PROJECT_ID` | Proyecto Google Cloud para Vertex AI | Opcional |
| `VERTEX_LOCATION` | Región Vertex AI (ej. `us-central1`) | Opcional |
| `GOOGLE_APPLICATION_CREDENTIALS` | Ruta al JSON de service account de GCP | Opcional |
| `WHATSAPP_PROVIDER` | `meta` o `twilio` | Opcional |
| `WHATSAPP_TOKEN` | Token de WhatsApp Business API | Opcional |
| `WHATSAPP_PHONE_ID` | Phone Number ID (Meta) o From number (Twilio) | Opcional |
| `RESEND_API_KEY` | API key de Resend para emails | Opcional |
| `ERP_PROVIDER` | `aspel`, `bind`, `odoo` o vacío | Opcional |

### Frontend (`frontend/.env`)

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL base del backend (solo en producción; en dev usa el proxy) |

**Importante:** NUNCA pongas API keys privadas en variables `VITE_*` — esas se incluyen en el bundle del navegador y son visibles públicamente.

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
- **Row Level Security** en PostgreSQL: aislamiento de datos por organización a nivel de BD
- **Rol de BD de mínimo privilegio**: `royaltica_app` (NOSUPERUSER, NOBYPASSRLS) para el runtime
- **Helmet**: X-Frame-Options DENY, CSP frame-ancestors none, HSTS, nosniff, no-referrer
- **CORS**: whitelist explícita de orígenes; bloquea wildcard en producción
- **ValidationPipe**: whitelist + forbidNonWhitelisted en todos los endpoints
- **Prisma parametrizado**: cero SQL crudo — sin riesgo de SQLi
- **Sin secretos en el frontend**: el bundle del navegador no contiene ninguna API key
- **Backups automáticos**: diario 03:00 AM con launchd, verificación de integridad, rotación 14 días
- **Log de auditoría**: ActivityLog registra logins, cambios críticos y acciones fiscales

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

**Ramas sugeridas:**
```
main        → producción (protegida)
develop     → integración
feature/*   → features nuevas
fix/*       → bugfixes
```

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

### Inmediato
- [ ] Conectar adapter ERP real (Aspel Plan Facture) — stubs listos, necesita credenciales del cliente
- [ ] Activar WhatsApp real — stubs listos, necesita token Meta Business API o Twilio
- [ ] Activar Resend (email real) — stub listo, necesita `RESEND_API_KEY`
- [ ] Migrar `@nestjs/cli` a v11 para resolver 4 vulnerabilidades en dev tooling

### Roadmap corto plazo
- [ ] Agente local para ERPs de escritorio (Aspel COI/SAE)
- [ ] Conectar SPEI real para ejecución de pagos (requiere licencia o partner STP)
- [ ] Supplier scoring → reglas de aprobación automática (score < 40 → requiere aprobación extra)
- [ ] App móvil para aprobación de pagos (notificaciones push)

### Arquitectura futura
- [ ] Dividir `frontend/src/App.tsx` en componentes separados por módulo
- [ ] Adoptar `PrismaService.withOrg()` en todos los servicios (RLS por transacción)
- [ ] CI/CD con GitHub Actions

---

## Licencia

Propietario — todos los derechos reservados. No distribuir sin autorización de Royáltica.
