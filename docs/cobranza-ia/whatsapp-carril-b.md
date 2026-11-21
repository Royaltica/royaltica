# WhatsApp de punta a punta (carril B)

Qué quedó construido, cómo probarlo y qué se le pide al carril de base de datos.
Complementa `docs/whatsapp-meta-diagnostico.md`.

## 1. Qué hace ahora el webhook (`POST /webhooks/whatsapp`)

### Empate de la respuesta con su cliente
En este orden (`whatsapp-webhook.service.ts`, `matchInbound`):

1. **Por contexto.** Si el mensaje trae `context.id` (el cliente respondió a un mensaje nuestro o tocó un botón), se busca el saliente con ese `waMessageId`. De ahí salen organización, cliente y factura exactos.
2. **Por teléfono** (últimos 10 dígitos, teléfono general o de finanzas). Un solo cliente: ese. Varios: al que se le escribió más recientemente en los últimos 7 días, **solo si todos los que recibieron mensajes son de la misma organización**.
3. **Sin empate.** Si sigue habiendo duda no se adivina: el mensaje va a la bandeja sin empate y se avisa solo al equipo de Royáltica (SUPERADMIN). Nunca a una organización cliente, porque el mismo teléfono puede ser de clientes de organizaciones distintas.

Diferencia con el diseño D3: D3 dice "el más reciente" entre varios candidatos. Aquí, si los candidatos recientes son de organizaciones distintas, se manda a la bandeja en lugar de elegir. Es más conservador: evita entregar una respuesta a la organización equivocada.

### Intenciones (reglas deterministas, `inbound-intent.ts`)
| Intención | Ejemplos | Efecto |
|---|---|---|
| `OPT_OUT` | "BAJA", "STOP", "no me escriban", "dejen de escribir" | `doNotContact = true` (todos los canales), acuse único por texto libre, aviso al administrador, bitácora `CUSTOMER_OPT_OUT` |
| `WRONG_CONTACT` | "número equivocado", "ya no trabajo ahí" | `doNotContact = true` con motivo "captura un contacto nuevo", acuse único, aviso al administrador |
| `DISPUTE` | "no reconozco", "ya la cancelé", "no recibimos la mercancía" | Pausa la secuencia de esa factura (si respondió a un mensaje) o de todas las del cliente, aviso al administrador |
| `PAYMENT_CLAIMED` | "ya pagué", botón "Ya pagué, comparto comprobante" | Aviso al administrador. **No** marca el pago ni pausa (eso es del carril A, cambio C7) |
| `CUSTOMER_REPLY` | cualquier otra cosa | Aviso al administrador |

Prioridad: baja → número equivocado → disputa → pago → respuesta. Hay negaciones para no apagar a un cliente por error ("no se dé de baja").

Decisión pendiente de Paolo: hoy la baja apaga **todos** los canales (opción A). Si se decide "solo WhatsApp" hace falta un campo nuevo.

### Estados de entrega
Se procesan `statuses[]`: `sent`, `delivered`, `read`, `failed` (con código). Idempotente y monótono (nunca regresa de leído a entregado). Un `failed`:
- deja el mensaje como no enviado (`sent = false`), para que el plan no avance con algo que no llegó;
- avisa al administrador con el motivo en español (`meta-errors.util.ts`);
- si van 2 o más fallos seguidos por número inválido, el aviso lo dice.

El hilo (`GET /whatsapp/conversations/:customerId`) regresa `delivery` en cada mensaje saliente y la pantalla muestra "Entregado", "Leído" o "No entregado" con el motivo.

### Comprobantes (imagen o PDF)
Cuando el cliente manda un archivo, `WhatsappMediaService` lo descarga de Meta y lo guarda en el almacenamiento privado (`whatsapp/<organización>/<cliente>/`). Límites: solo JPG, PNG, WebP o PDF, máximo 10 MB (se mide el archivo real, no lo que anuncia Meta) y solo desde dominios de Meta. La descarga no detiene el webhook. En el hilo aparece "Ver la imagen / el PDF", que abre una liga firmada de 15 minutos (`GET /whatsapp/conversations/:customerId/media/:messageId`). Si no se pudo guardar, el hilo dice por qué. Un archivo nunca se interpreta como pago: lo valida una persona.

Requiere `WHATSAPP_TOKEN` y almacenamiento configurado (S3/GCS); sin eso queda anotado "no guardado". La descarga real contra Meta solo está probada con pruebas unitarias; falta probarla con la app en Live.

### Bajas por correo
Todo correo de cobranza lleva un pie: "responda con la palabra BAJA". El correo entrante la detecta (ignorando el mensaje citado) y pone al cliente en no contactar. El correo de las secuencias ahora lleva `COLLECTIONS_REPLY_TO`; antes las respuestas a ese correo no llegaban al sistema.

### Avisos de la cuenta de Meta
`message_template_status_update` (rechazada, pausada, desactivada), `template_category_update` (reclasificada fuera de Utilidad), `phone_number_quality_update` y `account_update` generan una alerta al equipo de Royáltica. Para recibirlos hay que **suscribir esos campos** en la app de Meta además de `messages`.

### Bandeja sin empate (solo SUPERADMIN)
- `GET /admin/whatsapp/unmatched` (`?all=true` incluye resueltos)
- `POST /admin/whatsapp/unmatched/:id/assign` `{ customerId }` (solo entre los candidatos; se agrega al hilo con la hora real en que llegó)
- `POST /admin/whatsapp/unmatched/:id/dismiss`
- `GET /admin/whatsapp/alerts`

La pantalla está en el panel de administración de Royáltica → WhatsApp (`frontend/src/features/admin/WhatsappAdminPanel.tsx`): muestra el mensaje, sus candidatos con su organización, y permite asignarlo o descartarlo.

## 2. Cómo probar sin depender de Meta

```bash
cd api
npx tsx scripts/replay-whatsapp-webhook.ts texto     --from 5215512345678 --text "Hola"
npx tsx scripts/replay-whatsapp-webhook.ts respuesta --from 5215512345678 --text "Recibido" --context wamid.XXX
npx tsx scripts/replay-whatsapp-webhook.ts boton     --from 5215512345678 --context wamid.XXX
npx tsx scripts/replay-whatsapp-webhook.ts baja      --from 5215512345678
npx tsx scripts/replay-whatsapp-webhook.ts estado    --id wamid.XXX --status read
npx tsx scripts/replay-whatsapp-webhook.ts fallo     --id wamid.XXX --code 131026
npx tsx scripts/replay-whatsapp-webhook.ts duplicado --from 5215512345678 --text "Hola"
npx tsx scripts/replay-whatsapp-webhook.ts firma-mala --from 5215512345678
```

Firma con `WHATSAPP_APP_SECRET` del entorno. Destino por defecto `http://localhost:8080`; para staging `--url https://<staging>`. Se niega a apuntar a producción sin `--confirm produccion`.

Probado en local (16 nov): contexto con teléfono compartido entre dos organizaciones, desempate por envío reciente, ambiguo a la bandeja sin duplicar en el reintento, estados con duplicado, fallo con motivo, disputa, baja con acuse y bloqueo del siguiente envío (403). No se pudo probar el rechazo de firma inválida porque el entorno local no tiene secreto.

## 3. Pedido al carril de base de datos (José / carril A)

Hoy no se tocó el esquema. Dos cosas viven en `ActivityLog` como solución temporal y conviene pasarlas a columnas/tabla propias en la migración de D2:

| Dato | Dónde vive hoy | Lo que se pide |
|---|---|---|
| Estado de entrega por mensaje | `ActivityLog` (acción `WHATSAPP_STATUS`, `entityId` = id del mensaje) | `WhatsappMessage.deliveryStatus`, `deliveredAt`, `readAt`, `failedCode`, `failedReason` |
| Mensaje al que respondió el cliente | `InvoiceAuditLog.metadata.contextWaMessageId` | `WhatsappMessage.contextWaMessageId` |
| Bandeja sin empate | `ActivityLog` sin organización (acción `WHATSAPP_INBOUND_UNMATCHED`) | Tabla `WhatsappInboundUnmatched` (teléfono, texto, wamid, número receptor, fecha, candidatos, resolución) |
| Comprobante de un mensaje | `ActivityLog` (acción `WHATSAPP_MEDIA`, `entityId` = id del mensaje) | `WhatsappMessage.mediaStorageUrl`, `mediaMimeType`, `mediaSize` |
| Teléfono no entregable | Solo se calcula para el aviso | Bandera por contacto, para que el motor pase a correo |
| Consentimiento | No existe | `consentSource`, `consentAt` por contacto (D5) |

Todo el acceso a estados pasa por `WhatsappDeliveryService`; cuando existan las columnas solo cambia esa clase. `ActivityLog` no tiene índice por `entityId`: con el volumen de dos pilotos no pesa, pero es otra razón para migrar.

## 4. Hallazgos que no son de este carril

1. **Hora del motor.** El motor de secuencias corre con `@Cron(EVERY_DAY_AT_11AM)` sin zona horaria, y después exige que la hora local de la política esté dentro de la ventana de contacto. Si el servidor de Railway está en UTC, las 11:00 son las 05:00 en México y todos los pasos se saltarían por "outside-contact-window". Hay que confirmar la zona del servidor o fijar `timeZone: 'America/Mexico_City'` en el cron.
2. **Las plantillas no dicen de parte de quién.** La decisión es un solo número de Royáltica "en nombre de [cliente]", pero ninguna plantilla (`royaltica_nivel_0`, `nivel_1` a `nivel_4`, `aviso_vencida`, `seguimiento_vencida`) nombra a la empresa que cobra. El deudor recibiría "la factura F-123 por $X" de un número que no conoce. Antes de crear `aviso_vencida` y `seguimiento_vencida` en Meta conviene decidir si llevan `{{empresa}}`; las cinco ya aprobadas tendrían que volver a someterse.
3. **Instrucción de la IA de decisión.** `collection-sequences-ai-decision.service.ts` le dice al modelo que trabaja "para Tradespace, una empresa canadiense". Con pilotos mexicanos hay que neutralizarla.
4. **Dos caminos de envío.** Sigue vigente el hallazgo del plan: recordatorio antiguo a las 10:00 y motor por niveles a las 11:00.

## 5. Prueba de aceptación con Meta (cuando la app esté en Live)

1. Webhook verificado (GET responde el challenge) y suscrito a `messages`, `message_template_status_update`, `template_category_update`, `phone_number_quality_update`.
2. Enviar `nivel_1` a un teléfono real; en el hilo debe pasar a "Entregado" y luego "Leído".
3. Responder desde el teléfono citando el mensaje: aparece en Clientes → WhatsApp en menos de 10 s (la pantalla refresca cada 8 s).
4. Tocar "Ya pagué, comparto comprobante": llega el aviso al administrador.
5. Responder "BAJA": llega el acuse, el cliente queda en no contactar y el siguiente envío responde 403.
6. Enviar a un número sin WhatsApp: el mensaje queda "No entregado" con su motivo.
