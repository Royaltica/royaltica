#!/bin/bash
# ============================================================
# Prueba de restauración: levanta un Postgres temporal en tu Mac, restaura
# un respaldo y cuenta registros de las tablas clave. No toca producción.
# Al terminar apaga el servidor y borra la copia temporal.
#
# Requisitos: brew install postgresql@17 (servidor local de prueba).
# Uso, desde api/:
#   bash scripts/probar-restauracion.sh                 # el respaldo más reciente
#   bash scripts/probar-restauracion.sh <archivo.dump>  # uno en particular
# ============================================================
set -euo pipefail

RESPALDOS_DIR="${RESPALDOS_DIR:-$HOME/Documents/Royaltica/respaldos}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
PUERTO="${PUERTO:-55432}"
ARCHIVO="${1:-$(ls -t "$RESPALDOS_DIR"/*.dump 2>/dev/null | head -n 1 || true)}"

if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "No encontré un respaldo .dump en $RESPALDOS_DIR." >&2
  exit 1
fi
if [ ! -x "$PGBIN/initdb" ]; then
  echo "Falta el servidor de Postgres local. Instálalo con: brew install postgresql@17" >&2
  exit 1
fi

TMP=$(mktemp -d)
cleanup() {
  "$PGBIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "Restaurando $(basename "$ARCHIVO") en un Postgres temporal (puerto $PUERTO)..."
"$PGBIN/initdb" -D "$TMP/data" -U prueba --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PUERTO -k $TMP" -l "$TMP/server.log" -w start >/dev/null
"$PGBIN/createdb" -h "$TMP" -p "$PUERTO" -U prueba restaurada

# --no-owner/--no-acl: los roles de producción no existen en la copia local.
INICIO=$(date +%s)
if ! "$PGBIN/pg_restore" -h "$TMP" -p "$PUERTO" -U prueba -d restaurada \
  --no-owner --no-acl --exit-on-error "$ARCHIVO"; then
  echo "FALLÓ la restauración. Revisa $TMP/server.log antes de que se borre." >&2
  exit 1
fi
SEGUNDOS=$(( $(date +%s) - INICIO ))

psql_q() { "$PGBIN/psql" -h "$TMP" -p "$PUERTO" -U prueba -d restaurada -At -c "$1"; }
echo
echo "Restauración correcta en ${SEGUNDOS}s. Registros por tabla:"
for TABLA in Organization User Customer Invoice InvoicePayment BankTransaction WhatsappMessage CollectionPolicy; do
  printf '  %-18s %s\n' "$TABLA" "$(psql_q "SELECT count(*) FROM \"$TABLA\"")"
done
echo "  Última migración:  $(psql_q 'SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 1')"
echo
echo "$(date '+%Y-%m-%d %H:%M') RESTAURACIÓN OK $(basename "$ARCHIVO") (${SEGUNDOS}s)" >> "$RESPALDOS_DIR/respaldos.log"
