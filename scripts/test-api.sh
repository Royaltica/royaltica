#!/bin/bash
BASE_URL="${BASE_URL:-https://royaltica-production.up.railway.app}"
TOKEN="${AUTH_TOKEN:-}"
PASS=0; FAIL=0

t() {
  local s=$(curl -s -o /dev/null -w "%{http_code}" -X "$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${5:+-d "$5"} "${BASE_URL}$2")
  if [ "$s" = "$3" ]; then echo "  ✅ $4 → $s"; PASS=$((PASS+1)); else echo "  ❌ $4 → $s (esperado $3)"; FAIL=$((FAIL+1)); fi
}

echo "══ ROYALTICA API TEST ══"
t GET /health 200 "Health"
[ -n "$TOKEN" ] && {
  t GET /auth/me 200 "Profile"
  t GET "/invoices?page=1&limit=5" 200 "Invoices"
  t GET "/payments?page=1&limit=5" 200 "Payments"
  t GET "/suppliers?page=1&limit=5" 200 "Suppliers"
  t GET /admin/dashboard 200 "Dashboard"
  t GET "/notifications?page=1&limit=5" 200 "Notifications"
  t GET /spei/status 200 "SPEI status"
}
echo "══ ✅ $PASS | ❌ $FAIL ══"
