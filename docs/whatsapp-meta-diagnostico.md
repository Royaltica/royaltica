# Diagnóstico de WhatsApp Meta y Railway

Fecha de actualización: 24 de octubre de 2026

## Resumen ejecutivo

El backend de Royáltica sí está conectado a Meta. Railway tiene configurados el proveedor Meta, el token y el `WHATSAPP_PHONE_ID`. Posteriormente también se agregó `WHATSAPP_WABA_ID` y Railway desplegó correctamente.

El error real no era la ausencia del token. Meta respondió:

```text
#132001 Template name does not exist in the translation
template name (seguimiento_vencida) does not exist in es_MX
```

La WABA configurada en Railway no contiene una plantilla llamada exactamente `seguimiento_vencida` en idioma `es_MX`. Meta sí muestra otras plantillas, pero sus nombres no coinciden con los que usa el código.

## 1. Error inicial de Prisma

El primer error fue:

```text
The environment variable DATABASE_URL resolved to an empty string.
```

La causa fue esta expansión del shell:

```bash
DATABASE_URL="$DATABASE_ADMIN_URL" prisma migrate deploy
```

El shell expandió `DATABASE_ADMIN_URL` antes de que Prisma cargara `.env`, por lo que `DATABASE_URL` quedó vacío.

Forma correcta para ejecutar localmente:

```bash
cd /Users/josema/Documents/Royaltica/repo/api
set -a
source .env
set +a
npm run prisma:deploy
```

Resultado obtenido:

```text
31 migrations found in prisma/migrations
No pending migrations to apply.
```

La base local quedó al día.

## 2. Estado de Railway

El proyecto correcto es:

```text
Proyecto: Royáltica
Entorno: production
Servicio: Royáltica
URL: https://api.royaltica.com
```

Al principio se ejecutó:

```bash
railway run --service royaltica ...
railway up --service royaltica
```

Railway respondió `Service not found` porque el servicio vinculado se llama `Royáltica`, no `royaltica`. Cuando el servicio está vinculado, no hace falta especificar un nombre incorrecto.

El deployment actual terminó correctamente:

```text
SUCCESS
Servicio: Royáltica
Estado: Online
```

Comprobaciones realizadas:

```text
/health                         HTTP 200
/whatsapp/conversations/plan-activity sin sesión HTTP 401
```

El `401` es esperado: confirma que la ruta existe y solo requiere autenticación.

## 3. Variables de WhatsApp

### Variables principales

| Variable | Función |
|---|---|
| `WHATSAPP_PROVIDER` | Debe ser `meta` para Meta Cloud API. |
| `WHATSAPP_TOKEN` | Token de acceso para llamar a Graph API. |
| `WHATSAPP_PHONE_ID` | Identifica el número de WhatsApp que envía. |
| `WHATSAPP_WABA_ID` | Identifica la cuenta de WhatsApp Business donde viven las plantillas. |
| `WHATSAPP_APP_SECRET` | Valida la firma de los mensajes entrantes. |
| `WHATSAPP_VERIFY_TOKEN` | Verifica el webhook de Meta. |
| `WHATSAPP_FROM` | Se usa para Twilio; no decide el destinatario cuando el proveedor es Meta. |
| `WHATSAPP_TEST_CC` | Recibe copias de mensajes de prueba, si está configurado. |

`WHATSAPP_PHONE_ID` y `WHATSAPP_WABA_ID` son valores distintos. El WABA ID no es el App ID, el Business Manager ID, el token ni el Phone Number ID.

### Estado confirmado

Railway confirmó:

```text
META_CONFIG=OK
WABA_ID=present
WhatsApp inicializado (proveedor: meta)
```

No se deben compartir en chats, capturas o repositorios los valores de `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET` ni otros secretos.

## 4. Qué significa el modo stub

El backend entra en modo `stub` cuando faltan `WHATSAPP_TOKEN` o, usando Meta, `WHATSAPP_PHONE_ID`.

En `stub`:

- El mensaje se registra en la aplicación.
- No se llama a Meta.
- No sale ningún mensaje real a WhatsApp.

Sin embargo, el frontend tenía un problema: mostraba “sin token de Meta” para cualquier respuesta `sent: false`, incluso cuando Meta sí estaba configurado y simplemente rechazaba el envío.

## 5. Corrección del frontend

Se corrigió `frontend/src/pages/corporate/views/cobranza/WhatsappPanel.tsx` para diferenciar:

- `stub`: faltan credenciales y no se llamó a Meta.
- `meta` con `sent: false`: Meta rechazó el envío.
- `sent: true`: envío exitoso.

También se corrigió el texto para no afirmar que el plan avanzó cuando Meta rechazó el mensaje.

Commit publicado:

```text
d747e76 fix: distinguir rechazo de Meta de modo prueba
```

El frontend de producción respondió HTTP 200 después del push a `main`.

Verificaciones locales:

- Typecheck: correcto.
- Build de frontend: correcto.
- Tests: 37 de 39 pasaron.
- Los 2 fallos restantes son pruebas preexistentes de `localStorage` en el entorno de Vitest; no están relacionados con este cambio.

## 6. Error exacto de Meta

El log de Railway registró un intento de enviar la plantilla `seguimiento_vencida` y recibió:

```text
Meta API respondió 404
(#132001) Template name does not exist in the translation
template name (seguimiento_vencida) does not exist in es_MX
```

Esto demuestra que:

- El token funciona.
- Railway sí está llegando a Meta.
- El número y la llamada a Graph API están configurados suficientemente para recibir una respuesta de Meta.
- La plantilla solicitada no existe con ese nombre e idioma dentro de la WABA consultada.

## 7. Plantillas que Meta ve actualmente

Después de configurar `WHATSAPP_WABA_ID`, se consultó la WABA desde Railway. Meta devolvió estas plantillas:

```text
nivel_1              APPROVED  es_MX  UTILITY
nivel_2              APPROVED  es_MX  UTILITY
nivel_3              APPROVED  es_MX  UTILITY
nivel_4              APPROVED  es_MX  UTILITY
royaltica_nivel_0   APPROVED  es_MX  UTILITY
hello_world          APPROVED  en_US  UTILITY
```

No apareció:

```text
seguimiento_vencida
```

El código de Royáltica espera estos nombres exactos:

```text
royaltica_nivel_0
aviso_preventivo_pago
recordatorio_cortesia_pago
vence_3_dias
vence_hoy
aviso_vencida
seguimiento_vencida
```

Solo `royaltica_nivel_0` coincide actualmente. Por lo tanto, aunque se arregle la etapa B, otras etapas podrían fallar si el código intenta usar sus nombres y Meta solo tiene plantillas `nivel_1`, `nivel_2`, etc.

## 8. Significado de “Activa: calidad pendiente”

Ese estado no necesariamente significa que la plantilla sea la que está usando Railway. Puede ser:

- Una plantilla con otro nombre interno.
- Una plantilla de otra WABA.
- Una plantilla creada con otro idioma.
- Una plantilla visible para Paolo, pero no asociada al mismo número/token de producción.

El nombre visible o el texto de la plantilla no es suficiente. Hay que verificar el nombre interno exacto y la WABA.

## 9. Solución recomendada

Hay dos caminos posibles.

### Opción A: crear las plantillas con los nombres que usa el código

En la misma WABA y en idioma `es_MX`, crear o confirmar estos nombres:

```text
aviso_preventivo_pago
recordatorio_cortesia_pago
vence_3_dias
vence_hoy
aviso_vencida
seguimiento_vencida
```

Para la plantilla que está fallando:

```text
Nombre interno: seguimiento_vencida
Idioma: es_MX
Categoría: UTILITY
```

Texto esperado por el código:

```text
Hola {{1}}, le escribimos para comentarle que seguimos con la factura {{2}} por {{3}} pendiente de cerrar. Nos gustaría saber si hay algo en lo que podamos apoyarle, o si prefiere que lo platiquemos directamente.
```

Botones esperados:

```text
Sí, platiquemos
Ya voy a pagar
```

Esta opción no requiere modificar el backend. Después de que Meta la apruebe o active, se puede volver a intentar el envío.

### Opción B: cambiar el código para usar los nombres existentes

También se podría mapear el código a `nivel_1`, `nivel_2`, `nivel_3` y `nivel_4`, pero antes hay que confirmar que el texto, las variables y los botones de esas plantillas corresponden exactamente a cada etapa. No conviene cambiar nombres a ciegas.

La recomendación es usar la opción A para conservar una sola fuente de verdad entre el código, el plan de cobranza y Meta.

## 10. Mensaje para Paolo

```text
Paolo, necesitamos revisar las plantillas de WhatsApp en la misma WABA que usa el número de producción.

En Meta entra a:
1. developers.facebook.com/apps
2. Abre la app de Royáltica.
3. WhatsApp → API Setup.
4. Confirma que el número sea el mismo cuyo Phone Number ID está en Railway.
5. Copia el WhatsApp Business Account ID (WABA ID), no el Phone Number ID.
6. En WhatsApp Manager revisa si existe la plantilla interna seguimiento_vencida.
7. Debe estar en idioma es_MX y con estado APPROVED/activa.

Meta/Railway actualmente sí ve nivel_1, nivel_2, nivel_3, nivel_4 y royaltica_nivel_0, pero no ve seguimiento_vencida.

Por favor confirma también si las plantillas nivel_1 a nivel_4 pertenecen a esta misma WABA. No envíes tokens ni App Secret; solo el WABA ID y los nombres/estados de las plantillas.
```

## 11. Comandos útiles

Verificar que Railway tenga el WABA ID sin imprimir su valor:

```bash
cd /Users/josema/Documents/Royaltica/repo/api
railway run sh -lc '[ -n "$WHATSAPP_WABA_ID" ] && echo WABA_ID=present || echo WABA_ID=missing'
```

Ver el estado del servicio:

```bash
railway status
```

Ver los últimos errores de envío:

```bash
railway logs -n 200 -f 'Fallo al enviar'
```

## Estado final

La infraestructura y la autenticación con Meta ya están funcionando. El bloqueo actual es de catálogo de plantillas: el backend solicita `seguimiento_vencida`, pero esa plantilla no está visible con ese nombre en la WABA configurada. La siguiente acción correcta es crearla con el nombre exacto o confirmar con Paolo en qué WABA existe realmente.

No se enviaron mensajes reales desde estas verificaciones; solo se consultaron estados, endpoints y logs.
