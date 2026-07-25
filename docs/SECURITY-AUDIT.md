# Auditoría de vulnerabilidades (npm audit) — julio 2026

## Resumen ejecutivo

`npm audit` reportaba 51 (api) + 8 (frontend) vulnerabilidades. Después de
clasificar cada una por si realmente corre en producción o no, la imagen
real era mucho menos alarmante de lo que el conteo crudo sugiere:

| | api | frontend |
|---|---|---|
| Reportadas por `npm audit` | 51 | 8 |
| **Solo en devDependencies (no llegan al build de producción)** | 31 | 0 |
| **Realmente explotables en este código** | 2 | 0 (bajo uso actual) |
| Requieren bump mayor de framework (riesgo de romper, agendar aparte) | ~18 | ~10 (post-limpieza) |

## Lo que arreglé ahora (sin riesgo, ya aplicado)

### 1. `adm-zip` 0.5.17 → 0.6.0 (backend) — **el único fix urgente real**
- Advisory: [GHSA-xcpc-8h2w-3j85](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) — un ZIP manipulado puede forzar una asignación de 4GB de memoria (DoS).
- **Por qué importaba de verdad:** `adm-zip` se usa en `invoices.service.ts` y `receivables.service.ts` para el import masivo de CFDIs vía ZIP — un endpoint que acepta archivos subidos por el usuario. Esto SÍ era explotable.
- La API (`new AdmZip(buffer)`, `.getEntries()`, `.getData()`) no cambió entre 0.5 y 0.6 — verifiqué que compila sin errores de tipos.
- Quité `@types/adm-zip` de devDependencies porque 0.6.0 ya trae sus propios tipos incluidos.

### 2. `express` eliminado del frontend (dependencia muerta)
- No se usaba en ningún lado del código (confirmé con grep en todo `frontend/src` y `vite.config.ts`).
- Arrastraba `body-parser` vulnerable sin ningún beneficio.
- También quité el `@types/express` correspondiente.

### 3. `vite` duplicado en `dependencies` Y `devDependencies` (frontend)
- Estaba mal declarado dos veces — eso confundía a `npm audit` y lo hacía marcar como "producción" cosas que en realidad solo corren durante `vite build` (esbuild, postcss) y nunca llegan al bundle que ve el usuario.
- Dejé `vite` solo en `devDependencies`, que es donde corresponde.

## Lo que NO toqué (y por qué)

### NestJS core/common/platform-express/schedule/swagger — bump mayor (10 → 11)
Hay un advisory moderado real en `@nestjs/core` (inyección vía `@nestjs/platform-express`), pero arreglarlo significa saltar de NestJS 10 a 11 — una migración mayor que puede afectar decoradores custom (`@Public`, `@Roles`, `@CurrentUser`), guards, interceptores y el pipeline de validación que ya tienen. Esto se debe hacer en una rama aparte, con la suite de tests corriendo en verde antes y después. No es algo para forzar a las 11pm sin red de seguridad.

### `@google-cloud/storage` / `firebase-admin` (moderado)
- Ahora mismo `STORAGE_PROVIDER=gcs` está en modo stub (sin `GCS_BUCKET_NAME`), así que este código ni siquiera se ejecuta en producción hoy.
- `firebase-admin` es crítico para el login — no toqué su versión mayor. Cuando migren completamente a S3/MinIO, `@google-cloud/storage` deja de ser necesario y se puede quitar del todo, resolviendo esto de raíz.

### `exceljs` (moderado, vía `archiver`/`glob`/`brace-expansion`)
- Confirmé que en este código `exceljs` solo se usa para **exportar** (generar reportes), nunca para leer archivos subidos por usuarios. Los vectores de esas vulnerabilidades (DoS vía patrones de archivo/glob) requieren que un atacante controle nombres de archivo o rutas — algo que no pasa aquí, porque los datos que se exportan los genera la propia app.
- El "fix" que sugiere `npm audit fix --force` es literalmente una **downgrade** a `exceljs@3.4.0` — perderían funcionalidad de la v4 para resolver un problema con exposición real ≈ cero en su caso de uso. No vale la pena.

### `js-yaml` / `glob` / `minimatch` / `brace-expansion` (backend, vía `@nestjs/swagger` y devtools)
- `js-yaml` solo se usa para serializar el spec de OpenAPI que Swagger genera internamente — nunca parsea YAML que venga de un usuario. Riesgo real: prácticamente nulo.
- El resto de estos son transitivos de `@nestjs/cli`, `jest`, `ts-jest` — puro tooling de desarrollo, no viaja al contenedor de producción (`npm ci --omit=dev`).

### `@sentry/node` / paquetes `@opentelemetry/*` (moderado)
- Estos los agregué yo en la ronda 1. Ahora mismo Sentry está en modo no-op (sin `SENTRY_DSN`), así que no corre nada de este código en producción todavía. Cuando lo actives con una DSN real, vale la pena revisar si ya hay una versión más nueva de `@sentry/node` que resuelva la cadena de OpenTelemetry.

## Qué hacer tú ahora

```bash
cd /Users/josema/Documents/Royaltica/repo

# Traer estos cambios
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
  "/Users/josema/Library/Application Support/Claude/local-agent-mode-sessions/91a5566e-4d0c-4e0d-a701-10fbfb9c7900/bdc6ac21-120c-4293-b8f2-a9c32e91b100/local_9e395e0d-2629-4338-b524-e7177259e1dc/outputs/royaltica/" \
  "/Users/josema/Documents/Royaltica/repo/"

# Regenerar lockfiles (igual que la vez pasada — nunca copies el mío)
cd api && rm package-lock.json && npm install
cd ../frontend && rm package-lock.json && npm install

# Confirmar la mejora
cd ../api && npm audit
cd ../frontend && npm audit

# Deploy cuando quieras
cd ../api && railway up
```

Deberías ver que el conteo de `npm audit` bajó considerablemente en "vulnerabilidades reales" (aunque el número crudo de devDependencies seguirá viéndose alto — eso es ruido, no riesgo).

## Próxima sesión: agenda de upgrade mayor (cuando tengan tiempo de testear)

1. NestJS 10 → 11 (con toda la suite de `jest` en verde antes/después)
2. Decidir si `@google-cloud/storage` se elimina del todo tras terminar la migración a MinIO/S3
3. Revisar `@sentry/node` cuando activen `SENTRY_DSN` de verdad
