# Staging (copia de prueba de Royáltica)

**Objetivo:** probar cada cambio y los archivos reales de los pilotos sin tocar producción. Regla: nunca se prueban datos de clientes reales en producción.

| Pieza | Producción | Staging |
|---|---|---|
| Backend y base (Railway) | entorno `production` | entorno `staging` del mismo proyecto, con su propia base y su propio Redis |
| Frontend (Vercel) | proyecto actual, rama `main` | proyecto nuevo, rama `develop` |
| Inicio de sesión (Firebase) | proyecto `royaltica` | al principio, el mismo proyecto con el dominio de staging autorizado; después, un proyecto aparte |
| WhatsApp y correo | reales | apagados (modo stub) hasta tener número de prueba |

Lo que requiere cuenta (José) va marcado con **[José]**. El código ya está listo: el frontend acepta `VITE_API_BASE` y `VITE_FIREBASE_CONFIG`, y la semilla Piloto Demo acepta un host de staging explícito.

## 1. Backend en Railway

1. **[José]** En el proyecto de Railway: Environments › New Environment › **Duplicate** `production` y nómbralo `staging`. Railway crea servicios nuevos (Royáltica, Postgres, Redis, Meilisearch) con una base vacía.
2. **[José]** En `staging` › servicio Royáltica › Variables, cambia:
   - `DATABASE_URL` y `DATABASE_ADMIN_URL`: las del Postgres de staging (referencia `${{Postgres.DATABASE_URL}}`), nunca las de producción.
   - `ALLOWED_ORIGINS`: el dominio del frontend de staging (paso 2).
   - `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`: vacías (modo stub, no se manda nada). `RESEND_API_KEY`: vacía, para que no salgan correos reales.
   - `SENTRY_ENVIRONMENT=staging`.
   - `ALLOW_DEV_LOGIN=false`.
   - Stripe, Conekta y cualquier llave: solo llaves de prueba o vacías.
3. **[José]** Settings › Networking del servicio Royáltica de staging: genera un dominio (`*.up.railway.app`) o agrega `api-staging.royaltica.com` (DNS CNAME, como en `docs/dns-royaltica-com.md`).
4. Migraciones en la base de staging, desde `api/`:
   ```
   railway run --environment staging --service "Royáltica" -- npm run prisma:deploy
   ```
5. Despliegue del backend de staging desde la rama a probar:
   ```
   railway up --environment staging --service "Royáltica"
   ```
6. Datos de práctica (Piloto Demo) en staging. La semilla exige el host exacto y nunca corre con `NODE_ENV=production`:
   ```
   railway run --environment staging --service Postgres -- sh -c 'NODE_ENV=development DATABASE_URL="$DATABASE_PUBLIC_URL" PILOT_SEED_ALLOW_HOST="$RAILWAY_TCP_PROXY_DOMAIN" npm run seed:piloto'
   ```

## 2. Frontend en Vercel

1. **[José]** Vercel › Add New › Project › el mismo repo, Root Directory `frontend`, nombre `royaltica-staging`. En Settings › Git, Production Branch = `develop`.
2. **[José]** Variables de entorno del proyecto de staging:
   - `VITE_API_BASE` = URL del backend de staging (por ejemplo `https://api-staging.royaltica.com`).
   - `VITE_SENTRY_ENVIRONMENT=staging`.
   - `VITE_FIREBASE_CONFIG`: déjala vacía mientras uses el Firebase de producción.
3. **[José]** Dominio: `staging.royaltica.com` (o el `*.vercel.app` que da Vercel). Ese dominio va en `ALLOWED_ORIGINS` del backend de staging.

## 3. Firebase

- **Inicio rápido:** Firebase › Authentication › Settings › Authorized domains › agrega el dominio de staging. Los usuarios inician sesión con su cuenta de siempre; en la base de staging se crean con el superadmin.
- **Después (recomendado):** proyecto de Firebase aparte (`royaltica-staging`). Su configuración web va en `VITE_FIREBASE_CONFIG` (Vercel de staging) y su cuenta de servicio en `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` (Railway de staging).

## 4. Rama `develop` y flujo de trabajo

```
git checkout main && git pull
git checkout -b develop && git push -u origin develop
```

- Los PR van a `develop`; Vercel de staging publica `develop` solo y el backend de staging se despliega con `railway up --environment staging`.
- Martes y viernes se promueve `develop` a `main` con un PR, siguiendo la lista de despliegue (respaldo, migraciones, backend y fusión).
- Para que CI también corra en los PR a `develop`, `.github/workflows/ci.yml` ya acepta esa rama.

## 5. Costo

Staging consume uso de Railway como producción. Para ahorrar, apaga los servicios de staging cuando no se usen (Railway › servicio › Settings › Sleep o eliminar el despliegue) y vuelve a desplegar cuando toque probar.
