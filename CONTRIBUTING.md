# Contribuir a Royáltica

Guía corta para trabajar en este repo sin sorpresas. Si algo aquí no coincide con lo que ves en el código, el código manda — abre un PR corrigiendo este documento.

## Flujo de ramas

No hay rama `develop`. El flujo es:

```
main            → única rama estable, protegida
fix/<algo>      → bugfixes, hardening, correcciones
feature/<algo>  → funcionalidad nueva
```

1. Crea tu rama desde `main` actualizado: `git checkout main && git pull && git checkout -b fix/lo-que-sea`.
2. Haz el cambio, corre las verificaciones (ver abajo).
3. Commit con mensaje descriptivo (ver convención abajo).
4. `git push -u origin fix/lo-que-sea` y abre un PR contra `main`.
5. Aunque seas el único desarrollador en ese momento, el PR queda como registro de qué cambió y por qué — no hagas push directo a `main`.

## Antes de abrir un PR (checklist)

```bash
# Backend
cd api
npm test          # deben pasar TODAS las suites
npx tsc --noEmit   # sin errores de tipos

# Frontend
cd frontend
npm run lint       # tsc --noEmit — debe salir limpio
```

Si tu cambio toca un servicio que lee/escribe alguno de los modelos con Row Level Security (`Supplier`, `Invoice`, `Payment`, `DiotDeclaration`, `FinancialStatement`, `WebhookEndpoint`, `AiFeedback`, `UsageEvent`, `User`, `ActivityLog` — ver `api/prisma/migrations/20260701100000_row_level_security/`), envuelve las queries en `this.prisma.withOrg(organizationId, (tx) => ...)` en vez de usar `this.prisma` directo. Es el mecanismo de aislamiento multi-tenant a nivel de base de datos; sáltalo solo si el query es intencionalmente cross-organización (repórtalo en un comentario explicando por qué, como en `usage.service.ts`).

## Convención de commits

Prefijo tipo Conventional Commits, en español, con contexto suficiente para entenderlo sin abrir el diff:

```
fix(api): instalar openssl en Alpine para que Prisma detecte la version correcta

Prisma cae al default 'openssl-1.1.x' si no encuentra el binario openssl
del sistema, sin importar el binaryTargets configurado en schema.prisma.
```

Prefijos usados en este repo: `fix`, `feat`, `chore`, `docs`, `refactor`, `test`.

## Estilo de código

- TypeScript estricto en frontend y backend — no `any` sin justificar.
- Idioma de la UI y de los mensajes de commit: español México.
- Sin comentarios obvios; comenta invariantes no evidentes, decisiones de diseño o workarounds (el propio `PrismaService.withOrg()` y las excepciones documentadas en `invoices.service.ts`/`usage.service.ts` son buenos ejemplos de qué sí vale la pena comentar).
- Backend: NestJS estándar (módulos, servicios, DTOs con `class-validator`). No SQL crudo — todo pasa por Prisma.
- Frontend: el objetivo es ir sacando piezas de `App.tsx` (15,800+ líneas) hacia `src/lib/` y `src/features/` — ver `docs/plan-division-apptsx.md` para el plan y el orden sugerido. Si tocas una función que calza con ese plan, considera extraerla en el mismo PR.

## Variables de entorno y secretos

- Nunca commitees un `.env` real ni credenciales (revisa `git diff` antes de hacer commit si tocaste configuración).
- Si agregas una variable de entorno nueva al backend, regístrala en `api/src/config/env.validation.ts` (el schema de Zod) y documéntala en el `README.md` — si no está en el schema, no hay garantía de que se valide al arrancar.
- Si es opcional, dale un default seguro y que el servicio degrade a modo stub (patrón ya usado por Firebase, GCS, Vertex AI, Resend, WhatsApp, Factoraje y ERP) en vez de romper el arranque.

## Reportar un problema de seguridad

Ver [`docs/SECURITY.md`](docs/SECURITY.md).
