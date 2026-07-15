# Arquitectura

Este documento explica cómo encajan las piezas y por qué se tomaron ciertas decisiones. Para "cómo instalo esto en mi máquina" ver el `README.md`; para "cómo lo despliego" ver `docs/DEPLOYMENT.md`.

## Vista general

```
┌───────────────────────────────────────────────────────────┐
│                  FRONTEND (React 19 + Vite)                │
│      Portal Corporativo · Portal Proveedor · Admin          │
│                    Vercel (royaltica.vercel.app)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                 vercel.json rewrite: /api/* → backend
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                BACKEND (NestJS + REST + Swagger)             │
│   Auth · Invoices · Payments · DIOT · REP · AI · ERP · ...   │
│              Railway (royaltica-production...)                │
└──────────┬─────────────────────────────┬─────────────────────┘
           │                             │
    ┌──────▼──────┐              ┌───────▼────────┐
    │ PostgreSQL  │              │     Redis        │
    │ (Railway)   │              │  (Railway)       │
    │ RLS activa  │              │  rate limiting   │
    └─────────────┘              └─────────────────┘
```

El frontend nunca habla directo con Postgres/Redis ni con proveedores externos (Vertex AI, WhatsApp, Resend, ERPs) — todo pasa por el backend, que centraliza auth, validación y rate limiting.

## Por qué un monorepo con dos apps independientes

`frontend/` y `api/` son proyectos Node independientes (cada uno con su propio `package.json`, `node_modules`, tests y despliegue), viviendo en el mismo repo por conveniencia de coordinación entre equipo chico. No comparten build ni versión — se despliegan por separado (Vercel vs Railway) y pueden evolucionar a ritmos distintos.

## Multi-tenancy y Row Level Security

Royáltica es multi-tenant: varias organizaciones (`Organization`) comparten la misma base de datos, y cada una solo debe ver sus propios datos. Hay dos capas de aislamiento, no una sola:

1. **Filtro manual por `organizationId`** en cada query de cada servicio (`where: { organizationId, ... }`). Es la primera línea de defensa y la que existía desde el inicio.
2. **Row Level Security de Postgres** (migración `20260701100000_row_level_security`): cada tabla multi-tenant tiene una política que solo deja ver/escribir filas donde `organizationId` coincida con el valor del GUC de sesión `app.org_id`. `PrismaService.withOrg(organizationId, callback)` abre una transacción, fija ese GUC, y corre el callback dentro — así, aunque una query dentro de un servicio olvide el filtro manual, Postgres igual bloquea el acceso cruzado.

**Regla práctica:** si un servicio lee o escribe alguno de estos modelos, debe usar `withOrg()` en vez de `this.prisma` directo:

```
Supplier, Invoice, Payment, DiotDeclaration, FinancialStatement,
WebhookEndpoint, AiFeedback, UsageEvent, User, ActivityLog
```

**Excepciones intencionales** (documentadas con comentario en el código donde aparecen — no son bugs, no las "arregles" sin entender por qué están así):

- Los checks de duplicado por `cfdiUuid` (`Invoice`) y `email` (`User`) son globales a propósito: esos campos son `@unique` en toda la tabla, no por organización, así que el chequeo de "¿ya existe?" tiene que ver todas las organizaciones o daría falsos negativos.
- Los reportes de costos/uso para SUPERADMIN (`usage.service.ts`: `costByOrganization`, `globalBreakdownByFeature`, `realtime`) son cross-organización a propósito — son paneles de plataforma completa, no de una sola organización.
- `User` y `ActivityLog` permiten `organizationId = NULL` (eventos/cuentas de plataforma, sin org) — la política RLS de esas dos tablas contempla explícitamente ese caso.

Si `app.org_id` nunca se fija (procesos internos, scripts de administración, o un desarrollador que olvida usar `withOrg()`), la política cae a "sin restricción" (fail-open) — por diseño, para no romper flujos administrativos legítimos. Esto significa que RLS es una **red de seguridad adicional**, no un sustituto del filtro manual: ambas capas deben mantenerse.

## Autenticación

Dos caminos, mutuamente excluyentes según configuración:

- **Firebase Auth** (`POST /auth/verify-token`): el camino de producción real. Requiere `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Sin esto, estas rutas devuelven 503.
- **Dev-login** (`POST /auth/dev-login`): emite un JWT por email sin verificar contraseña real. Pensado para desarrollo local. Se bloquea con `NODE_ENV=production` salvo que se active explícitamente con `ALLOW_DEV_LOGIN=true` — una vía de escape documentada para ambientes de demo temporales sin Firebase, que debe apagarse en cuanto haya login real (ver `docs/SECURITY.md`).

Encima de cualquiera de los dos, si el usuario tiene `totpEnabled`, hay un segundo paso obligatorio (`POST /auth/2fa/complete`) con un código TOTP de 6 dígitos — el primer login solo entrega un `tempToken`, no el JWT completo.

## Módulos "reales" vs "stub"

El README lista todos los módulos del backend como "Producción", pero varios dependen de credenciales externas que no siempre están configuradas. El patrón consistente en todo el código es **degradar a modo stub, nunca romper el arranque**:

| Módulo | Sin configurar | Con configurar |
|---|---|---|
| Firebase Admin | Rutas de auth devuelven 503 | Login real |
| Vertex AI / Gemini | Auditoría usa solo heurísticas deterministas; chat de IA devuelve 503 | Chat + auditoría con IA real |
| GCS (documentos) | Archivos se registran como `local://` (stub) | Sube a Cloud Storage real |
| Resend (email) | Correos se registran sin enviarse | Envío real |
| WhatsApp | Alertas se registran sin enviarse | Envío real vía Meta/Twilio |
| Factoraje externo | Dispersiones simuladas | Llamadas reales al proveedor |
| ERP | Conector en modo stub | Sincronización real (Aspel/Bind/Odoo) |

Antes de decirle a un cliente que un módulo "funciona", confirma cuál de las dos columnas aplica en ese ambiente — revisando las variables de entorno configuradas, no solo el nombre del módulo.

## Frontend: `App.tsx` como monolito temporal

`frontend/src/App.tsx` (~15,800 líneas) contiene casi toda la UI: los tres portales (corporativo, proveedor, admin), todos sus paneles, y varios servicios simulados en memoria (`DualLoggerService`, `REPMotorService`, `DiotService` del lado del cliente, `WebhookERPService` — ver `frontend/CLAUDE.md`). No es la arquitectura deseada a largo plazo; es el estado real hoy. `docs/plan-division-apptsx.md` tiene el plan de extracción por fases (helpers puros primero, luego componentes con API real, luego los acoplados a servicios mock, al final los grandes contenedores con estado). La Fase A ya extrajo `validateRFC`/`validateCLABE` a `src/lib/validators.ts` como prueba de concepto.

**Importante:** varios paneles del frontend (Motor REP, Pagos Globales, Conectividad ERP) corren con datos simulados en memoria que no persisten en el backend — están marcados visualmente con un aviso "Vista previa" (`DemoModeNotice`). No asumas que un dato que ves ahí vive en Postgres sin confirmarlo contra `apiClient.ts`.

## Comunicación frontend → backend

`frontend/src/services/apiClient.ts` tiene `const BASE = '/api'` fijo. En desarrollo, el proxy de Vite (`vite.config.ts`) reenvía `/api/*` al backend en `localhost:8080`. En producción, el `rewrite` de `frontend/vercel.json` cumple el mismo rol contra el dominio de Railway. La variable `VITE_API_URL` existe en `.env.example` pero **no se usa en el código actual** — si el dominio del backend cambia, hay que actualizar `vercel.json`, no esa variable.
