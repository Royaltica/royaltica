# Plan — de "producto simulado" a 100% funcional

11-ago-2026. Segunda pasada: la primera versión de este documento revisó `sat.service.ts`, `spei.service.ts` y `whatsapp.service.ts` por separado. Esta vez seguí el hilo completo — dónde se LLAMA cada servicio, no solo si el servicio en sí está completo — y encontré dos bloqueadores reales que la primera versión no vio. Quedan documentados abajo con archivo y línea exactos.

## 1. Verificación real contra el SAT (México) — listo para activar

`api/src/sat/sat.service.ts` ya tiene implementado, completo y probado (`sat.service.spec.ts`):
- Llamada real al webservice SOAP oficial y gratuito del SAT (`consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc`), sin captcha, consulta por UUID+RFC emisor+RFC receptor+total.
- Degradación correcta: si el SAT no responde o tarda, cae a `"No Verificado"` en vez de tronar o mentir con un `"Vigente"` falso.
- Sync automático (cron nocturno, `@Cron(CronExpression.EVERY_DAY_AT_3AM)`) de la lista 69-B completa desde el CSV público del SAT.

### Especificación exacta

**Variable a cambiar (Railway → servicio `Royáltica`):**
```
SAT_VERIFY_MODE=live
```

**Checklist de activación:**
- [ ] Cambiar la variable en Railway.
- [ ] Redeploy (Railway lo hace solo al cambiar una variable, confirmar en el dashboard).
- [ ] Probar con `POST /sat/verify` (ver `sat.controller.ts` para el endpoint exacto) con 5-10 CFDIs reales conocidos: al menos 2 vigentes, 1 cancelado si tienen alguno a la mano, 1 con UUID inventado (debe regresar `"No Encontrado"`).
- [ ] Confirmar `JOBS_ENABLED=true` en producción (ya debería estarlo, es el default).
- [ ] Confirmar que `Sat69bEntry` tiene datos: `SELECT COUNT(*) FROM "Sat69bEntry";` en Postgres. Si es 0, disparar a mano: `POST /sat/sync-69b/download`.
- [ ] Monitorear Sentry 48-72h buscando picos de `"No Verificado"` — indicaría que el timeout de 15s (`SAT_HTTP_TIMEOUT_MS`) es corto en horas pico del SAT, no que algo esté roto.

**Riesgo:** bajo. Servicio público gratuito, sin contrato de por medio. Rollback = revertir la variable.

## 2. WhatsApp real (alertas y recordatorios de cobranza)

Mismo patrón: `api/src/whatsapp/whatsapp.service.ts` completo, en stub solo por falta de credenciales.

**Variables a configurar (proveedor `meta`, default):**
```
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

**Checklist:**
- [ ] Crear/usar cuenta de WhatsApp Business Platform (Meta Cloud API) en [developers.facebook.com](https://developers.facebook.com) — requiere verificación de negocio de Meta (Business Manager), puede tardar varios días. **Arrancar esto YA aunque se active después.**
- [ ] Registrar el número de WhatsApp del negocio, obtener `WHATSAPP_PHONE_ID`.
- [ ] Generar token permanente (no el token temporal de 24h de pruebas) para `WHATSAPP_TOKEN`.
- [ ] Configurar el webhook entrante en Meta apuntando a `POST /whatsapp/webhook` del backend, con `WHATSAPP_VERIFY_TOKEN` para el challenge y `WHATSAPP_APP_SECRET` para validar la firma HMAC.
- [ ] Probar con un número propio antes de mandarlo a clientes reales.

**Riesgo:** bajo técnicamente; el cuello de botella es el proceso de verificación de Meta, no el código.

## 3. SPEI real (mover dinero) — el más grande de los cuatro, y no solo por el dinero

### 🔴 Hallazgo nuevo: el pago de una factura NO dispara ninguna transferencia SPEI

Revisé `api/src/payments/payments.service.ts` completo. `SpeiService.order()` solo se llama desde `spei.controller.ts` (un endpoint suelto, `POST /spei/order`) — **`PaymentsService` nunca lo importa ni lo llama**. La transición de un pago a `COMPLETED` (línea ~199-206 de `payments.service.ts`) es un cambio de estado manual/administrativo: alguien (o algún otro proceso) marca el pago como completado, pero **eso no mueve dinero real, ni siquiera con `SPEI_API_KEY` configurada**. El endpoint de SPEI existe y funciona aislado, pero no está conectado al flujo real de "pagar una factura".

Esto significa que activar SPEI no es solo conseguir credenciales — hay que **conectar el cable**: cuando un pago pasa a `PROCESSING`, el backend debe llamar `SpeiService.order()` con los datos del proveedor/CLABE destino, guardar el `claveRastreo` que regresa, y (vía polling con `getStatus()` o un webhook de Conekta si lo ofrecen) transicionar a `COMPLETED` cuando SPEI confirme `LIQUIDATED`, o a `FAILED` si regresa `RETURNED`/error.

### 🔴 Segundo hallazgo: no hay tope de monto ni de velocidad

Confirmado en `spei.service.ts`: cualquier monto que llegue a `order()` se manda tal cual a Conekta, sin límite por transacción ni acumulado por día/organización. Antes de mover dinero real, esto necesita una capa de control — por ejemplo:
- Límite por transacción configurable (env var o por organización en `Organization.settings`).
- Límite diario acumulado por organización.
- Que superar el límite no falle silenciosamente: debe requerir aprobación manual (encaja con el campo `signatures`/autorizadores que ya existe en `Invoice`).

### Especificación de lo que falta construir (esto SÍ es código nuevo, no solo config)

1. En `PaymentsService`, al transicionar `SCHEDULED → PROCESSING`: llamar `SpeiService.order()` con `clabeDestino` (del proveedor), `monto`, `concepto`, `referenciaNumerica`. Guardar `claveRastreo` en el `Payment` (falta una columna — hoy no existe un campo para guardarlo, ver `model Payment` en `schema.prisma`).
2. Agregar el chequeo de límite ANTES de llamar a `order()` — rechazar o marcar para aprobación si excede el tope.
3. Job periódico (o webhook, si Conekta lo soporta — revisar su documentación) que llame `getStatus()` para pagos en `PROCESSING` y los mueva a `COMPLETED`/`FAILED` según la respuesta real de SPEI.
4. El camino por **STP** (`orderViaStp`) literalmente no está implementado (`throw new Error`) — no es parte de este plan a menos que decidan que STP es mejor que Conekta para dispersión masiva.

### Lo que sigue siendo relación de negocio, no código

- [ ] Abrir cuenta de negocio con Conekta (KYC: acta constitutiva de Royáltica, RFC, comprobante de domicilio, representante legal).
- [ ] Conseguir `SPEI_API_KEY` real del dashboard de Conekta.
- [ ] **Decidir de dónde sale el dinero** (`SPEI_CLABE_ORIGEN`): hoy el env var es uno solo, global — el diseño asume una cuenta origen para toda la plataforma. Si cada organización cliente necesita dispersar desde SU PROPIA cuenta (lo más probable para un producto B2B multi-tenant real), el modelo cambia: `SPEI_CLABE_ORIGEN` tendría que vivir por organización, no como variable de entorno global. **Esto hay que decidirlo antes de escribir el código del punto anterior**, porque cambia el diseño.
- [ ] Probar en sandbox de Conekta.
- [ ] Primera transferencia real: monto pequeño, a cuenta propia.

**Riesgo:** el único que mueve dinero real, y el único con una brecha de código real (no solo config). No activar `SPEI_API_KEY` en producción hasta que el punto "conectar el cable" esté hecho y probado — configurar la key sin eso no sirve de nada (el endpoint suelto no se usa en el flujo real), pero sí es una llave viva sin control de acceso adicional dando vueltas.

## 4. El cliente en Canadá — dos bloqueadores concretos en las validaciones (no es solo "confirmar campos")

Investigué primero la parte regulatoria: **Canadá no tiene mandato de e-invoicing ni un sistema de verificación en tiempo real como el SAT.** El CRA acepta facturas en cualquier formato legible mientras traigan 9 datos: nombre del negocio, número de GST/HST, fecha, folio, descripción, monto, desglose de impuestos, total, términos de pago. No hay "SAT canadiense" — nada que integrar ahí.

Buena noticia adicional: `Organization.locale` (`es-MX | en-CA | fr-CA`) y `Organization.currency` (`MXN | CAD`) **ya existen en el schema** — el equipo ya diseñó para esto. El problema es que las validaciones de los DTOs nunca se actualizaron para respetarlo:

### 🔴 Bloqueador 1: `CreateOrganizationDto` no expone `locale` ni `currency`

`api/src/admin/dto/create-organization.dto.ts` no tiene esos campos — al crear una organización nueva (el único flujo de onboarding que existe, ver auditoría anterior), siempre cae al default `es-MX`/`MXN`. Un SUPERADMIN no puede, desde la API, dar de alta la organización canadiense con la configuración correcta; tendría que arreglarlo a mano en la base de datos después.

Además, `rfc` en ese mismo DTO es `@MaxLength(13)` sin más validación — un Business Number + programa del CRA (formato típico `123456789RT0001`, 15 caracteres) **no cabe** en ese límite.

**Fix:** agregar `locale?: string` y `currency?: string` (con `@IsIn([...])`) al DTO, y subir o quitar el `@MaxLength` de `rfc` cuando el locale no es `es-MX`.

### 🔴 Bloqueador 2 (el más grave): no se puede dar de alta un cliente ni una factura canadiense hoy

- `api/src/customers/dto/create-customer.dto.ts` línea 24: `rfc` es **requerido** y validado con `RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/i` — formato mexicano estricto. Un número de GST/HST canadiense no calza con ese patrón. **Hoy, crear un `Customer` canadiense devuelve 400 "RFC con formato inválido" siempre.**
- `api/src/receivables/dto/create-receivable.dto.ts` línea 28-29: `cfdiUuid` es **requerido** y validado como UUID de CFDI. Una factura de venta canadiense no tiene CFDI — ese concepto no existe fuera de México. **Hoy, registrar una factura de venta para un cliente canadiense también devuelve 400.**

Esto no es un tema de "confirmar que se muestren los campos correctos" como decía la primera versión de este plan — es que **la API rechaza los datos de un cliente canadiense de raíz**, en dos endpoints distintos. Sin este fix, es imposible operar con el cliente de Canadá en la plataforma, sin importar qué tan bueno esté el módulo de CxC por debajo.

**Fix concreto:**
1. `CreateCustomerDto`: hacer `rfc` condicional — si `IsMexicanRfc` no aplica (por locale de la organización), aceptar un campo genérico (`taxId`) con su propio formato validado más laxo, o simplemente relajar la validación para que solo aplique el regex mexicano cuando la organización es `es-MX`.
2. `CreateReceivableDto`: hacer `cfdiUuid` opcional (`@IsOptional()`), y usar `folio` (que ya existe, opcional) como identificador único cuando no hay CFDI. Confirmar que no haya ningún otro lugar del backend que asuma `cfdiUuid` como no-nulo para facturas `RECEIVABLE` (grep rápido de `cfdiUuid` en el módulo de receivables/dashboard antes de soltar el cambio).
3. Correr los tests existentes de `receivables`/`customers` después — probablemente haya que agregar casos nuevos (crear cliente/factura sin RFC/CFDI cuando el locale no es mexicano).

**Riesgo:** bajo técnicamente (son cambios de validación, no de lógica de negocio profunda), pero es trabajo real de desarrollo, no una bandera para prender. Probablemente 1-2 días de trabajo entre el cambio, los tests nuevos, y probar el flujo completo de principio a fin con datos canadienses de prueba.

## Orden recomendado (actualizado)

1. **SAT live** — cambiar variable, probar, monitorear. Días, no semanas.
2. **Fix de validaciones para Canadá** (bloqueador 1 y 2 arriba) — esto es lo que de verdad bloquea cerrar/operar ese cliente, no es opcional. Empezar ya.
3. **WhatsApp real** — arrancar la verificación con Meta en paralelo (tarda días de por sí).
4. **SPEI real** — el más largo: requiere (a) resolver la pregunta de diseño de cuenta origen, (b) escribir la integración real dentro de `PaymentsService` + límites de monto, (c) KYC con Conekta, en ese orden. No tiene sentido empezar el KYC con Conekta antes de tener claro el diseño de cuenta origen por organización.

## Resumen de esfuerzo real

| Punto | Tipo de trabajo | Tamaño |
|---|---|---|
| SAT live | Config + pruebas | Horas |
| Canadá (DTOs) | Código (validación) + tests | 1-2 días |
| WhatsApp | Config + proceso con Meta | Horas de código, días de espera de Meta |
| SPEI | Código (integrar en PaymentsService + límites) + decisión de diseño + KYC con Conekta | La más larga — días de código, más lo que tarde Conekta en aprobar la cuenta |
