#!/bin/bash
# ============================================================
# Respaldo de la base de PRODUCCIÓN (Railway) desde la Mac de José.
#
# - pg_dump en formato custom (-Fc), con la URL pública del proxy TCP.
# - Verifica que el archivo se pueda leer con pg_restore y que traiga
#   las tablas clave.
# - Conserva los 30 respaldos más recientes.
#
# Requisitos: Railway CLI con sesión iniciada en el proyecto y libpq
# (brew install libpq). Correr desde api/:
#   bash scripts/respaldo-produccion.sh
# Para probar que se puede restaurar: bash scripts/probar-restauracion.sh
# Pasos completos en docs/respaldos.md.
# ============================================================
set -euo pipefail

RESPALDOS_DIR="${RESPALDOS_DIR:-$HOME/Documents/Royaltica/respaldos}"
LIBPQ_BIN="${LIBPQ_BIN:-/opt/homebrew/opt/libpq/bin}"
CONSERVAR="${CONSERVAR:-30}"
STAMP=$(date +%Y-%m-%d-%H%M)
ARCHIVO="$RESPALDOS_DIR/royaltica-$STAMP.dump"

mkdir -p "$RESPALDOS_DIR"
chmod 700 "$RESPALDOS_DIR"

if [ ! -x "$LIBPQ_BIN/pg_dump" ]; then
  echo "No encuentro pg_dump en $LIBPQ_BIN. Instala libpq: brew install libpq" >&2
  exit 1
fi

# Las credenciales solo existen dentro de `railway run`; no se imprimen.
railway run --service Postgres -- env LIBPQ_BIN="$LIBPQ_BIN" ARCHIVO="$ARCHIVO" sh -c '
  if [ -z "${RAILWAY_TCP_PROXY_DOMAIN:-}" ] || [ -z "${RAILWAY_TCP_PROXY_PORT:-}" ]; then
    echo "El servicio Postgres no expone RAILWAY_TCP_PROXY_DOMAIN/PORT." >&2
    exit 1
  fi
  PGPASSWORD="$POSTGRES_PASSWORD" "$LIBPQ_BIN/pg_dump" \
    -h "$RAILWAY_TCP_PROXY_DOMAIN" -p "$RAILWAY_TCP_PROXY_PORT" \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$ARCHIVO"
'
chmod 600 "$ARCHIVO"

# Verificación: el índice del respaldo debe listar las tablas clave.
LISTA=$("$LIBPQ_BIN/pg_restore" --list "$ARCHIVO")
for TABLA in Organization Invoice Customer _prisma_migrations; do
  if ! grep -Eq "TABLE DATA public \"?${TABLA}\"? " <<<"$LISTA"; then
    echo "FALLÓ la verificación: el respaldo no trae datos de $TABLA." >&2
    rm -f "$ARCHIVO"
    exit 1
  fi
done

TAMANO=$(du -h "$ARCHIVO" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M') OK $ARCHIVO ($TAMANO)" | tee -a "$RESPALDOS_DIR/respaldos.log"

# Rotación: conservar los $CONSERVAR más recientes de este script.
ls -t "$RESPALDOS_DIR"/royaltica-????-??-??-????.dump 2>/dev/null | tail -n +$((CONSERVAR + 1)) | while read -r viejo; do
  rm -f "$viejo"
done
