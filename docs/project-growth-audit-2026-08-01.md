# Royaltica - Auditoria de crecimiento del proyecto

Fecha: 2026-08-01

## Objetivo

Esta auditoria mira el proyecto no solo como "que falta para un cliente", sino
como producto: que conviene agregar, mejorar o convertir en ventaja para que
Royaltica crezca, venda mejor, sea mas confiable y soporte mas clientes.

## Lectura ejecutiva

Royaltica ya tiene una base muy valiosa: multi-tenant, RLS, auth + 2FA,
CxP/CxC, auditoria fiscal, AI, WhatsApp, email, Stripe base, portal de
proveedores, portal de clientes deudores, reportes PDF, cron jobs, CI y
conectores externos en modo generico.

La oportunidad principal ya no es "hacer mas pantallas", sino convertir lo que
existe en un producto mas vendible:

- onboarding guiado por tenant,
- integraciones reales y configurables,
- self-service para clientes/proveedores,
- AI con trazabilidad y control humano,
- conciliacion bancaria usable,
- analytics ejecutivos,
- hardening de seguridad/operacion,
- packaging comercial por vertical.

## Estado actual observado

- Repo local: `/Users/josema/Documents/Royaltica/repo`.
- Remoto: `https://github.com/Royaltica/royaltica.git`.
- Branch actual: `main`.
- Estado Git observado durante esta auditoria:
  - `main` esta 2 commits adelante de `origin/main`.
  - Hay cambios sin commit en `api/prisma/schema.prisma`.
  - Existe `docs/tradespace-auditoria-2026-08-01.md` como archivo nuevo.
- Commits locales recientes relevantes:
  - `feat(api): add AI-driven decision layer for collection sequence engine`
  - `feat(api): add generic external data sync connector (CSV + REST skeleton) with configurable field mapping`

Nota: no se modifico ni se revirtio ningun cambio existente de schema. Esta
auditoria se hizo respetando el estado actual del workspace.

## Senales fuertes del producto

### 1. Plataforma multi-tenant real

Ya hay `Organization`, RLS, `withOrg()`, settings por tenant, branding por
tenant, logs y permisos. Esto permite vender a multiples empresas sin rehacer
la arquitectura.

Mejora de crecimiento:

- Crear un flujo "nuevo tenant en 10 minutos": branding, moneda, usuarios,
  politicas, integraciones, datos demo y primer reporte.

### 2. Motor de cobranza muy diferenciable

Ya existe CxC, aging, customer scoring, recordatorios, guard rails,
secuencias, AI opt-in y portal publico por token.

Mejora de crecimiento:

- Convertirlo en "Collections Copilot": una bandeja de trabajo donde el equipo
  ve quien debe, que hizo el agente, que recomienda la IA y que requiere humano.

### 3. Integraciones externas empiezan a ser producto

Ya existe `external-data-sync` con CSV universal, REST skeleton y field mapping.
Eso puede resolver la incertidumbre de Soga/Zoho/Sage/Excel sin depender de un
solo proveedor.

Mejora de crecimiento:

- Hacer un "Integration Wizard" con preview de columnas, mapeo, validacion,
  dry-run, importacion y reporte de errores.

### 4. AI con control humano

La capa nueva de AI decision para secuencias es opt-in y falla cerrado a logica
determinista. Esa postura es buena para enterprise.

Mejora de crecimiento:

- Agregar explicabilidad visible: "La IA recomendo HOLD/ESCALATE/SEND por estas
  razones", con aprobacion humana para acciones sensibles.

### 5. Cumplimiento fiscal mexicano sigue siendo moat

REP, DIOT, 69-B, CFDI, proveedores, scoring y portal proveedor son muy
especificos de Mexico. Eso da diferenciacion contra ERPs genericos.

Mejora de crecimiento:

- Empaquetarlo como "Fiscal Ops Control Tower" para CFO/Contraloria.

## Prioridades recomendadas

### P0 - Convertir demo en producto confiable

1. Apagar dependencias peligrosas de demo en ambientes con datos reales.
   - Firebase Admin real.
   - `ALLOW_DEV_LOGIN=false`.
   - Rol DB restringido (`royaltica_app`) en produccion.
   - Secret scanning y verificacion de envs por ambiente.

2. Crear checklist de "tenant listo para cliente".
   - Auth real configurada.
   - Email real.
   - WhatsApp real o desactivado con mensaje claro.
   - Branding.
   - Moneda/locale.
   - Politicas de cobranza.
   - Usuarios/admins.
   - Integracion o carga CSV inicial.

3. Cerrar deuda de localizacion.
   - El backend ya tiene locale/currency por org.
   - Faltan pantallas legacy con `es-MX`/`MXN` hardcoded.
   - Recomendacion: crear `useOrgLocale()` y prohibir `new Intl.NumberFormat('es-MX'...)`
     directo en componentes.

4. Probar el flujo end-to-end con datos reales.
   - Cliente/importacion.
   - Factura CxC.
   - Aging.
   - Secuencia.
   - Email/WhatsApp.
   - Portal cliente.
   - Acuse de pago.
   - Reporte PDF.
   - Audit log.

### P1 - Crear productos vendibles encima de la base

1. Collections Command Center.
   - Bandeja de cartera por prioridad.
   - Acciones recomendadas por cliente.
   - Estado de secuencia.
   - Timeline auditable por factura.
   - Botones: pausar, escalar, reintentar, marcar promesa de pago.

2. Integration Wizard.
   - Subida CSV/Excel.
   - Preview de primeras filas.
   - Mapeo visual de campos.
   - Validacion antes de importar.
   - Dry-run con conteo de creados/actualizados/errores.
   - Guardar mapping por tenant.

3. Portal cliente 2.0.
   - Branding real del tenant en portal publico.
   - Descarga de estado de cuenta.
   - Promesa de pago.
   - Disputa de factura.
   - Upload de comprobante.
   - Link de pago si se conecta Stripe/Interac/EFT.

4. Report Center.
   - Historial de reportes generados.
   - Programacion semanal/quincenal/mensual por org.
   - Enviar a multiples destinatarios.
   - PDF + CSV.
   - Reporte ejecutivo de DSO, aging, recuperado, riesgo y acciones del agente.

5. AI Actions Inbox.
   - Todas las decisiones de IA en una bandeja.
   - Razonamiento, datos usados y nivel de confianza.
   - Aprobacion/rechazo humano.
   - Feedback para mejorar prompts/reglas.

### P2 - Moats e integraciones grandes

1. Conciliacion bancaria canadiense.
   - Ya hay schema/migracion para `BankStatementImport` y `BankTransaction`.
   - Falta servicio/controller/importer/matching engine si no se agrego despues.
   - Camino recomendado: CSV primero, OFX segundo, adapter RBC/TD/Scotiabank despues.
   - Nunca marcar factura como PAID sin confirmacion humana al inicio.

2. Soga/Zoho/Sage connector.
   - Usar `external-data-sync` como base.
   - Crear adaptadores especificos solo cuando haya API real confirmada.
   - Mantener CSV universal como fallback comercial.

3. Payments Canada.
   - Definir si se necesita cobrar o solo conciliar.
   - Opciones: Stripe, EFT provider, Interac e-Transfer, open banking/aggregator.
   - Separar "payment acknowledgement" de "payment settlement".

4. Partner API.
   - API externa para ERPs/consultores.
   - Webhooks firmados ya existen como base.
   - Agregar API keys por tenant, scopes y rate limits por integracion.

5. Vertical packs.
   - Mexico Fiscal Ops.
   - Canada AR Collections.
   - Supplier Portal + Compliance.
   - CFO Cashflow Command Center.

## Mejoras de producto por area

### Onboarding

- Wizard de setup inicial.
- Datos demo por vertical.
- Estado de configuracion: "te falta conectar email", "te falta subir clientes".
- Invitacion de usuarios con roles sugeridos.
- Checklist visible en admin dashboard.

### Dashboard ejecutivo

- Una vista CFO con 6 preguntas:
  - Cuanto debo pagar?
  - Cuanto me deben?
  - Que vence esta semana?
  - Que esta en riesgo fiscal?
  - Que recupero el agente?
  - Que requiere aprobacion humana?
- Tendencias historicas, no solo snapshots.
- Alertas accionables, no solo metricas.

### Cobranza

- Promesas de pago.
- Disputas de factura.
- Estados de contacto por cliente.
- Calendario de proximos contactos.
- Plantillas por tono/idioma.
- Blackout dates por cliente, no solo por org/politica.
- Reglas por segmento: enterprise, SMB, alto riesgo, buen pagador.

### CxP / proveedores

- Supplier risk timeline.
- Auto-approval rules basadas en score.
- Workflow de aprobacion con niveles.
- Portal proveedor con documentos, pagos, REP y mensajes.
- App mobile ligera para aprobaciones.

### Fiscal

- DIOT mensual con workflow de cierre.
- REP compliance queue.
- 69-B monitor continuo de proveedores/clientes.
- Evidencia descargable para auditoria.
- Alertas antes de cierre fiscal.

### AI

- Separar AI chat de AI operations.
- Guardar decisiones estructuradas, no solo conversaciones.
- Evaluaciones offline con casos reales.
- Prompt/versioning por tenant.
- AI safety log: herramienta usada, datos consultados, decision, razonamiento.
- Modo "solo recomendar" vs "ejecutar con aprobacion".

### Integraciones

- UI para status de integraciones.
- Ultima sincronizacion, errores, filas importadas, filas ignoradas.
- Reintentos.
- Dry-run.
- Mapeo versionado.
- Credenciales cifradas.
- Webhooks entrantes ademas de salientes.

### Billing / monetizacion

- Planes por modulo:
  - Core compliance.
  - Collections automation.
  - AI copilot.
  - Integrations.
  - White label.
- Usage metering visible al cliente.
- Trial con limites claros.
- Upgrade prompts por capacidad, no por marketing.

## Mejoras tecnicas

### Modularizacion

El viejo riesgo de `App.tsx` gigante parece bastante reducido: el archivo actual
tiene cerca de 165 lineas. Ahora los archivos densos son:

- `frontend/src/services/apiClient.ts` (~1,800 lineas).
- `frontend/src/services/geminiService.ts` (~960 lineas).
- `api/src/dashboard/dashboard.service.ts` (~1,020 lineas).
- `api/prisma/schema.prisma` (~970 lineas).

Recomendacion:

- Dividir `apiClient.ts` por dominios: auth, customers, receivables, portal,
  reports, settings, integrations.
- Dividir `dashboard.service.ts` en servicios de metricas: payables,
  receivables, fiscal, collections, executive.
- Mover prompts/AI mock legacy fuera del frontend si el backend ya es fuente
  real de AI.

### Tests

Ya hay buen volumen de tests backend y CI. Siguiente nivel:

- Tests e2e de flujo feliz por modulo critico.
- Tests de RLS/tenant isolation con DB real.
- Tests de migraciones Prisma.
- Tests frontend de componentes criticos.
- Contract tests para API client.

### Observabilidad

- Sentry ya existe.
- PostHog ya existe.
- Pino structured logging ya existe.

Mejoras:

- Dashboards de jobs: ejecuciones, duracion, errores, enviados.
- Audit trail visible por factura/cliente.
- Alertas por job fallido.
- Health checks por proveedor: Resend, WhatsApp, Vertex, Stripe, DB, Redis.

### Seguridad

- Apagar dev-login en cualquier entorno con datos reales.
- Revisar `npm audit`.
- DB role restringido en produccion.
- Cifrar credenciales de integraciones por tenant.
- Rotacion de secrets.
- Rate limits especificos para rutas publicas: portal cliente, marketing, webhooks.
- Logs sin tokens ni PII sensible.

### Performance

- El build frontend avisa bundle grande.
- Agregar code-splitting por portal/ruta.
- Lazy-load de vistas pesadas.
- Cache de metricas dashboard con TTL corto.
- Paginacion real en tablas grandes.
- Background jobs para reportes pesados.

## Roadmap sugerido 30/60/90 dias

### 0-30 dias

- Tenant setup checklist.
- Cerrar hardcodes locale/currency.
- Integration Wizard CSV con preview/dry-run.
- Portal cliente con branding + comprobante/promesa de pago.
- Collections Command Center MVP.
- Verificacion de seguridad de entorno demo/produccion.

### 31-60 dias

- Conciliacion bancaria CSV end-to-end.
- Report Center con programacion configurable.
- AI Actions Inbox con aprobacion humana.
- Stripe billing end-to-end real.
- Tests e2e para CxC + portal + reportes.

### 61-90 dias

- Adaptador real para sistema confirmado (Zoho/Sage/Soga/etc.).
- Payment rails Canada definidos y primer adapter.
- Partner API con API keys/scopes.
- Vertical packs y pricing por modulo.
- Observabilidad de jobs e integraciones.

## Top 10 iniciativas recomendadas

| Rank | Iniciativa | Impacto | Esfuerzo | Por que importa |
| --- | --- | --- | --- | --- |
| 1 | Tenant setup checklist | Alto | Bajo | Convierte demos en onboardings repetibles. |
| 2 | Collections Command Center | Alto | Medio | Vuelve visible el valor diario del agente. |
| 3 | Integration Wizard CSV/REST | Alto | Medio | Reduce friccion de adopcion con cualquier ERP. |
| 4 | Portal cliente 2.0 | Alto | Medio | Hace que deudores interactuen sin soporte manual. |
| 5 | Cerrar locale/currency hardcodes | Medio | Bajo | Necesario para Canada y white label serio. |
| 6 | Conciliacion bancaria CSV | Alto | Medio | Cierra el ciclo: factura -> cobro -> conciliacion. |
| 7 | Report Center | Medio | Medio | Producto ejecutivo vendible y retenedor. |
| 8 | AI Actions Inbox | Alto | Medio/Alto | IA operativa con confianza y control. |
| 9 | Seguridad produccion | Alto | Medio | Evita que una demo crezca con riesgo oculto. |
| 10 | Code-splitting frontend | Medio | Bajo/Medio | Mejora performance y percepcion de calidad. |

## Recomendacion final

La mejor apuesta de crecimiento es posicionar Royaltica como dos productos
conectados:

1. **Fiscal Ops para Mexico**: REP, DIOT, 69-B, CFDI, proveedores y compliance.
2. **AR Collections para Canada/US**: CxC, aging, secuencias, AI, portal cliente,
   integraciones y conciliacion.

La arquitectura ya permite ambos caminos. Lo importante ahora es empaquetar,
endurecer y hacer repetibles los flujos que hoy ya existen como capacidades
tecnicas.
