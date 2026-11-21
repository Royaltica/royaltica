# WhatsApp de punta a punta (carril B)

Qué hace hoy el WhatsApp de cobranza, cómo probarlo y qué falta. Actualizado el 20 nov al integrar el carril B con `main` (PR #16 y #17): una versión anterior de este documento describía piezas de la rama del 16 nov que no llegaron a `main` (ver sección 5). Complementa `docs/whatsapp-meta-diagnostico.md`.

## 1. Qué hace el webhook (`POST /webhooks/whatsapp`)

Código: `api/src/whatsapp/whatsapp-webhook.service.ts`.

### A qué cliente pertenece una respuesta
En este orden, sin adivinar (`resolveSender`):

1. **Por contexto.** Si el mensaje trae `context.id` (respondió a un mensaje nuestro o tocó un botón), se toma el saliente con ese `waMessageId`: cliente y factura exactos.
2. **Por teléfono** (últimos 10 dígitos, teléfono general o de Finanzas). Si es un solo cliente, ese.
3. **Varios con el mismo teléfono:** el último al que le escribimos desde el mismo número de Meta en los últimos 30 días, si es uno solo.
4. **Sin certeza:** va a la bandeja sin dueño (`WhatsappInboundUnmatched`) y no se le atribuye a nadie.

### Qué dijo el cliente
Un solo detector para WhatsApp y correo: `api/src/whatsapp/inbound-intent.ts` (reglas por frases, sin acentos ni signos; explicables y auditables).

| Intención | Ejemplos | Qué pasa |
|---|---|---|
| `OPT_OUT` | "BAJA", "Baja por favor", "STOP", "no me escriban", "dejen de mandar" | `doNotContact = true` en todos los canales, bitácora `CUSTOMER_OPT_OUT`, aviso a administradores |
| `WRONG_CONTACT` | "número equivocado", "ya no trabajo ahí" | `doNotContact = true` con motivo "captura un contacto nuevo", aviso a administradores (campana y WhatsApp) |
| `DISPUTE` | "no reconozco", "ya la cancelamos", "no recibimos la mercancía" | Pausa las secuencias activas de esa factura (si respondió a un mensaje) o de todas sus facturas pendientes; aviso a administradores. Se reanuda a mano desde la secuencia |
| `PAYMENT_CLAIMED` | "ya pagué", botón "Ya pagué, comparto comprobante" | Pausa 72 h los envíos (guardia "ya pagué" del motor) a esa factura o al cliente; aviso para verificar contra el banco. Nunca marca la factura como pagada |
| `CUSTOMER_REPLY` | cualquier otra cosa | Aviso a administradores |

Prioridad: baja → número equivocado → disputa → pago → respuesta. Hay negaciones para no apagar a un cliente por error ("no se dé de baja", "aún no he pagado"). "Dar de baja la factura", "cancelar la factura" o "alto ahí, ¿quién habla?" no son bajas.

**Correo:** el mismo detector revisa las respuestas por correo (solo lo que escribió la persona, sin el mensaje citado). Todo correo de cobranza lleva el pie "responda con la palabra BAJA" y sale con `COLLECTIONS_REPLY_TO`.

### Estados de entrega
Se procesan `statuses[]` de Meta (`sent`, `delivered`, `read`, `failed`) en `WhatsappMessage.deliveryStatus`, `deliveryStatusAt` y `deliveryError`. Nunca retroceden (leído no vuelve a entregado). Un `failed` deja el mensaje como no enviado. La pantalla del hilo muestra "Entregado", "Leído" o "No entregado".

### Imágenes y documentos
Se registra que llegaron ("[Imagen recibida: …]") en el hilo del cliente. **El archivo no se descarga todavía** (pendiente, sección 4).

### Bandeja sin dueño
- Organización: `GET /whatsapp/conversations/unmatched`, `POST …/unmatched/:id/assign`, `POST …/unmatched/:id/dismiss`.
- Royáltica (SUPERADMIN): `GET /admin/whatsapp/unmatched` (`?all=true` incluye resueltos), `POST /admin/whatsapp/unmatched/:id/assign` `{ customerId }`, `POST /admin/whatsapp/unmatched/:id/dismiss`.

## 2. Cómo probar sin depender de Meta

Reproductor firmado (`api/scripts/replay-whatsapp-webhook.ts`), desde `api/`:

```bash
WHATSAPP_APP_SECRET=<el del backend destino> npx ts-node scripts/replay-whatsapp-webhook.ts \
  --url http://localhost:8080 --caso texto --from 5215512345678 --texto "Hola"
```

Casos: `texto`, `boton`, `imagen`, `baja`, `duplicado` (el mismo mensaje 5 veces), `estados` (con `--wamid` de un mensaje que enviamos) y `todos`. `--contexto <wamid>` lo manda como respuesta a ese envío. Rechaza los dominios de producción.

Pruebas automáticas: `whatsapp-webhook.service.spec.ts`, `whatsapp-webhook.uso-rudo.spec.ts` (ráfaga de 200 con reintentos, mismo teléfono en dos organizaciones, estados desordenados, baja repetida, número equivocado, disputa) e `inbound-intent.spec.ts`.

## 3. Plantillas
- En uso: `royaltica_nivel_0` a `nivel_4`, `aviso_vencida` y `seguimiento_vencida` (`collection-templates.ts`). Faltan `aviso_vencida` y `seguimiento_vencida` en Meta.
- 10 plantillas por tipo de deudor (`DEBTOR_TYPE_TEMPLATES`): escritas, **no se envían** hasta que Meta las apruebe y el tipo de deudor viva en el cliente (`Customer.category`). Ver `plantillas-por-tipo-deudor.md`.

## 4. Pendiente
| Qué | De quién |
|---|---|
| Descargar comprobantes (imagen/PDF) al almacenamiento privado y ligarlos a la factura | Carril A |
| Avisos de la cuenta de Meta (plantilla rechazada o pausada, calidad del número) | Carril A |
| Pantalla de la bandeja sin dueño para SUPERADMIN | Carril A |
| Bandera de teléfono no entregable para pasar a correo | Carril A |
| App de Meta en Live, App Review, plantillas aprobadas, token permanente | Paolo |

## 5. Nota sobre la versión anterior de este documento
La rama del carril B del 16 nov tenía `WhatsappMediaService`, `WhatsappDeliveryService`, avisos de Meta y un `WhatsappAdminPanel`, guardando estados en `ActivityLog`. Al integrar `main` se conservó la versión del carril A (estados y bandeja con columnas y tabla propias, migración del 16 nov), y esas piezas no entraron. Si se quieren recuperar, se reimplementan sobre las tablas actuales (sección 4).

## 6. Prueba de aceptación con Meta (con la app en Live)
1. Webhook verificado y suscrito a `messages` (y, cuando exista el punto 2 de la sección 4, a `message_template_status_update` y `phone_number_quality_update`).
2. Enviar `nivel_1` a un teléfono real: en el hilo pasa a "Entregado" y luego "Leído".
3. Responder citando el mensaje: aparece en Clientes → WhatsApp del cliente correcto.
4. Tocar "Ya pagué, comparto comprobante": llega el aviso y se pausan los envíos 72 h.
5. Responder "BAJA": el cliente queda en no contactar y ya no se le envía nada.
6. Responder "no reconozco esa factura": se pausa su secuencia y llega el aviso.
7. Enviar a un número sin WhatsApp: el mensaje queda "No entregado" con su motivo.
