# Solicitudes sobre datos personales (ARCO): procedimiento del piloto

No es asesoría legal. Es cómo se atiende hoy, con lo que la plataforma ya hace, una solicitud de un contacto (la persona a la que se le cobra) sobre sus datos. Plazos y formalidades los confirma el abogado.

Quién es quién: el **cliente de Royáltica** es el responsable de los datos de sus contactos; **Royáltica** es el encargado y actúa por instrucción del cliente. La solicitud la recibe y la contesta el cliente; Royáltica le da las herramientas.

## Acceso ("¿qué datos tienen de mí?")
1. El administrador entra a Cobranza IA → Datos → abre al cliente → pestaña Bitácora → **Descargar todos sus datos**.
2. Se descarga un archivo con: datos de contacto, facturas, mensajes de WhatsApp enviados y recibidos, y la bitácora (cambios, bajas, gestiones).
3. Queda registrado en la bitácora quién lo descargó y cuándo.
4. El cliente revisa el archivo y se lo entrega a quien lo pidió por el medio que acuerde.

Técnico: `GET /customers/:id/data-export`, solo administradores, limitado a su organización. No incluye los archivos adjuntos (comprobantes); se piden aparte.

## Rectificación ("este dato está mal")
Datos → editar al cliente. Cada cambio queda en la bitácora con quién lo hizo.

## Oposición ("no me contacten")
- Por WhatsApp: el contacto responde BAJA (o "no me escriban", "STOP"…). Se detiene todo contacto automático y se le manda un acuse.
- Por correo: responde BAJA al correo de cobranza.
- A mano: Datos → pausar contacto, con motivo.
En los tres casos se apagan todos los canales. Reactivar exige que una persona lo haga y deja registro.

## Cancelación ("borren mis datos")
Hoy **no hay botón de borrado definitivo**. Lo que existe:
- Eliminar al cliente lo oculta de la operación (borrado lógico) y solo se puede si no tiene facturas abiertas.
- Sus mensajes y facturas se conservan.

Mientras no exista el borrado o la anonimización, una solicitud de cancelación se atiende así:
1. Poner al contacto en no contactar.
2. Avisar a Royáltica (José) para que evalúe qué se puede borrar y qué debe conservarse por obligación fiscal o por instrucción del cliente.
3. Documentar la respuesta que se le dio al solicitante.

## Pendiente de construir
- Borrado o anonimización de un contacto con reglas de retención.
- Origen y fecha del consentimiento por contacto (`consentSource`, `consentAt`): requiere cambio de esquema.
- Política de retención de mensajes y estados de cuenta, y la tarea que la aplique.
- Incluir los comprobantes en la exportación.
