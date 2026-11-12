# CLAUDE.md — Royáltica (monorepo)

Fintech B2B mexicana: **cobranza inteligente (CxC)** y **orquestación de pagos/auditoría fiscal (CxP)**. Este archivo es el mapa de una página; el detalle vive en el vault de Obsidian `Royaltica-Brain/` (ver al final) y en `docs/`.

## Mapa del sistema

| Pieza | Dónde | Stack / hosting |
|---|---|---|
| Backend | `api/` | NestJS 10 + Prisma 5.22 + PostgreSQL 16 + Redis · Railway (proyecto "Royáltica", servicio "Royáltica") · https://api.royaltica.com |
| Frontend | `frontend/` | React 19 + Vite 6 + Tailwind 4 · Vercel · tiene su propio `frontend/CLAUDE.md` (parte está desactualizado: la app ya es multi-rol y usa el backend real) |
| Landing | `landing/` | Sitio de marketing |
| Docs técnicos | `docs/` | ARCHITECTURE, DEPLOYMENT, SECURITY, whatsapp-meta-diagnostico, etc. |
| CI | `.github/workflows/ci.yml` | Jobs "API – Lint & Test" y "Frontend – Lint, Test & Build" |

Repo: github.com/Royaltica/royaltica. El front solo habla con el back vía `frontend/src/services/apiClient.ts` (`/api/*`, proxy de Vite en dev, `rewrite` de `vercel.json` en prod).

## Roles y cuentas

- `SUPERADMIN` — equipo Royáltica; `AdminDashboard`; "Entrar como cliente" (impersonation).
- `CORPORATE_ADMIN` — acceso total a su organización (permissions `*`).
- `CORPORATE_USER` + `permissions[]` — áreas: dashboard, proveedores, cxc, finanzas, factoraje, pagos, estados, notificaciones, configuracion (`api/src/auth/constants/permissions.ts`). Perfil operativo `SUPERVISOR_GERENTE` o `AGENTE_EJECUTIVO` (este último → `AgentDashboard`, solo ve clientes con `Customer.assignedAgentId` suyo).
- `PROVIDER` — ligado a un `Supplier` (CxP), `ProviderDashboard`.
- `Customer` (deudor) — sin cuenta; portal por token que expira.
- Organización: `product` CXP | CXC; paquetes de licencias PAQUETE_1 3/3/3, _2 4/4/4, _3 5/5/5 (admin/supervisor/agente) en `api/src/common/seat-limits.ts`.
- Login: Firebase (Google/correo) + 2FA TOTP opcional.

## Cobranza (núcleo CxC)

- Motor: `CollectionPolicy` + `CollectionSequenceStep` + `CollectionSequenceRun`; niveles N0–N4, A, B por WhatsApp (plantillas Meta en `api/src/whatsapp/collection-templates.ts`).
- Riesgo/incobrabilidad: `api/src/customers/scoring/customer-risk.*` — umbrales 150 días (riesgo) y 200 (incobrable); `Customer.riskTier`. Las secuencias saltan a fast-track según tier.
- Análisis semanal de cartera (`dashboard.service.getPortfolioRiskAnalysis`, PDF en `reports`), digest en cron lunes 8am.
- Diagnóstico pre-venta público: `api/src/pre-sale-diagnostic/`. Onboarding post-venta: cron `onboarding-data-completion` (7am) + `GET /organization/readiness`.
- Entrada de datos: `POST /external-data-sync/customers` (CSV) y `POST /receivables/bulk` (ZIP de CFDI XML; los clientes deben existir por RFC).
- Crons en `api/src/jobs/jobs.service.ts` (score 11:30, secuencias 11:00, etc.).

## Comandos

```bash
# API (desde api/)
npm run start:dev          # :8080, Swagger en /docs
npm test                   # jest (ojo: usa --experimental-vm-modules)
npx tsc --noEmit
npx prisma generate        # tras cambiar schema.prisma
npm run prisma:deploy      # migraciones (usa DATABASE_ADMIN_URL)

# Frontend (desde frontend/)
npm run dev                # :3000
npm run lint               # tsc --noEmit
npm test                   # vitest run
```

## Convenciones

- UI y commits en español (México); commits tipo `feat(api): …`, `fix(...)`, `docs`, `test`, `chore`, `refactor`.
- TypeScript estricto; sin `any` injustificado; sin comentarios obvios.
- Queries sobre modelos con RLS → `this.prisma.withOrg(orgId, tx => …)`.
- Variable de entorno nueva → registrarla en `api/src/config/env.validation.ts` y documentarla; las integraciones opcionales degradan a stub.
- Cada cambio de modelo = una migración en `api/prisma/migrations/`.
- Design system: `brand-ink/paper/gold/sand/bone/cream`; DM Serif Display + Inter.
- `frontend/src/App.tsx` y las vistas de cobranza son archivos enormes: buscar con grep antes de editar.

## Trampas conocidas

- Cambias `schema.prisma` → hay que correr `npx prisma generate` en la máquina de José (el sandbox de Claude no puede descargar los engines).
- Meta WhatsApp exige que nombre **y** cuerpo de la plantilla coincidan exactos; la plantilla se resuelve contra la WABA del `WHATSAPP_PHONE_ID`. Pendiente: crear `aviso_vencida` y `seguimiento_vencida` (ver `docs/whatsapp-meta-diagnostico.md`).
- José hace push directo a `main` (aunque `CONTRIBUTING.md` pide PR). Verifica `npx jest` + `tsc` antes de dar por listo un cambio.
- Falla conocida ajena: `DemoConfirmationEmail.spec.ts` (react-email, import dinámico en jest).
- Un run de CI en rojo puede ser un `pull_request` viejo sobre un commit anterior: revisar el commit antes de "arreglar".
- Para correr Prisma localmente con `.env`: `set -a; source .env; set +a` antes de `npm run prisma:deploy`.

## Reglas de seguridad para quien edite este repo

- Nunca escribir contraseñas, tokens ni llaves en este archivo, en notas del vault ni en commits. Las credenciales viven en un gestor de contraseñas y en las variables de Railway/Vercel.
- Los scripts de `api/prisma/` que crean cuentas de prueba no deben llevar contraseñas reales.

## Segundo cerebro (Obsidian)

El conocimiento no técnico y vivo (decisiones, estado de integraciones, pendientes, iniciativas de Paolo, cuentas) está en el vault `Royaltica-Brain/` (carpeta hermana de `repo/`: `/Users/josema/Documents/Royaltica/Royaltica-Brain`). Empieza por `00 - Inicio.md`. Está organizado por área (01 Producto, 02 Frontend, 03 Backend, 04 Infraestructura, 05 Integraciones, 06 Planificación, 07 Pendientes, 08 Resueltos y Lecciones, 09 Reglas y Forma de trabajo, 10 Conversaciones, 11 Documentos, 12 Cuentas, 13 Recursos). Antes de depurar un error revisa `08 - Resueltos y Lecciones`. Al cerrar una sesión de trabajo importante, actualiza `07 - Pendientes/Pendientes.md` y registra decisiones nuevas en `06 - Planificación/Decisiones/`.
