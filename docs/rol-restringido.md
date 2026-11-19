# Rol restringido para el backend (`royaltica_app`)

## Por qué

Hoy el backend entra a Postgres como `postgres`, que es superusuario y tiene BYPASSRLS (verificado el 17 nov). Con ese rol Postgres **se salta todas las políticas de RLS**: la separación entre organizaciones depende solo de que el código filtre bien. Con `royaltica_app` (sin superusuario ni BYPASSRLS) las políticas se aplican de verdad dentro de cada `withOrg()`.

## Qué se probó (18 nov, Postgres de prueba con las 38 migraciones)

Con `royaltica_app`:

- Con `app.org_id` de la organización A solo ve los clientes de A, no puede modificar los de B y no puede insertar registros de B.
- Sin `app.org_id` (crons, superadmin) ve todo, igual que hoy. Las políticas están diseñadas así, por eso el cambio no rompe los trabajos programados.
- Puede leer, insertar, actualizar y borrar datos, bloquear filas (`FOR UPDATE`) y usar candados.
- No puede crear tablas ni desactivar RLS.
- El backend no ejecuta ningún cambio de esquema en tiempo de ejecución (revisado). Las migraciones siguen corriendo con `DATABASE_ADMIN_URL` (owner).

## Pasos (José, en la Terminal, desde `~/Documents/Royaltica/repo/api`)

**0. Respaldo:** `bash scripts/respaldo-produccion.sh`

**1. Crear el rol con una contraseña nueva** (no se muestra en pantalla):

```
export APP_PASS=$(openssl rand -hex 24)
railway run --service Postgres -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" /opt/homebrew/opt/libpq/bin/psql -h "$RAILWAY_TCP_PROXY_DOMAIN" -p "$RAILWAY_TCP_PROXY_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v role_password="$APP_PASS" -f prisma/create-restricted-role.sql'
```

**2. Guardar la URL actual del backend** por si hay que regresar (archivo solo para tu usuario, fuera del repo):

```
railway run --service "Royáltica" -- sh -c 'printf %s "$DATABASE_URL"' > ~/Documents/Royaltica/respaldos/.database_url_anterior
chmod 600 ~/Documents/Royaltica/respaldos/.database_url_anterior
```

**3. Cambiar `DATABASE_URL` del backend al rol nuevo** (mismo host y base, solo cambian usuario y contraseña). Railway vuelve a desplegar el backend solo:

```
NUEVA=$(railway run --service "Royáltica" -- node -e 'const u=new URL(process.env.DATABASE_URL);u.username="royaltica_app";u.password=process.env.APP_PASS;process.stdout.write(u.toString())')
railway variables --service "Royáltica" --set "DATABASE_URL=$NUEVA"
unset NUEVA APP_PASS
```

**4. Verificar:**

- En los registros del despliegue debe aparecer "Prisma conectado a la base de datos" y "Nest application successfully started".
- Como superadmin, en el panel de hardening de producción (Growth Ops, que lee `/admin/production-readiness`) aparece el punto nuevo "Base de datos con rol restringido": debe salir en verde con `Rol royaltica_app`. Antes del cambio sale en amarillo con `Rol postgres con superusuario`.
- Abrir la app y revisar Clientes, Pagos y Configuración.

**5. Si algo falla, regresar:**

```
railway variables --service "Royáltica" --set "DATABASE_URL=$(cat ~/Documents/Royaltica/respaldos/.database_url_anterior)"
```

Cuando todo lleve una semana estable, borra `.database_url_anterior` y sigue con la rotación de la contraseña de `postgres` (eso ya solo afecta a `DATABASE_ADMIN_URL`).

## Lo que este cambio no resuelve

Las consultas que no pasan por `withOrg()` siguen viendo todas las organizaciones (las políticas no filtran si no hay `app.org_id`). Cerrar eso es trabajo de código: pasar esas consultas a `withOrg()` o hacer que las políticas fallen cerradas para el rol de la app, con una vía explícita para crons y superadmin.
