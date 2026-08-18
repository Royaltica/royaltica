# DNS de royaltica.com — qué revisar y qué cambiar

No tengo acceso al registrador de dominio ni a la zona DNS desde este entorno (ni desde el sandbox de trabajo, que además tiene salida de red restringida a un allowlist reducido), así que esto es una guía para que José lo revise y aplique directo en su proveedor de DNS (Vercel o Cloudflare, según `docs/RAILWAY_SETUP.md`).

## 1. Qué arquitectura hay que soportar

Un solo proyecto de Vercel sirve dos cosas distintas según el host (`frontend/middleware.ts`):

- `royaltica.com` y `www.royaltica.com` → landing/marketing (`landing/index.html` y páginas asociadas).
- `app.royaltica.com` (y cualquier otro subdominio no listado en `MARKETING_ROUTES`) → la aplicación React.
- `api.royaltica.com` → backend en Railway (usado también como destino del rewrite `/api/:path*` en `frontend/vercel.json`).

Los tres hosts necesitan registros DNS correctos para que todo funcione.

## 2. Qué revisar primero

Antes de cambiar nada, confirma el estado actual. Si tienes `dig` o `nslookup` a mano (en tu propia terminal, no en este sandbox):

```bash
dig royaltica.com A
dig www.royaltica.com CNAME
dig app.royaltica.com CNAME
dig api.royaltica.com CNAME
```

O revisa directo en el dashboard de tu proveedor DNS (Vercel → Domains, o Cloudflare → DNS).

## 3. Qué registro corresponde a cada host

**`royaltica.com` (dominio raíz/apex)**
Un dominio apex **no puede** tener un registro CNAME por especificación de DNS (un CNAME en la raíz entra en conflicto con los registros MX/TXT que probablemente ya tienes ahí, como los de Resend/SPF). Lo correcto para el apex es:
- Registro **A** apuntando a la IP anycast de Vercel: `76.76.21.21`, o
- Si tu proveedor DNS soporta registros **ALIAS/ANAME** (Cloudflare sí, con "CNAME flattening" automático), puedes usar ALIAS/ANAME hacia `cname.vercel-dns.com` en vez de una IP fija — más resistente a que Vercel cambie de IP en el futuro.

Si lo que hay hoy en `royaltica.com` es un **A record apuntando a una IP vieja/manual** (no la `76.76.21.21` de Vercel), eso sí es un problema real y hay que corregirlo — pero la corrección es a la IP correcta de Vercel, no a un CNAME (que no es válido ahí).

**`www.royaltica.com`, `app.royaltica.com`, `api.royaltica.com` (subdominios)**
Estos SÍ deben ser **CNAME**, apuntando a:
- `www` y `app` → `cname.vercel-dns.com` (Vercel te lo confirma exacto al agregar el dominio en su dashboard).
- `api` → el dominio que te da Railway al agregar un dominio personalizado al servicio backend (Settings → Networking → Custom Domain), normalmente algo como `xxxx.up.railway.app`.

Si alguno de estos subdominios tiene hoy un **A record con una IP fija** en vez de CNAME, ese es exactamente el cambio pendiente: IP fija se rompe silenciosamente si Vercel/Railway rota su infraestructura; CNAME sigue apuntando al servicio aunque cambie de IP por debajo.

## 4. Resend también necesita DNS (aparte de la API key)

Aunque configures `RESEND_API_KEY` en Railway, los correos de Royáltica (registro externo, alertas, recordatorios de cobranza) se van a marcar como spam o directamente rechazar hasta que verifiques el dominio en Resend:

1. Resend → Domains → Add Domain → `royaltica.com`.
2. Resend te da registros DKIM, SPF y DMARC — se agregan como registros **TXT** en la misma zona DNS.
3. Esperar propagación (~30 min) y presionar "Verify" en Resend.

Esto está documentado en `docs/RAILWAY_SETUP.md` pero vale la pena repetirlo aquí porque es parte del mismo trabajo de DNS y es fácil que se quede pendiente junto con el resto.

## 5. Checklist para José

- [ ] Confirmar con `dig`/dashboard qué registro tiene HOY cada uno de los 4 hosts.
- [ ] `royaltica.com`: A record → `76.76.21.21` (o ALIAS/ANAME a `cname.vercel-dns.com` si tu DNS lo soporta).
- [ ] `www.royaltica.com`: CNAME → `cname.vercel-dns.com`.
- [ ] `app.royaltica.com`: CNAME → `cname.vercel-dns.com`.
- [ ] `api.royaltica.com`: CNAME → el host que dé Railway al agregar el dominio personalizado.
- [ ] Agregar `royaltica.com` como dominio verificado en Resend y pegar sus registros TXT (DKIM/SPF/DMARC).
- [ ] Verificar en Vercel (Settings → Domains) que los 3 hosts de Vercel muestren "Valid Configuration" — Vercel avisa ahí mismo si el DNS está mal apuntado, sin necesidad de `dig`.
