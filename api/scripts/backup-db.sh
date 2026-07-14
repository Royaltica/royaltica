#!/bin/bash
# ============================================================
# Backup automático de la base de datos Royáltica (Postgres en Docker).
# - Dump completo comprimido con fecha.
# - VERIFICACIÓN de integridad (gzip -t + contenido no vacío).
# - Rotación: conserva los últimos 14 respaldos.
# Programado diario a las 03:00 vía launchd (com.royaltica.backup).
# Correr a mano: bash scripts/backup-db.sh
# Restaurar:  gunzip -c <archivo>.sql.gz | docker exec -i royaltica-postgres psql -U royaltica -d royaltica
# ============================================================
set -euo pipefail

BACKUP_DIR="$HOME/RoyalticaBackups"
CONTAINER="royaltica-postgres"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/royaltica-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
  echo "[backup] $(date) — contenedor $CONTAINER no está corriendo; se omite." >> "$BACKUP_DIR/backup.log"
  exit 0
fi

docker exec "$CONTAINER" pg_dump -U royaltica --clean --if-exists royaltica | gzip > "$FILE"

# Verificación: el gzip debe ser válido y el dump debe contener el schema.
if ! gzip -t "$FILE" 2>/dev/null || [ "$(gunzip -c "$FILE" | head -c 200000 | grep -c 'CREATE TABLE')" -eq 0 ]; then
  echo "[backup] $(date) — FALLÓ la verificación de $FILE" >> "$BACKUP_DIR/backup.log"
  rm -f "$FILE"
  exit 1
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "[backup] $(date) — OK $FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"

# Rotación: conservar los 14 más recientes.
ls -t "$BACKUP_DIR"/royaltica-*.sql.gz 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null || true
