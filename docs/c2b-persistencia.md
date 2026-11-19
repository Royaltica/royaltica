# C2b — Persistencia de cobranza

La configuración de empresa, destinatarios, no molestar y hora de resumen se guarda en `Organization.settings` mediante `PATCH /organization/settings` (permiso `configuracion`). Las claves nuevas son `collectionCompany` y `collectionNotifications`. Sus defaults están vacíos y se validan tanto en el DTO como en SettingsService.

Alertas atendidas/pospuestas, reportes guardados y el trabajo que antes persistía `store.tsx` se guardan en `collectionUserState`, separado por ID de usuario dentro de la organización. `GET/PATCH /organization/collection-workspace` exige permiso `cxc` y toma organización y usuario de la sesión; no acepta un selector de usuario ni expone el mapa completo en las respuestas generales. Incluye borradores de campañas, importación de tipos, segmentos manuales e historial del prototipo existente. La conexión de tipos y segmentos al endpoint del carril A corresponde a C3; estos borradores no cambian la política del motor.

Cada guardado del workspace lleva una revisión y bloquea la fila de la organización durante la escritura. Una pestaña desactualizada recibe 409 y debe recargar; en el navegador los cambios se serializan y solo se publican tras confirmación del servidor. Un error conserva el último estado confirmado y ofrece recarga, sin escribir defaults sobre los datos existentes.

Los datos antiguos del navegador **no se importan automáticamente**: sus claves no identificaban a la organización ni al usuario. Hay que volver a capturar los datos que se quieran conservar. No queda `localStorage` en la carpeta de Cobranza.

## Alcance operativo

Guardar destinatarios y horarios conserva preferencias; no verifica teléfonos ni activa mensajes, códigos de verificación o un cron nuevo. La integración de alertas por WhatsApp sigue a cargo del carril A. Las campañas se guardan como borradores con cero enviados; la pantalla ya no simula un lanzamiento exitoso. Empresa conserva datos para la vista previa, sin afirmar que el motor ya los usa en todas las plantillas.

Una cartera vacía o un error de carga no muestran clientes de ejemplo. Tampoco se precargan reportes, pagos, toques ni campañas ficticios. El reporte a la medida no inventa gestiones históricas; el análisis del periodo sigue consultando su endpoint existente. C2b no implementa un historial nuevo de gestiones.

No se toca `collectionEngineHour`, ni se duplican `maxContactsPerWeek` o `blackoutDates` en settings. **No trae migración** ni cambios al esquema de Prisma. C4 sigue siendo del carril A.

## Cómo probarlo

1. En una organización de prueba, abrir Configuración → Tu empresa. Capturar y guardar nombre, correo, liga HTTPS y una CLABE de 18 dígitos si corresponde; recargar y comprobar los valores. Una CLABE corta o una liga inválida debe mostrar error sin anunciar éxito.
2. En Alertas al celular, agregar un número de prueba con lada `00`, cambiar no molestar y resumen, y pulsar Guardar preferencias. Al recargar se conserva; el número sigue sin verificar y Mandar prueba está deshabilitado.
3. En Reportes → Reporte a la medida, guardar filtros, recargar, renombrar con Enter y borrar. No deben aparecer los reportes de ejemplo.
4. Con cartera real de prueba, atender o posponer una alerta y recargar. Reactivarla vuelve a pendientes. Si cambia la causa, reaparece aunque se hubiera atendido.
5. Abrir dos pestañas con el mismo usuario. Guardar en una e intentar guardar desde la otra sin recargar: debe aparecer el conflicto y conservarse el cambio de la primera.
6. Entrar con otro usuario o en otra organización y comprobar que no hereda reportes, alertas atendidas ni borradores personales.
7. Interrumpir la conexión antes de guardar: no debe aparecer un éxito ni desaparecer el formulario. Usar Recargar datos tras restablecerla.

## Verificación automatizada

- API: `npx prisma generate && npx tsc --noEmit -p tsconfig.json && node --experimental-vm-modules node_modules/.bin/jest`.
- Frontend: `npx tsc --noEmit && npx vitest run && npm run build`.
- En Node 26 local, Vitest necesita `NODE_OPTIONS=--no-experimental-webstorage` para usar el almacenamiento de jsdom. CI usa Node 22.
- Las pruebas cubren recarga, separación por organización/usuario, permisos, privacidad, validación, conflictos y fallos de escritura. El flujo principal C5 permanece dentro de Jest.
