# Plantillas de WhatsApp por tipo de deudor (piloto)

Propuesta de textos para someter a Meta como **Utilidad**, idioma `es_MX`. Salen del catálogo de deudores (`frontend/.../cobranza/catalogoDeudores.ts`), ajustados para cumplir el criterio de Utilidad: una factura concreta, sin ofertas, sin urgencia ni consecuencias.

Ya están en `api/src/whatsapp/collection-templates.ts` como `DEBTOR_TYPE_TEMPLATES` (la única fuente de verdad), junto con la variable `empresa`. **Todavía no se envían**: falta someterlas a Meta y que el motor elija plantilla según el tipo de deudor.

Para subirlas a Meta (con `WHATSAPP_TOKEN` y `WHATSAPP_WABA_ID` en el entorno):

```bash
cd api
npx tsx scripts/create-whatsapp-templates.ts --tipos
npx tsx scripts/create-whatsapp-templates.ts --solo aviso_vencida,seguimiento_vencida
```

Sin argumentos el script sube las generales por nivel (las ya aprobadas darán error por duplicadas; usa `--solo`).

## Los 5 tipos del piloto
| Tipo | Causa | A quién describe | Tono |
|---|---|---|---|
| Burocrático | Fricción | Tiene el dinero; la factura se atora en su proceso interno | Cordial, procedimental |
| Desorganizado | Fricción | Traspapela, no lleva control | Servicial |
| Priorizador | No puede | No le alcanza para todos y decide a quién paga primero | Firme, comercial |
| Intencional | No quiere | Puede pagar y lo retrasa | Formal |
| Disputador | Desacuerdo | Retiene el pago por una diferencia comercial | Neutral, documentado |

Lo que venga clasificado con los 25 tipos del catálogo se convierte al tipo del piloto de la misma causa; "riesgo" (ilocalizable) queda sin tipo para que lo vea una persona.

## Variables
`{{1}}` contacto · `{{2}}` empresa que cobra · `{{3}}` folio · `{{4}}` monto · `{{5}}` fecha de pago · `{{6}}` liga (solo donde se indica).
Valores de ejemplo para Meta: Laura · Distribuidora Costa Azul · F-1042 · $12,500.00 MXN · 17 de noviembre · https://app.royaltica.com/portal-cliente/ejemplo

## Primera tanda (10 plantillas): aviso previo y primera vencida
Dos por tipo. Con estas se cubre el piloto; "hoy vence" y el segundo seguimiento usan las generales (`nivel_4`, `seguimiento_vencida`).

### Burocrático
**`tipo_burocratico_previo`** · botones: "Todo completo", "Falta un documento"
> Hola {{1}}, de parte de {{2}}. Para que la factura {{3}} por {{4}}, con fecha de pago el {{5}}, avance sin contratiempos, ¿nos confirma si ya cuenta con la orden de compra, el contrarrecibo y los documentos que necesitan? Si falta algo, lo enviamos hoy.

**`tipo_burocratico_vencida`** · botones: "Ya está autorizada", "Falta un documento"
> Hola {{1}}, de parte de {{2}}. Queremos dar seguimiento a la factura {{3}} por {{4}}, con fecha de pago el {{5}}. ¿En qué paso de su proceso de pago se encuentra y quién la tiene? Si falta algún documento, se lo enviamos de inmediato.

### Desorganizado
**`tipo_desorganizado_previo`** · botones: "Recibido", "Tengo una duda"
> Hola {{1}}, de parte de {{2}}. Le adelantamos su estado de cuenta: la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. Aquí puede revisarla: {{6}}. Gracias.

**`tipo_desorganizado_vencida`** · botones: "Ya pagué, comparto comprobante", "Coordinemos una fecha"
> Hola {{1}}, de parte de {{2}}. Por si le sirve para su control, le compartimos el detalle de la factura {{3}} por {{4}}, con fecha de pago el {{5}}: {{6}}. ¿Le ayuda si coordinamos una fecha de pago?

### Priorizador
**`tipo_priorizador_previo`** · botones: "Está programada", "Prefiero un calendario"
> Hola {{1}}, de parte de {{2}}. Con tiempo le comentamos que la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. Si prefiere dejar un calendario de pagos desde ahora, con gusto lo revisamos. ¿Qué le funcionaría?

**`tipo_priorizador_vencida`** · botones: "Les comparto una fecha", "Platiquemos"
> Hola {{1}}, de parte de {{2}}. Sobre la factura {{3}} por {{4}}, con fecha de pago el {{5}}: sabemos que hay varios compromisos. Si nos comparte cuándo podría quedar lista, la dejamos agendada. ¿Qué fecha le acomoda?

### Intencional
**`tipo_intencional_previo`** · botones: "Sí, está programada", "Tengo una duda"
> Hola {{1}}, de parte de {{2}}. Le recordamos con tiempo que la factura {{3}} por {{4}} tiene como fecha de pago el {{5}}. ¿Nos confirma que está programada para esa fecha?

**`tipo_intencional_vencida`** · botones: "Les comparto la fecha", "Ya pagué, comparto comprobante"
> Hola {{1}}, de parte de {{2}}. Le escribimos por la factura {{3}} por {{4}}, con fecha de pago el {{5}}. ¿Nos confirma la fecha en que quedará lista? Con ese dato actualizamos su cuenta en nuestros registros.

### Disputador
**`tipo_disputador_previo`** · botones: "Todo en orden", "Hay una diferencia"
> Hola {{1}}, de parte de {{2}}. Si hay alguna diferencia por aclarar en la factura {{3}} por {{4}}, con fecha de pago el {{5}}, avísenos con tiempo y la revisamos antes de esa fecha. ¿Todo en orden?

**`tipo_disputador_vencida`** · botones: "Les mando el detalle", "Ya está aclarado"
> Hola {{1}}, de parte de {{2}}. Sobre la factura {{3}} por {{4}}: entendemos que puede haber una diferencia por aclarar. ¿Nos comparte el detalle (cantidad, precio o producto) para revisarlo hoy?

## Lo que se quitó del catálogo original y por qué
| Texto original | Problema | Qué se hizo |
|---|---|---|
| Priorizador: "nos interesa seguir surtiéndole con normalidad", "para mantener sus entregas con normalidad" | Consecuencia implícita: Meta puede rechazarla o pasarla a Marketing, y es un riesgo de conducta de cobranza | Se quitó. Las condiciones de entrega las habla una persona del cliente |
| Intencional: "antes del {{fecha_limite}} para continuar con las entregas sin cambios" | Ultimátum | Se quitó |
| Disputador: "La parte sin diferencia puede programarla aquí: {{liga}}" | Pide un pago parcial que nadie autorizó | Se quitó de la plantilla; lo ofrece una persona |
| Variables `{{saldo}}`, `{{fecha_limite}}`, `{{fecha_promesa}}` | No existen en el sistema | No se usan en esta tanda |

## Para que Meta no las reclasifique a Marketing
- Cada mensaje habla de una factura concreta con su folio y monto.
- Sin ofertas, descuentos ni "aproveche".
- Sin urgencia ni consecuencias.
- Botones de respuesta, no de compra.
- Nombre de categoría al crearla: Utilidad. Revisar el estado de cada una en Cobranza IA → Plantillas → "WhatsApp aprobadas por Meta"; si Meta cambia la categoría, llega una alerta al equipo de Royáltica.

## Pendiente de decidir
1. ¿Las plantillas generales ya aprobadas (`nivel_1` a `nivel_4`) también deben decir "de parte de {{empresa}}"? Hoy no nombran a la empresa que cobra.
2. ¿Quién clasifica a cada cliente en su tipo en el piloto: la consultoría (archivo) o el administrador a mano?
3. El backend todavía no elige plantilla por tipo de deudor: los tipos se guardan en el navegador. Lo construye el carril C (tipos de deudor a la base).
