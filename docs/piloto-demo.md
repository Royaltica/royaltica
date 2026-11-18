# Organización de prueba: Piloto Demo (C1)

Desde `api/`, con las dependencias instaladas, el cliente Prisma generado y
`DATABASE_URL` apuntando a una base local o de staging con las migraciones actuales:

```bash
npm run seed:piloto
npm run seed:piloto  # repetir no duplica datos
npm run reset:piloto
npm run seed:piloto  # recrear desde cero
```

Ambos comandos rechazan `NODE_ENV=production` y, antes de crear el cliente Prisma,
validan el host de `DATABASE_URL`: solo aceptan `localhost`, `127.0.0.1` o `::1`
(en una URL, IPv6 se escribe `[::1]`). Una URL ausente, inválida, ajena a PostgreSQL
o con un parámetro `host` alternativo también se rechaza. Esto impide que un `.env`
local que apunta a Railway ejecute la semilla o el reinicio por accidente.

Para un staging remoto futuro se requiere `PILOT_SEED_ALLOW_HOST` con **exactamente
el hostname de destino**, sin esquema, puerto, espacios, listas ni comodines. Por
ejemplo, si el host de staging es `db.staging.invalid`:

```bash
PILOT_SEED_ALLOW_HOST=db.staging.invalid npm run seed:piloto
PILOT_SEED_ALLOW_HOST=db.staging.invalid npm run reset:piloto
```

La excepción no evita el bloqueo de `NODE_ENV=production`; úsala solo para un
staging identificado y autorizado. Los errores de host muestran únicamente el
host bloqueado, nunca la URL completa, el usuario ni la contraseña. Una URL inválida
produce un mensaje fijo sin imprimir su contenido. No ejecutan migraciones ni
envían mensajes. No imprimas ni guardes credenciales en notas o commits.

La semilla crea la organización **Piloto Demo**, RFC reservado ficticio
`PILOTO000000`, con producto CxC y equipo habilitado:

- Un administrador, un supervisor y un agente; correos `@piloto.invalid`, sin
  contraseñas ni cuentas reales de Firebase. **Los usuarios de la semilla no pueden
  iniciar sesión**. Inicia sesión con tu cuenta de superadministrador y revisa
  **Piloto Demo** mediante **“Entrar como cliente”**.
- Diez clientes identificados como Demo, asignados al agente, con teléfonos
  inválidos de lada `00`, incluidos sus contactos de Finanzas.
- Veinticinco facturas CxC de ejemplo, pendientes, con vencimientos desde 60 días
  antes hasta 30 días después de la primera ejecución (fechas en UTC).
- El mismo plan por niveles de la aplicación, con `shadowMode: true` y
  `autoSend: false` desde su creación.
- Un estado de cuenta de ejemplo con dos abonos y dos cargos sin conciliar.

La semilla **no ejecuta la conciliación**: los movimientos nacen `UNMATCHED`, sin
`matchedInvoiceId` ni propuesta. Guardar un abono por sí solo no frena una factura;
la guardia necesita que la conciliación lo vincule como posible pago sin revisar.

Para conciliar específicamente el estado sembrado, identifica su `id` mediante
`GET /bank-reconciliation/imports` en la sesión de **Piloto Demo** (banco
“Banco Demo — estado de cuenta de ejemplo”). Desde un contexto Nest de desarrollo,
ejecuta el servicio existente
`BankReconciliationMatchingService.runAutoMatch(importId, organizationId)` con
ese import y `PILOT_ORGANIZATION_ID` (exportado en `api/src/pilot/pilot-seed.ts`).
El servicio se obtiene con `app.get(BankReconciliationMatchingService)`. No hay
un endpoint para volver a conciliar un import existente.

También puedes probar el flujo por HTTP desde Swagger (`/docs` de la API), con
la sesión de **Piloto Demo**: sube un CSV a
`POST /bank-reconciliation/imports` (campo multipart `file`, `bankName` opcional).
Este endpoint **sí ejecuta la conciliación** después de importar. Con el mapeo por
defecto, un archivo así propone el pago de `DEMO-006`, que ya está vencida; cambia
la fecha por la de hoy para que el depósito esté dentro de los últimos 30 días:

```csv
transactionDate,amount,description,referenceNumber
2026-11-18,1740,Abono de ejemplo DEMO-006,DEMO-006
```

Estas rutas son directas al backend; mediante el proxy del frontend llevan el
prefijo `/api`. En ambos caminos, consulta
`GET /bank-reconciliation/imports/:id/transactions`:
el abono debe tener `matchedInvoiceId` o incluir la factura en
`matchProposal.invoiceIds`. Antes de confirmar, `CollectionSafetyService.checkBeforeSend`
para esa factura devuelve `payment-pending-review`; una evaluación del motor en
horario permitido la omite por ese motivo. Mantén `shadowMode: true` y
`autoSend: false`. Las propuestas aún no marcan las facturas pagadas. Al revisar
y confirmar el abono con `POST /bank-reconciliation/transactions/:id/confirm`,
se registra el pago; si cubre el saldo, la factura queda `PAID` y el motor ya no
la toma. Los cargos quedan fuera de las propuestas de cobranza.

Los identificadores son estables. Repetir la semilla conserva los cambios de una
prueba y las fechas originales; vuelve a activar el modo sombra y a desactivar el
envío automático del plan de la semilla. Para regresar al estado inicial y recalcular
fechas, ejecuta primero `reset:piloto` y después `seed:piloto`.

El reinicio **borra la organización completa y todos sus datos**, incluidos los
agregados durante las pruebas. Busca por el RFC fijo y exige además el identificador
reservado y el nombre exacto. Si no existe, no hace nada; si hay un conflicto de
identidad, falla sin borrar. Ejecuta todo en una transacción con `withOrg`, elimina
las dos bitácoras sin FK (`AiFeedback`, `CollectionReport`) y usa las relaciones
en cascada existentes para el resto. No toca otras organizaciones.

Prueba automatizada sin base de datos ni red:

```bash
node --experimental-vm-modules node_modules/.bin/jest pilot-seed.spec.ts --runInBand
```

Cubre repetición sin duplicados, cartera y perfiles, modo sombra, conflictos de
usuarios, bloqueo en producción, validación de hosts locales/remotos y URLs
inválidas (sin exponer credenciales), reversión ante fallos y reinicio aislado de otra
organización con el mismo nombre. Las cascadas se simulan en memoria; para
comprobarlas contra Postgres, usa únicamente una base desechable, crea otra
organización, ejecuta el ciclo anterior y verifica que sus registros se conservan.

Validación adicional realizada con PostgreSQL 16 temporal, las 38 migraciones
existentes y un rol sin superusuario ni `BYPASSRLS`: dos ejecuciones de la semilla,
reinicio, segundo reinicio sin datos y nueva semilla. Se verificaron las cascadas
reales, las bitácoras sin FK y que otra organización con el mismo nombre conservó
sus usuarios, clientes, facturas y bitácoras.

Verificaciones completas: Prisma generado, TypeScript de API y frontend, 589
pruebas de Jest, 39 de Vitest y build del frontend. En esta máquina con Node 26,
Vitest requiere `NODE_OPTIONS=--no-experimental-webstorage`; CI usa Node 22. Se
fijó también el reloj de la prueba previa de llamadas, que fallaba al ejecutarse
entre las 9 y las 10 de CDMX.

No trae migración ni cambios al esquema de Prisma.
