# Correo entrante de cobranza — Cloudflare Email Routing → Royáltica

Cierra el ciclo de CxC: sale un recordatorio al cliente, el cliente **responde
el correo**, y esa respuesta se clasifica, se registra en bitácora inmutable y
se avisa a los responsables.

## Qué garantiza (y qué NO hace)

- **Nunca** marca una factura como pagada. Que el cliente escriba "ya pagué" es
  un aviso, no una prueba: la confirmación la hace una persona contra el banco.
- La clasificación es **determinista** (reglas y palabras clave, sin IA). Se
  puede auditar exactamente por qué un mensaje se clasificó como se clasificó.
- Un correo que menciona abogado, demanda, queja, PROFECO/CONDUSEF, acoso o
  disputa del monto se marca **`CUSTOMER_ESCALATION`** y se avisa para que lo
  atienda una persona.
- El texto **citado** del correo original se recorta antes de clasificar. Sin
  esto, nuestro propio recordatorio ("...si ya realizaste el pago...") podría
  leerse como si el cliente hubiera dicho que pagó.

## Montaje (una sola vez)

### 1. Secreto compartido

Genera uno y guarda el MISMO valor en los dos lados:

```bash
openssl rand -hex 32
```

- En el API (Railway → Variables): `EMAIL_INBOUND_SECRET=<el valor>`
- En el Worker (Settings → Variables → **Secret**): `EMAIL_INBOUND_SECRET`

Si `EMAIL_INBOUND_SECRET` va vacío en el API, la firma **no se valida** y
cualquiera podría inyectar respuestas falsas. En producción nunca lo dejes vacío.

### 2. Crear el Worker

1. Cloudflare → **Workers & Pages** → **Create** → **Worker**
2. Nómbralo `royaltica-email-inbound`
3. Pega el contenido de [`worker.js`](./worker.js) y despliega
4. Settings → Variables:
   - `ROYALTICA_WEBHOOK_URL` = `https://<tu-api>/webhooks/email`
     (hoy: `https://royaltica-production.up.railway.app/webhooks/email`)
   - `EMAIL_INBOUND_SECRET` = el secreto del paso 1 (como **Secret**)

### 3. Enrutar el correo al Worker

1. Cloudflare → dominio `royaltica.com` → **Email** → **Email Routing**
2. Si no está activo, **Enable** (Cloudflare agrega los MX automáticamente)
3. **Routes** → **Create address**:
   - Dirección: `cobranza@royaltica.com`
   - Acción: **Send to a Worker** → `royaltica-email-inbound`

### 4. Que los recordatorios se respondan a esa dirección

Para que la respuesta del cliente llegue al Worker, el recordatorio debe salir
con `Reply-To: cobranza@royaltica.com`. Hoy `EmailService` manda desde
`RESEND_FROM_EMAIL` sin `Reply-To`, así que **falta ese ajuste** — está
anotado como pendiente, no está hecho.

## Probar sin mandar un correo real

Con el API corriendo, se puede simular la respuesta de un cliente:

```bash
SECRET="<EMAIL_INBOUND_SECRET>"
BODY='{"data":{"from":"cliente@empresa.mx","subject":"Re: Recordatorio de pago · factura F-1","text":"Ya hice la transferencia"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -s -X POST http://localhost:8080/webhooks/email \
  -H "Content-Type: application/json" \
  -H "X-Royaltica-Signature: $SIG" \
  -d "$BODY"
```

Respuestas posibles:

| Respuesta | Significado |
| --- | --- |
| `{"received":true,"processed":true}` | Se empató con un cliente y quedó registrado |
| `..."reason":"cliente-no-encontrado"` | El remitente no es un cliente registrado (se ignora a propósito) |
| `..."reason":"payload-no-reconocido"` | El cuerpo no traía remitente reconocible |
| `403` | Firma inválida |

## Cómo se clasifica

| Acción en bitácora | Cuándo | Qué pasa |
| --- | --- | --- |
| `PAYMENT_CLAIMED` | Afirma haber pagado, sin negación | Avisa: "verifícalo contra el banco". **No** marca pagada. |
| `CUSTOMER_REPLY` | Cualquier otra respuesta | Avisa para dar seguimiento |
| `CUSTOMER_ESCALATION` | Abogado, demanda, queja, acoso, disputa del monto | Avisa que lo atienda **una persona** |

La escalación se evalúa **aparte** de la intención: "ya pagué, y si insisten
hablo con mi abogado" queda como `PAYMENT_CLAIMED` **y** escala.

## Pendientes conocidos

- **`Reply-To` en los recordatorios** (paso 4): sin esto, el cliente responde a
  `no-reply@` y nunca llega al Worker.
- **Ligado a la factura exacta**: hoy se usa el folio del asunto (`Re: ...
  factura F-123`); si el cliente borra el asunto, cae a la factura pendiente
  más vencida de ese cliente. Un `Reply-To` con token por factura
  (`cobranza+<token>@`) lo haría exacto.
- **Clasificador duplicado**: `whatsapp-webhook.service.ts` tiene su propia
  copia de las listas de palabras. Se dejó intacta para no chocar con trabajo
  en curso; unificarla contra `collections-intent.util.ts` queda pendiente.
