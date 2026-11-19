# Respaldos, restauración y vigilancia de caídas

Producción está en el plan Hobby de Railway, que no hace respaldos. Hasta contratar Railway Pro (recomendado, ver la cotización en el vault) hay tres capas, de la más simple a la más completa. Ninguna imprime contraseñas en pantalla ni las guarda en el repo.

Todos los comandos se corren en la Terminal de la Mac, desde `~/Documents/Royaltica/repo/api`, con la sesión de Railway iniciada.

## 0. Corregir `DATABASE_PUBLIC_URL` (una vez)

La variable del servicio Postgres trae un host que no existe (`algo.proxy.rlwy.net`). Se reescribe con las referencias de Railway, así se mantiene sola si cambia el proxy:

```
railway variables --service Postgres --set 'DATABASE_PUBLIC_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}/${{PGDATABASE}}'
```

Las comillas simples son necesarias: evitan que la Terminal intente expandir `${{...}}`. Railway puede reiniciar el servicio Postgres al guardar la variable (unos segundos).

## 1. Respaldo manual desde la Mac

```
bash scripts/respaldo-produccion.sh
```

- Guarda `royaltica-AAAA-MM-DD-HHMM.dump` en `~/Documents/Royaltica/respaldos/` (fuera del repo, permisos solo para tu usuario).
- Verifica que el archivo traiga las tablas clave; si no, lo borra y avisa.
- Conserva los 30 más recientes y anota cada corrida en `respaldos.log`.

Se corre siempre antes de una migración (lista de despliegue).

## 2. Prueba de restauración (criterio del 9 dic: "respaldo restaurado de verdad")

Una vez: `brew install postgresql@17`. Después:

```
bash scripts/probar-restauracion.sh
```

Levanta un Postgres temporal en la Mac, restaura el respaldo más reciente, muestra cuántos registros hay por tabla y la última migración, y borra todo al terminar. No toca producción. Si la restauración funciona, queda anotada en `respaldos.log`.

## 3. Respaldo diario automático en GitHub (fuera de Railway)

El flujo `.github/workflows/respaldo-diario.yml` corre a las 03:17 de CDMX:

1. Hace `pg_dump` de producción.
2. Lo restaura en un Postgres temporal del runner y revisa que haya organizaciones (prueba de restauración diaria).
3. Lo cifra con AES-256 y lo guarda 14 días como artifact del repo.

Si algo falla, GitHub te manda un correo. No corre hasta configurar dos secretos.

**a. Crear un rol de solo lectura para respaldos** (así en GitHub no vive la contraseña del owner):

```
export RESPALDO_PASS=$(openssl rand -hex 24)
railway run --service Postgres -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" /opt/homebrew/opt/libpq/bin/psql -h "$RAILWAY_TCP_PROXY_DOMAIN" -p "$RAILWAY_TCP_PROXY_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v role_password="$RESPALDO_PASS" -f prisma/create-backup-role.sql'
```

**b. Copiar la URL de ese rol al portapapeles** (no se muestra en pantalla):

```
railway run --service Postgres -- node -e 'const u=new URL(`postgresql://x@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${process.env.POSTGRES_DB}`);u.username="royaltica_respaldo";u.password=process.env.RESPALDO_PASS;process.stdout.write(u.toString())' | pbcopy
unset RESPALDO_PASS
```

**c. En GitHub:** repo › Settings › Secrets and variables › Actions › New repository secret:
- `PROD_DATABASE_URL`: pega lo del portapapeles.
- `RESPALDO_CLAVE`: genera una con `openssl rand -base64 32 | pbcopy`, pégala aquí **y guárdala en tu gestor de contraseñas** (sin ella no se pueden abrir los respaldos).

**d. Probar:** pestaña Actions › "Respaldo diario de producción" › Run workflow.

**Para usar un respaldo de GitHub:** descarga el artifact, descomprime el zip y:

```
gpg --decrypt royaltica-AAAA-MM-DD.dump.gpg > royaltica-AAAA-MM-DD.dump
bash scripts/probar-restauracion.sh royaltica-AAAA-MM-DD.dump
```

## 4. Vigilancia de caídas

`.github/workflows/vigilancia.yml` revisa cada hora que `api.royaltica.com/health` responda con base y Redis en "ok" y que `app.royaltica.com` cargue; si falla 3 veces seguidas, GitHub avisa por correo. Es un mínimo: consume unos 720 minutos de Actions al mes y solo revisa cada hora. Para avisos cada 5 minutos por correo o WhatsApp, crear un monitor en UptimeRobot (plan gratuito, confirmar sus términos) apuntando a `https://api.royaltica.com/health` con la palabra clave `"status":"ok"`.

## Cuándo se vuelve innecesario

Con Railway Pro (respaldos programados en el panel), la capa 3 se puede quedar como copia independiente fuera de Railway o apagarse. La prueba de restauración (capa 2) se sigue haciendo una vez al mes.
