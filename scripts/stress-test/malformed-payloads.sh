#!/bin/bash
# Pruebas de resiliencia básica ante entradas malas/hostiles: JSON roto,
# strings gigantes, intentos de inyección SQL en parámetros de búsqueda,
# tokens inválidos. NO es un pentest real (no prueba XSS almacenado, CSRF,
# IDOR entre organizaciones, etc. — eso requiere herramientas dedicadas tipo
# OWASP ZAP/Burp y, para IDOR multi-tenant, cuentas de prueba en DOS
# organizaciones distintas). Esto solo confirma que la API responde con
# errores controlados (400/401/413) y no con un 500 que delate un crash o,
# peor, con un 200 que sugiera que la validación se saltó.
set -u
BASE_URL="${BASE_URL:-http://localhost:8080}"
TOKEN="${AUTH_TOKEN:-}"
PASS=0; FAIL=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ $desc → $actual"; PASS=$((PASS+1))
  else
    echo "  ❌ $desc → $actual (esperaba $expected o similar)"; FAIL=$((FAIL+1))
  fi
}

req() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

echo "══ ROYALTICA · pruebas de entradas hostiles ══"
echo "BASE_URL=$BASE_URL"

echo "-- JSON malformado --"
s=$(req -X POST -H "Content-Type: application/json" -d '{"message": "hola"' "$BASE_URL/ai/chat")
check "AI chat con JSON roto (sin token, debería ser 401 antes de parsear body, o 400)" "400" "$s"

echo "-- Mensaje que excede MaxLength(4000) en /ai/chat --"
BIG=$(python3 -c "print('a' * 5000)" 2>/dev/null || printf 'a%.0s' {1..5000})
s=$(req -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"message\": \"$BIG\"}" "$BASE_URL/ai/chat")
check "AI chat con mensaje de 5000 chars (límite es 4000)" "400" "$s"

echo "-- Intento de inyección SQL en búsqueda de proveedores (Prisma parametriza, no debería tronar) --"
s=$(req -G -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "search=' OR '1'='1'; DROP TABLE suppliers;--" \
  "$BASE_URL/suppliers")
if [ "$s" = "200" ]; then
  echo "  ✅ Búsqueda con payload de inyección → 200 sin crash (Prisma parametrizó bien)"; PASS=$((PASS+1))
else
  echo "  ❌ Búsqueda con payload de inyección → $s (esperaba 200; revisa si tronó)"; FAIL=$((FAIL+1))
fi

echo "-- Token JWT basura --"
s=$(req -H "Authorization: Bearer esto-no-es-un-jwt-valido" "$BASE_URL/invoices")
check "Endpoint protegido con JWT basura" "401" "$s"

echo "-- Sin token en absoluto --"
s=$(req "$BASE_URL/invoices")
check "Endpoint protegido sin Authorization header" "401" "$s"

echo "-- Content-Type incorrecto en POST --"
s=$(req -X POST -H "Content-Type: text/plain" -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"hola"}' "$BASE_URL/ai/chat")
check "AI chat con Content-Type: text/plain (debería rechazar el body)" "400" "$s"

echo "-- Rol/estado inexistente en filtro de facturas (enum inválido) --"
s=$(req -H "Authorization: Bearer $TOKEN" "$BASE_URL/invoices?status=ESTADO_QUE_NO_EXISTE")
if [ "$s" = "200" ] || [ "$s" = "400" ]; then
  echo "  ✅ Filtro con enum inválido → $s (manejado, no 500)"; PASS=$((PASS+1))
else
  echo "  ❌ Filtro con enum inválido → $s"; FAIL=$((FAIL+1))
fi

echo "══ ✅ $PASS | ❌ $FAIL ══"
[ "$FAIL" -eq 0 ]
