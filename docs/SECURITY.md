# Seguridad

Postura de seguridad actual: qué está implementado, qué es un riesgo conocido y aceptado temporalmente, y cómo reportar un hallazgo. Este documento se actualiza cada vez que cambia algo relevante — si encuentras algo aquí que ya no es cierto, corrígelo en el mismo PR que cambió el código.

## Implementado

- **Autenticación JWT** con expiración corta (`JWT_EXPIRES_IN`, default 8h) + refresh token.
- **2FA TOTP** (RFC 6238): el secreto se cifra con AES-256-GCM antes de guardarse (`TOTP_ENCRYPTION_KEY`, o derivado de `JWT_SECRET` si falta). El primer paso del login solo entrega un `tempToken` de 5 minutos; el JWT completo requiere el código de 6 dígitos.
- **Row Level Security en Postgres**, reforzada por `PrismaService.withOrg()` en los 10 modelos multi-tenant (ver `docs/ARCHITECTURE.md` para el detalle y las excepciones intencionales).
- **Rate limiting**: 100 req/min global, 5 req/min en endpoints de auth (login, 2FA).
- **Helmet**: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, HSTS, `nosniff`, `Referrer-Policy: no-referrer`.
- **CORS con whitelist explícita**: `ALLOWED_ORIGINS` es obligatorio en producción; `*` está bloqueado por código (el server ni siquiera arranca si intentas ponerlo).
- **Validación estricta de entrada**: `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` — cualquier campo no declarado en el DTO se rechaza, no se ignora silenciosamente.
- **Sin SQL crudo**: todo pasa por Prisma parametrizado.
- **Sin secretos en el bundle del frontend**: sin variables `VITE_*` con API keys privadas.
- **Webhooks salientes firmados con HMAC-SHA256**: el secreto completo se muestra una sola vez al crear el endpoint; después solo queda una pista (`secretHint`).
- **Documentación Swagger protegida** con Basic Auth (`SWAGGER_USER`/`SWAGGER_PASS`) en `/docs`.

## Riesgos conocidos y aceptados temporalmente

Estos son gaps reales, documentados a propósito para que nadie los redescubra desde cero ni asuma que están resueltos:

### `ALLOW_DEV_LOGIN=true` en el ambiente de demo actual

`POST /auth/dev-login` emite un JWT válido para cualquier usuario existente solo con su email, sin verificar contraseña ni identidad real (la "contraseña" que pide el frontend es una constante hardcodeada del lado del cliente, no algo que el backend valide). Está bloqueado por default cuando `NODE_ENV=production`, pero el ambiente de demo actual lo tiene activado explícitamente vía la variable `ALLOW_DEV_LOGIN` porque Firebase Admin todavía no está configurado.

**Mientras esté activo:** cualquiera que sepa la URL del backend y un email de usuario válido (los de la demo son públicos en este mismo README) puede obtener una sesión completa como ese usuario. Es aceptable para un ambiente de demo/staging sin datos reales de clientes; **no debe estar activo si hay datos reales de un cliente en esa base de datos.**

**Cómo desactivarlo:**
```bash
cd api
railway variables --set "ALLOW_DEV_LOGIN=false"
```

**Solución real:** configurar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y migrar el login a Firebase Auth real.

### Rol de base de datos sin restringir en producción

`DATABASE_URL` en producción usa el mismo rol con privilegios de owner que `DATABASE_ADMIN_URL` (necesario para migraciones). El diseño correcto es que el runtime use un rol restringido (`royaltica_app`, `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`, con `GRANT` explícito solo sobre las tablas necesarias) — ya documentado como paso en el setup local del `README.md`, pero **no creado todavía en la base de producción de Railway**.

Impacto: si el backend tuviera una vulnerabilidad de inyección (mitigada hoy por Prisma parametrizado) o un bug que ejecute SQL con más alcance del previsto, el rol actual no tiene el límite adicional que un rol restringido daría. Es defensa en profundidad, no la única barrera — RLS y el filtrado por `organizationId` siguen aplicando independientemente del rol.

### Vulnerabilidades de dependencias sin resolver

`npm audit` reporta 29 vulnerabilidades en el backend (3 bajas / 22 moderadas / 4 altas) y 3 en el frontend. `npm audit fix` (sin `--force`) no resuelve ninguna — todas requieren `--force` con cambios que rompen compatibilidad en `@nestjs/cli`, `@nestjs/platform-express`, `@nestjs/swagger`, `@nestjs/schedule` y `exceljs`. Decisión del equipo: posponer hasta tener cobertura de tests suficiente para verificar que el upgrade no rompe nada (ver `README.md` → Pendientes y roadmap).

## Cómo reportar un hallazgo de seguridad

Este es un proyecto privado en fase de demo/staging, sin canal formal de disclosure público todavía. Si encuentras algo:

1. No lo publiques ni lo pruebes contra el ambiente de producción más allá de confirmar que existe.
2. Repórtalo directo al equipo (no abras un Issue público en GitHub si el repo llegara a ser público).
3. Si es explotable y afecta datos reales de un cliente, prioriza notificar antes de seguir investigando.
