# Despliegue

Runbook de cómo está desplegado hoy y cómo repetirlo desde cero (nuevo ambiente, o si hay que recrear algo). Estado actual: frontend en Vercel, backend + Postgres + Redis en Railway.

## Backend (Railway)

### Primera vez / desde cero

```bash
npm install -g @railway/cli
railway login
cd api
railway init            # crea el proyecto, o usa uno existente
```

Si el repo pertenece a otra cuenta de GitHub distinta a la tuya (aunque seas colaborador), Railway puede no mostrarlo en el selector de "Deploy from GitHub" — su GitHub App solo tiene acceso a los repos del dueño de la conexión. La forma confiable de todas formas es la CLI, que sube el código local directo sin pasar por el GitHub App:

```bash
railway up
```

Agrega Postgres y Redis como servicios del mismo proyecto (botón "+ New" en el dashboard → Database → PostgreSQL / Redis, o `railway add`). Luego enlaza las variables del servicio backend a esos servicios con referencias:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

No pegues la URL de conexión a mano — usa la sintaxis `${{Servicio.VARIABLE}}` para que Railway la resuelva dinámicamente.

### Variables de entorno a configurar

Mínimo para que arranque (ver `README.md` → Variables de entorno para la lista completa):

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<genera con: openssl rand -hex 32>
NODE_ENV=production
ALLOWED_ORIGINS=https://tu-frontend.vercel.app
```

Si todavía no hay Firebase configurado y necesitas login temporal para probar: `ALLOW_DEV_LOGIN=true` (ver advertencia de seguridad en `docs/SECURITY.md` — apagar en cuanto haya login real).

### Migraciones

Las migraciones NO corren solas en el deploy — hay que aplicarlas a mano contra la base de producción, apuntando `DATABASE_URL` temporalmente a la URL pública (no la interna `*.railway.internal`, que solo es alcanzable desde dentro de Railway):

```bash
cd api
DATABASE_URL="<url pública de Postgres, Settings → Networking del servicio Postgres>" \
  npx prisma migrate deploy
```

### Seed (datos de demo)

```bash
cd api
DATABASE_URL="<misma url pública>" npm run seed
```

Esto borra y recrea los datos de demo (1 organización, 3 usuarios, 5 proveedores, 20 facturas) — no correrlo contra una base con datos reales de un cliente.

### Redeploy

```bash
cd api
railway up
```

### Generar dominio público

```bash
railway service   # selecciona el servicio del backend si no está linkeado
railway domain    # genera algo tipo *.up.railway.app
```

Si sale "No service linked", corre `railway service` primero — pasa seguido después de cambiar de carpeta en la misma sesión de terminal.

### Notas de la imagen Docker (por qué el Dockerfile se ve así)

- `nest build` compila `src/main.ts` a `dist/src/main.js`, no `dist/main.js` — `tsconfig.json` no define `rootDir` explícito y como `include` abarca tanto `src/` como `prisma/`, TypeScript infiere la raíz del proyecto como rootDir. El `CMD` del Dockerfile usa `npm run start:prod`, que ya apunta a la ruta correcta en `package.json` — si algún día alguien lo cambia a `node dist/main.js` directo, va a crashear con `MODULE_NOT_FOUND`.
- `node:20-alpine` no trae OpenSSL instalado por default. Prisma necesita el binario `openssl` real (no solo el libcrypto interno de Node) para detectar la versión y generar/cargar el engine correcto — sin él, cae al default hardcodeado `openssl-1.1.x`, que no existe en Alpine reciente (trae OpenSSL 3), y truena en runtime con `Error loading shared library libssl.so.1.1`. Por eso el Dockerfile tiene `RUN apk add --no-cache openssl` en las dos etapas (build y production, porque cada una corre su propio `prisma generate`).

### Verificar que quedó bien

```bash
curl https://<tu-dominio>.up.railway.app/health
# Esperado: {"status":"ok","db":"ok","redis":"ok","timestamp":"..."}
```

## Frontend (Vercel)

### Primera vez / desde cero

```bash
npm install -g vercel
cd frontend
vercel login
vercel --prod
```

Cuando pregunte por el proyecto, elige "Create a new project" (a menos que ya exista uno). No hace falta configurar variables de entorno para el build — `apiClient.ts` usa una ruta fija `/api` y depende del `rewrite` de `vercel.json`, no de `VITE_API_URL`.

### `vercel.json`

Ya está en el repo (`frontend/vercel.json`) con el `rewrite` de `/api/*` hacia el backend. **Actualiza la URL de `destination` ahí cuando el backend cambie de dominio** (por ejemplo, si se recrea el servicio de Railway):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://TU-BACKEND.up.railway.app/:path*" }
  ]
}
```

### CORS: mantener sincronizado con el backend

Cada vez que el dominio del frontend cambie (nuevo proyecto de Vercel, dominio custom, etc.), actualiza `ALLOWED_ORIGINS` en Railway:

```bash
cd api
railway variables --set "ALLOWED_ORIGINS=https://tu-nuevo-dominio.vercel.app,http://localhost:5173"
```

Si se te olvida, el navegador va a bloquear las peticiones por CORS aunque el backend esté sano — es el primer lugar a revisar si el frontend "no carga nada" pero `/health` responde bien directo.

### Verificar que el proxy funciona de punta a punta

```bash
curl https://tu-frontend.vercel.app/api/health
# Debe responder EXACTAMENTE igual que pegarle directo al backend
```

## Checklist post-deploy

- [ ] `GET /health` del backend responde `db: ok`, `redis: ok`
- [ ] `GET /api/health` a través del frontend responde igual (confirma el rewrite)
- [ ] Login funciona (dev-login con `ALLOW_DEV_LOGIN=true`, o Firebase si ya está configurado)
- [ ] `ALLOWED_ORIGINS` incluye el dominio real del frontend (no solo `localhost`)
- [ ] Si acabas de aplicar una migración nueva, confirma con `npx prisma migrate status` contra la URL pública
