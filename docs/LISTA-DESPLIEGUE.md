# Lista de despliegue a producción

Orden obligatorio porque el backend (Railway) se despliega a mano y el frontend (Vercel) se publica solo al fusionar en `main`. Se usó así el 12 y el 17 nov 2026.

## Antes
- [ ] El PR pasó CI (tsc y jest del backend; tsc, pruebas y build del frontend).
- [ ] Revisado por el dueño del área (José: migraciones, pagos, WhatsApp, permisos).
- [ ] Si trae migración: es aditiva (columnas nuevas nulas o con valor por defecto, tablas nuevas) y el código viejo funciona contra el esquema nuevo.
- [ ] Probado en staging (cuando exista).

## Paso a paso (desde `~/Documents/Royaltica/repo/api`, en la rama del PR)
1. Respaldo (no hay respaldos automáticos):
   `railway run --service Postgres -- sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" /opt/homebrew/opt/libpq/bin/pg_dump -h thomas.proxy.rlwy.net -p 38813 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$HOME/Documents/Royaltica/respaldos/royaltica-AAAA-MM-DD.dump"'`
   y `ls -lh ~/Documents/Royaltica/respaldos/` (tamaño mayor a 0).
2. Probar local: `npx prisma generate && npm run build && npm test`.
3. Migraciones: `railway run --service "Royáltica" -- npm run prisma:deploy`.
4. Verificar aislamiento: correr `api/prisma/sql/verificar-aislamiento.sql` en Railway › Postgres › Data (la primera consulta debe dar 0 filas).
5. Backend: `railway up` y esperar "Nest application successfully started".
6. Salud: `https://api.royaltica.com/health` debe responder `"status":"ok"`.
7. Fusionar el PR en GitHub (Vercel publica el frontend) y esperar el despliegue en estado READY.
8. Revisar en app.royaltica.com las pantallas que tocó el PR.
9. Revisar Sentry y los registros de Railway 30 minutos.

## Si algo falla
- Backend: volver a desplegar el commit anterior (`git checkout <commit-anterior> && cd api && railway up`). Las migraciones aditivas no estorban al código anterior.
- Frontend: botón "Revert" del PR en GitHub (Vercel vuelve a publicar lo anterior).
- Datos: restaurar el respaldo del paso 1 **en una base temporal primero** y comparar antes de tocar producción.
- Emergencia de envíos: Cobranza IA › Configuración › Reglas › "Pausar todos los envíos".
