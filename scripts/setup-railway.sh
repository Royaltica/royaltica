#!/usr/bin/env bash
# setup-railway.sh — imprime los comandos sugeridos para ampliar el proyecto.
#
# ESTE SCRIPT NO EJECUTA NADA: solo imprime los comandos para que los revises
# y copies/pegues los que quieras. Es una ayuda de memoria alineada con
# docs/RAILWAY_SETUP.md.
#
# Uso:
#   ./scripts/setup-railway.sh
#
# Requisitos:
#   - Railway CLI (brew install railway) autenticada (railway login)
#   - Estar en el directorio raíz del monorepo con `railway link` hecho

set -eu

C_GREEN='\033[0;32m'
C_YELLOW='\033[0;33m'
C_CYAN='\033[0;36m'
C_BOLD='\033[1m'
C_RESET='\033[0m'

section() {
  echo -e "\n${C_BOLD}${C_CYAN}━━━ $1 ━━━${C_RESET}"
}
note() {
  echo -e "${C_YELLOW}⚠  $1${C_RESET}"
}
cmd() {
  echo -e "${C_GREEN}\$ $1${C_RESET}"
}

echo -e "${C_BOLD}Royáltica — comandos sugeridos de setup en Railway${C_RESET}"
echo "Copia/pega los que necesites. Revisa docs/RAILWAY_SETUP.md para contexto."

section "0. Contexto actual"
cmd "railway status"
cmd "railway variables --service royaltica"

section "1. Resend (leads: demo + contacto)"
note "Crea tu API key en https://resend.com/api-keys y verifica royaltica.com"
cmd "railway variables --service royaltica \\
     --set RESEND_API_KEY=re_xxx \\
     --set RESEND_FROM_EMAIL=hola@royaltica.com \\
     --set LEADS_EMAIL=leads@royaltica.com"

section "2. Migración Prisma (tabla Lead)"
cmd "railway run --service royaltica -- npm run prisma:deploy"

section "3. Sentry (backend)"
note "Crea proyecto Node.js en https://sentry.io y copia el DSN"
cmd "railway variables --service royaltica \\
     --set SENTRY_DSN=https://xxx@ooo.ingest.sentry.io/yyy \\
     --set SENTRY_ENVIRONMENT=production \\
     --set SENTRY_TRACES_SAMPLE_RATE=0.1"

section "3b. Sentry (frontend, vía Vercel)"
note "Vercel env vars — necesitan el prefijo VITE_"
cmd "vercel env add VITE_SENTRY_DSN production"
cmd "vercel env add VITE_SENTRY_ENVIRONMENT production"

section "4. MinIO (S3-compatible) — desde Dashboard"
note "Ve al Dashboard → New → Template → 'MinIO' → Deploy"
note "Después crea el bucket 'royaltica-files' desde la consola MinIO"
cmd "railway variables --service royaltica \\
     --set STORAGE_PROVIDER=s3 \\
     --set S3_ENDPOINT='https://\${{MinIO.RAILWAY_PRIVATE_DOMAIN}}:9000' \\
     --set S3_REGION=us-east-1 \\
     --set S3_BUCKET=royaltica-files \\
     --set S3_ACCESS_KEY_ID='\${{MinIO.MINIO_ROOT_USER}}' \\
     --set S3_SECRET_ACCESS_KEY='\${{MinIO.MINIO_ROOT_PASSWORD}}' \\
     --set S3_FORCE_PATH_STYLE=true"

section "5. Meilisearch (búsqueda) — desde Dashboard"
note "Ve al Dashboard → New → Template → 'Meilisearch' → Deploy"
cmd "railway variables --service royaltica \\
     --set MEILI_HOST='http://\${{Meilisearch.RAILWAY_PRIVATE_DOMAIN}}:7700' \\
     --set MEILI_MASTER_KEY='\${{Meilisearch.MEILI_MASTER_KEY}}'"

section "6. Uptime-Kuma (uptime monitoring) — desde Dashboard"
note "Dashboard → New → Template → 'Uptime Kuma' → Deploy"
note "Después: Add Monitor → https://royaltica-production.up.railway.app/health"

section "7. Instalar deps nuevas y redeploy"
cmd "cd api && npm install"
cmd "cd frontend && npm install"
cmd "railway up --service royaltica"

section "8. Sanity check post-deploy"
cmd "curl -sS https://royaltica-production.up.railway.app/health"
cmd "curl -X POST https://royaltica-production.up.railway.app/marketing/demo \\
     -H 'Content-Type: application/json' \\
     -d '{\"name\":\"Ana Test\",\"company\":\"Acme\",\"email\":\"ana@test.mx\"}'"

echo -e "\n${C_BOLD}Listo. Revisa docs/RAILWAY_SETUP.md para más detalle.${C_RESET}"
