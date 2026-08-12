# Plan — de "producto simulado" a 100% funcional

11-ago-2026. Sigue de `auditoria-agosto-2026.md`. Antes de armar el plan revisé el código real de `sat.service.ts`, `spei.service.ts` y `whatsapp.service.ts` — la sorpresa es que **el trabajo de ingeniería para los tres ya está hecho**. No es un problema de "hay que construirlo", es un problema de "hay que activarlo con credenciales reales de un proveedor". Eso cambia mucho el esfuerzo real vs. lo que parecía en la auditoría anterior.

## 1. Verificación real contra el SAT (México) — el más barato de los tres

`sat.service.ts` ya tiene implementado, completo y probado (hay `.spec.ts`):
- Llamada real al webservice SOAP oficial y gratuito del SAT (`consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc`), sin captcha, consulta por UUID+RFC emisor+RFC receptor+total — exactamente el mismo servicio que usan las librerías open-source del gremio (phpcfdi/sat-estado-cfdi, CfdiUtils).
- Manejo de degradación: si el SAT no responde o tarda (sus servicios son lentos), cae a "No Verificado" en vez de tronar o mentir con un "Vigente" falso.
- Sincronización real y automática (cron nocturno) de la lista 69-B completa desde el CSV público del SAT.

**Lo único que falta:** cambiar `SAT_VERIFY_MODE=mock` a `SAT_VERIFY_MODE=live` en Railway.

**Pasos concretos:**
1. Cambiar la variable en Railway.
2. Probar con 5-10 CFDIs reales conocidos (algunos vigentes, alguno cancelado si tienen uno a la mano) y confirmar que el estatus regresa correcto.
3. Confirmar que `JOBS_ENABLED=true` en producción (para que el cron de la lista 69-B corra) y que `Sat69bEntry` ya tiene datos (si nunca ha corrido, dispararlo a mano: `POST /sat/sync-69b/download`).
4. Monitorear Sentry/logs 2-3 días buscando muchos "No Verificado" seguidos — sería señal de que el timeout (15s) es corto para las horas de carga alta del SAT, no de que algo esté mal.

**Riesgo:** bajo. Es un servicio público gratuito del SAT, no depende de un contrato ni de dinero. Si algo sale mal, se revierte la variable y ya.

## 2. WhatsApp real (alertas y recordatorios de cobranza) — igual de barato

Mismo patrón: `whatsapp.service.ts` ya está completo, corre en modo stub solo porque falta `WHATSAPP_TOKEN`. Para activarlo (proveedor `meta`, que es el default):
1. Crear/usar una cuenta de WhatsApp Business API (Meta Cloud API) — esto sí requiere verificación de negocio ante Meta, puede tardar unos días.
2. Configurar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` en Railway.
3. Probar con un número propio antes de mandarlo a clientes reales.

**Riesgo:** bajo técnicamente, el cuello de botella es el proceso de verificación de Meta, no el código.

## 3. SPEI real (mover dinero de verdad) — el que sí requiere una relación de negocio

`spei.service.ts`: el camino por **Conekta** está completo y llama a la API real de transferencias de Conekta (`POST /transfers`, `method: spei`). El camino por **STP** literalmente no está implementado (`throw new Error('STP directo no implementado')`) — si en algún momento necesitan STP (mejor para dispersión masiva tipo nómina/muchos proveedores a la vez), eso sí es desarrollo nuevo.

**Lo que falta no es código, es la relación comercial:**
1. Abrir cuenta de negocio con Conekta (KYC: documentos de constitución de Royáltica, RFC, comprobante de domicilio, representante legal — lo normal para cualquier cuenta fintech en México).
2. Conseguir `SPEI_API_KEY` real del dashboard de Conekta.
3. **Definir de dónde sale el dinero** (`SPEI_CLABE_ORIGEN`): ¿es una cuenta de Royáltica que dispersa en nombre del cliente, o cada organización necesita su propia cuenta/CLABE origen? Esto es una decisión de producto que no vi resuelta en el código — el env var es uno solo (global), lo que sugiere que hoy el diseño asume una sola cuenta origen para toda la plataforma. Vale la pena confirmar que eso es lo que quieren antes de activarlo, porque si cada cliente necesita su propia cuenta, el modelo cambia (multi-tenant de credenciales SPEI, no una sola global).
4. Probar en el modo sandbox de Conekta antes de producción.
5. Primera transferencia real: monto pequeño, a una cuenta propia, antes de abrirlo a clientes.

**Riesgo:** el único de los tres que mueve dinero real — vale la pena ir despacio aquí específicamente. Confirmado en el código: **no existe ningún límite de monto por transacción ni por día/velocity en `spei.service.ts`** — cualquier monto que se le pase se manda tal cual a Conekta. Antes de activar `live`, vale la pena agregar un tope configurable (por transacción y/o diario por organización) como red de seguridad mínima — un bug o una factura mal capturada no debería poder disparar una transferencia de un monto absurdo sin que nadie lo revise primero.

## 4. El cliente en Canadá — buena noticia, no hace falta ninguna integración regulatoria

Investigué: **Canadá no tiene un mandato de e-invoicing ni un sistema de verificación de facturas en tiempo real como el SAT.** El CRA (su autoridad fiscal) acepta facturas en cualquier formato legible (PDF, papel, EDI) mientras traigan la información fiscal requerida. No hay una "SAT canadiense" contra la cual auditar — no existe ese servicio, ni de Canadá lo va a haber en el corto plazo según el análisis del sector.

Lo que sí exige el CRA son 9 campos en cada factura: nombre del negocio, número de GST/HST, fecha, número de factura, descripción, monto, desglose de impuestos, total, y términos de pago. Esto es **validación de formato/datos, no una integración con ningún servicio externo**.

**Conclusión:** el módulo de CxC/cobranza que ya está construido (aging, DSO, ranking de clientes, recordatorios automáticos) ES el producto completo para un cliente canadiense — no falta "conectar con un regulador" porque no hay nada con qué conectarse. Lo único que vale la pena confirmar es que las facturas que genera/muestra el sistema para una organización canadiense efectivamente incluyan esos 9 campos del CRA (número de GST/HST del cliente, desglose de impuestos, etc.) — un check de datos, un par de horas, no un proyecto de integración.

## Orden recomendado

1. **SAT live** — cambiar una variable, probar, monitorear. Puede estar listo esta semana.
2. **Confirmar campos CRA en facturas para el cliente de Canadá** — rápido, y probablemente sea lo que están esperando para cerrar ese cliente.
3. **WhatsApp real** — arrancar el proceso de verificación con Meta ahora porque tarda días, aunque se active después.
4. **SPEI real** — el más lento porque depende de Conekta (KYC) y de resolver la pregunta de diseño (¿una cuenta origen global o por cliente?) antes de tocar código o mandar dinero real.

## Lo que NO es un bloqueador técnico (aclaración)

Nada de esto requiere escribir servicios nuevos desde cero. Es activar integraciones ya construidas + resolver dos preguntas de producto (cuenta origen de SPEI, y confirmar que sí, la estrategia con Canadá es "no hace falta SAT-equivalente"). El verdadero "siguiente paso" es de negocio (abrir cuenta con Conekta, verificar negocio con Meta) más que de código.
