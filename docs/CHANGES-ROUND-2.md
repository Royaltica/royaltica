# Cambios de la segunda ronda — mientras estabas fuera

> **Nada commiteado.** Todo vive en tu carpeta local después del rsync.
> Lo primero: **arreglar el deploy fallido**. Luego ya revisas lo demás con calma.

---

## 🚨 PRIMERO: fix del deploy que falló

**Causa muy probable:** hiciste `railway up` desde `/repo` (raíz del monorepo), pero Railway tiene el servicio configurado con Root Directory = `/api`. Al cambiar el contexto, no encontró el Dockerfile → build failed en 2 segundos.

**Fix (30 segundos):**
```bash
cd /Users/josema/Documents/Royaltica/repo/api
railway up
```
Ahora el contexto de subida es solo `/api/`, donde está el Dockerfile. Debería tardar 2-3 min y quedar Active.

Si aún falla después de eso, corre `railway logs --build` y pásame las últimas 20 líneas — ya sería otra cosa (probablemente el `npm ci` chocando con package-lock).

---

## 📦 Cambios nuevos (además de todo lo de la ronda 1)

### 1. Honeypot anti-spam en los formularios públicos
- Nuevo campo oculto `website` en `ScheduleDemoDto` y `ContactDto`.
- Input invisible en el HTML (position:absolute; left:-9999px; aria-hidden).
- Si un bot lo llena, el backend responde 200 falso y no guarda nada.
- Bloquea ~90% de bots sin fricción para usuarios reales.

### 2. UTM tracking automático
- Nuevo helper `buildLeadSource()` en `App.tsx` que combina `location.host` +
  `utm_source/medium/campaign/term/content` + `referrer`.
- Se manda en `source` a los endpoints `/marketing/*`.
- Ahora vas a saber que un lead vino de "royaltica.com?utm_source=linkedin&utm_medium=organic&ref=twitter.com".

### 3. Admin panel de leads (backend + frontend)
- **Backend:** nuevo controller `admin-leads.controller.ts` + servicio `leads-admin.service.ts`
  bajo `/admin/leads`. Solo `SUPERADMIN`.
  - `GET /admin/leads` — lista con filtros (type, status, search) y paginación
  - `GET /admin/leads/summary` — contadores para dashboard
  - `GET /admin/leads/:id`
  - `PATCH /admin/leads/:id` — cambia status + nota interna (se anexa al `message` con timestamp)
  - `DELETE /admin/leads/:id`
- **Frontend:** nuevo componente standalone en `frontend/src/features/admin/LeadsAdminPanel.tsx` — lista + detalle + filtros + botones para cambiar status. Lo dejé independiente para que lo montes cuando quieras en el `AdminDashboard` de App.tsx.

### 4. Script de reindex de Meilisearch
- `api/scripts/reindex-search.ts` recorre suppliers/invoices/customers en
  Postgres y los mete en Meili en batches de 500.
- Nuevo script en package.json: `npm run reindex:search`
- Uso: `railway run -- npm run reindex:search` para reindexar en prod.

### 5. Slack webhook opcional para leads nuevos
- Nuevo helper genérico `api/src/common/slack-notifier.ts` — POST directo al webhook, sin SDK.
- Cuando llegue un lead demo/contact, además del correo se pushea a Slack
  con formato bonito (blocks: header + fields + mensaje).
- Se activa solo si `SLACK_LEADS_WEBHOOK` está seteado. Sin él, no-op.

---

## 🚀 Cómo aplicar todo (después del fix de deploy)

```bash
# 1. Trae los cambios nuevos que hice mientras no estabas
rsync -av --exclude='.git' --exclude='node_modules' --exclude='dist' \
  "/Users/josema/Library/Application Support/Claude/local-agent-mode-sessions/91a5566e-4d0c-4e0d-a701-10fbfb9c7900/bdc6ac21-120c-4293-b8f2-a9c32e91b100/local_9e395e0d-2629-4338-b524-e7177259e1dc/outputs/royaltica/" \
  "/Users/josema/Documents/Royaltica/repo/"

# 2. Revisa la diff (ya sin sorpresas grandes, solo lo nuevo de esta ronda)
cd /Users/josema/Documents/Royaltica/repo
git status
git diff --stat

# 3. No hay migraciones nuevas — el schema no cambió (Lead ya lo tenías)
#    Solo necesitas regenerar el cliente Prisma si acaso:
cd api && npm run prisma:generate

# 4. Cuando el deploy anterior ya esté funcionando, redeploya con estos cambios
cd /Users/josema/Documents/Royaltica/repo/api
railway up

# 5. Prueba el admin panel
curl -H "Authorization: Bearer $TU_JWT_SUPERADMIN" \
  https://royaltica-production.up.railway.app/admin/leads/summary
```

---

## 🧩 Wire-up manual pendiente: montar LeadsAdminPanel en App.tsx

Como App.tsx es un monster de ~800KB, no te toqué el `AdminDashboard` para no romperte nada. El componente `LeadsAdminPanel` ya está listo — solo tienes que:

1. En `App.tsx`, importar arriba:
   ```ts
   import { LeadsAdminPanel } from './features/admin/LeadsAdminPanel';
   ```

2. Buscar el `function AdminDashboard(...)` (alrededor de la línea 1066) y agregar una nueva pestaña/vista donde muestres `<LeadsAdminPanel />`. Ejemplo mínimo:
   ```tsx
   {activeAdminView === 'leads' && <LeadsAdminPanel />}
   ```

3. Agregar un botón al menú lateral del AdminDashboard: `Leads` → `setActiveAdminView('leads')`.

Cuando lo tengas y quieras que Claude Code te ayude a montarlo, dame la línea exacta del menú del AdminDashboard y te dejo el snippet listo.

---

## 🌐 Variables de entorno nuevas (opcionales)

Ninguna es requerida. Todas son opt-in y fail-open:

```bash
# Slack webhook para leads (además del correo)
railway variables --set SLACK_LEADS_WEBHOOK=https://hooks.slack.com/services/T00/B00/XXX
```

---

## 📁 Archivos nuevos de esta ronda

```
api/src/common/slack-notifier.ts
api/src/marketing/admin-leads.controller.ts
api/src/marketing/leads-admin.service.ts
api/scripts/reindex-search.ts
frontend/src/features/admin/LeadsAdminPanel.tsx
docs/CHANGES-ROUND-2.md               ← este archivo
```

## ✏️ Archivos modificados en esta ronda

```
api/.env.example                          (+ SLACK_LEADS_WEBHOOK)
api/package.json                          (+ script reindex:search)
api/src/config/env.validation.ts          (+ SLACK_LEADS_WEBHOOK)
api/src/marketing/dto/contact.dto.ts      (+ honeypot)
api/src/marketing/dto/schedule-demo.dto.ts (+ honeypot)
api/src/marketing/marketing.module.ts     (+ AdminLeadsController + LeadsAdminService)
api/src/marketing/marketing.service.ts    (+ honeypot short-circuit + Slack push)
frontend/src/services/apiClient.ts        (+ LeadRecord type + admin/leads methods + honeypot fields)
frontend/src/App.tsx                      (+ buildLeadSource() + honeypot inputs + honeypot state)
```

---

## ⏭️ Cuando regreses, en orden

1. **Fix deploy**: `cd api && railway up` → confirma que responde `/marketing/demo` con 200.
2. **Test end-to-end**: `curl -X POST .../marketing/demo` — debes recibir 2 correos.
3. **rsync + git diff** de esta ronda 2.
4. **Commit + push** (la conexión GitHub↔Railway sigue rota, así que push no dispara nada; el deploy real es con `railway up` cada vez, hasta que conectes GitHub en Settings → Source).
5. Cuando quieras el admin de leads visible, dime dónde montarlo en AdminDashboard.

---

## ⚠️ Lo que NO hice y por qué

- **No commiteé nada** (tal como pediste).
- **No monté LeadsAdminPanel en AdminDashboard** — App.tsx es un archivo enorme y prefiero que tú decidas dónde poner el link (o me digas la ubicación exacta y lo hago en un edit surgical).
- **No conecté GitHub a Railway** — es un click en el dashboard que tú necesitas hacer autenticado.
- **No corrí Docker local** — tu Docker tuvo TLS timeout con el registry, es intermitente. Cuando quieras probar local en vez de Railway, retomamos.
