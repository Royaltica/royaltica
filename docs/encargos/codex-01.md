# Encargo para Codex n.º 1 — carril C (Royáltica)

Escrito por el carril A (Claude de José) el 17 nov 2026. Lee también `CLAUDE.md` en la raíz del repo antes de empezar.

## Contexto en tres líneas
Royáltica es un SaaS de cobranza B2B para México: NestJS 10 + Prisma 5.22 + Postgres (RLS con `withOrg()`) en `api/`, React 19 + Vite + Tailwind 4 en `frontend/`. El primer piloto entra en modo sombra el 1 dic y el primer envío real es el 9 dic. Tu carril pasa a la base de datos lo que hoy vive en el navegador y deja el proyecto fácil de probar.

## Reglas (no negociables)
1. **No cambies el esquema de Prisma ni crees migraciones.** Si algo necesita una columna o tabla, detente y escribe en el PR qué necesitas; lo hace el carril A.
2. Cada tarea va en su propia rama desde `main` (`codex/<tarea>`) y su propio PR hacia `main`, pequeño y revisable. No empujes a `main`.
3. **No reformatees archivos enteros.** El repo no tiene una configuración de Prettier uniforme: cambia solo las líneas que tocas y conserva el estilo del archivo (comillas, ancho de línea).
4. Antes de abrir el PR deben pasar, sin errores:
   - `cd api && npx prisma generate && npx tsc --noEmit -p tsconfig.json && node --experimental-vm-modules node_modules/.bin/jest`
   - `cd frontend && npx tsc --noEmit && npx vitest run && npm run build`
5. Pruebas nuevas para cada comportamiento nuevo (caso feliz y un caso de error).
6. Nunca escribas secretos, tokens ni contraseñas en el código, en pruebas ni en el PR. Los teléfonos de prueba van inválidos a propósito (lada `00`), como en `api/scripts/seed-cobranza-demo.ts`.
7. Textos para el usuario en español de México, claros, sin tecnicismos. En pantalla, **nada que parezca real puede mostrar datos de ejemplo**: si un dato no existe todavía, se dice "Sin datos" o se oculta.
8. Toda consulta de datos de una organización debe ir por `this.prisma.withOrg(organizationId, ...)` y filtrar por `organizationId`.

## Tareas (en este orden)

### C1. Organización semilla y comando de reinicio
- Partiendo de `api/scripts/seed-cobranza-demo.ts`, crea `npm run seed:piloto` y `npm run reset:piloto` en `api/package.json`.
- `seed:piloto` crea (idempotente) una organización de prueba "Piloto Demo" con un administrador, un supervisor y un agente, 10 clientes con teléfonos inválidos, 25 facturas por cobrar con vencimientos variados, el plan por niveles **con `shadowMode: true` y `autoSend: false`**, y un estado de cuenta de ejemplo con abonos y cargos.
- `reset:piloto` borra SOLO los datos de esa organización (busca por RFC fijo de la semilla) y nunca corre si `NODE_ENV=production`.
- Prueba: que reset no toque otras organizaciones.

### C2. Pasar a la base de datos lo que vive en el navegador
Hoy guardan en `localStorage`: `frontend/src/pages/corporate/views/cobranza/ConfiguracionPanel.tsx` (`useGuardado`: `seguridad`, `noMolestar`, `resumenHora`, `reglas`, `empresa`), `alertas.tsx`, `ReportesPanel.tsx` (reportes guardados) y `store.tsx`.
- **Equipo:** usa los endpoints reales que ya existen (`GET /users`, `POST /users/invite`, `PATCH /users/:id`, `PATCH /users/:id/status`, `DELETE /users/:id`). Quita la lista de ejemplo.
- **Reglas, alertas, "no molestar", resumen, empresa y reportes guardados:** guárdalos en la configuración de la organización (`api/src/settings/settings.service.ts`, JSON `Organization.settings`), agregando claves nuevas a `OrgSettings`, a `DEFAULT_SETTINGS`, a `merge()` (con validación) y al parche de `update()`, más los campos en `api/src/organization/dto/update-settings.dto.ts`. Eso NO es cambio de esquema.
- **Ojo:** la "Hora de envío" de Reglas ya está conectada al servidor (`collectionEngineHour`); no la dupliques. El "Máximo de mensajes por semana" y "Días con mensajes" deben ir a la política (`PATCH /collection-policies/:id`: `maxContactsPerWeek`, `blackoutDates`), no a settings.
- Al terminar no debe quedar ningún `localStorage` en `frontend/src/pages/corporate/views/cobranza/` salvo preferencias puramente visuales (pestaña abierta, filtros), y cada una con un comentario que lo explique.

### C3. Tipos de deudor (3 a 5), segmentos y alertas por WhatsApp
> **Cambio de reparto (18 nov):** el carril A hace la parte de backend (endpoint de segmentos y alertas por WhatsApp al equipo). A Codex le queda la parte de pantalla: catálogo de tipos, el tipo en la ficha del cliente y la vista de segmentos usando el endpoint del carril A.
> **Actualización (20 nov):** la vista de segmentos ("Cómo pagan hoy" en Cobranza IA › Segmentos, `SegmentosServidor.tsx`) también la hizo el carril A. El catálogo de tipos y el tipo en la ficha del cliente ya existían. **Codex ya no toma C3.**
- Usa `Customer.category` (ya existe, texto) para el tipo de deudor. Empieza con 3 a 5 tipos definidos en `frontend/.../catalogoDeudores.ts`, no 25.
- El tipo se elige en la ficha del cliente y se guarda con `PATCH /customers/:id`.
- Segmentos: calcúlalos en el backend a partir de `riskTier`, `score` y `category` (endpoint de solo lectura), no en el navegador.
- Alertas por WhatsApp al equipo: reutiliza `WhatsappService.notifyOrgAdmins` y el resumen diario existente (`whatsapp-notifications-digest` en `jobs.service.ts`); no crees otro cron.

### C4. Reproductor de webhooks de WhatsApp para staging y pruebas de uso rudo
> **Cambio de reparto (18 nov):** lo hizo el carril A (`api/scripts/replay-whatsapp-webhook.ts`, `whatsapp-webhook.uso-rudo.spec.ts`, pruebas de caída del motor y del estado de cuenta sucio). Codex no lo toma.
- Script `api/scripts/replay-whatsapp-webhook.ts` que arme payloads con el formato real de Meta y los **firme con `WHATSAPP_APP_SECRET`** (cabecera `x-hub-signature-256`) para enviarlos a `<URL>/webhooks/whatsapp`. Casos: texto, botón con `context.id`, imagen, estados (`sent`, `delivered`, `read`, `failed`), "BAJA", y el mismo `wamid` repetido 5 veces.
- Pruebas de uso rudo (jest, con mocks, sin red): ráfaga de 200 mensajes con reintentos duplicados (ninguno se registra dos veces), una caída a media operación del motor (no se repite un envío), dos organizaciones con el mismo teléfono (va a la bandeja sin dueño) y un estado de cuenta sucio (fechas día/mes/año, montos con `$` y comas, filas vacías).
- Tamaño: el de los pilotos (unos cientos de facturas), no 50,000.

### C5. Prueba del flujo principal en cada PR
- Una prueba de jest de punta a punta con mocks: factura vence → el motor en modo sombra registra lo que enviaría → se sube un estado de cuenta con el abono → la factura queda frenada por "depósito sin revisar" → se confirma el depósito → la factura queda PAID y el motor ya no la toma.
- Debe correr en el CI actual (`.github/workflows/ci.yml`), sin base de datos real.

## Qué entregar en cada PR
Descripción con: qué cambia, cómo se prueba, capturas si hay pantalla, y "no trae migración". Etiqueta a José como revisor.
