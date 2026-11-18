# Organización de prueba: Piloto Demo (C1)

Desde `api/`, con las dependencias instaladas, el cliente Prisma generado y
`DATABASE_URL` apuntando a una base local o de staging con las migraciones actuales:

```bash
npm run seed:piloto
npm run seed:piloto  # repetir no duplica datos
npm run reset:piloto
npm run seed:piloto  # recrear desde cero
```

Ambos comandos rechazan `NODE_ENV=production`. No ejecutan migraciones ni envían
mensajes. No imprimas ni guardes las credenciales de conexión en notas o commits.

La semilla crea la organización **Piloto Demo**, RFC reservado ficticio
`PILOTO000000`, con producto CxC y equipo habilitado:

- Un administrador, un supervisor y un agente; correos `@piloto.invalid`, sin
  contraseñas ni cuentas reales de Firebase. No permiten iniciar sesión directamente;
  se puede inspeccionar la organización mediante “Entrar como cliente” del superadmin.
- Diez clientes identificados como Demo, asignados al agente, con teléfonos
  inválidos de lada `00`, incluidos sus contactos de Finanzas.
- Veinticinco facturas CxC de ejemplo, pendientes, con vencimientos desde 60 días
  antes hasta 30 días después de la primera ejecución (fechas en UTC).
- El mismo plan por niveles de la aplicación, con `shadowMode: true` y
  `autoSend: false` desde su creación.
- Un estado de cuenta de ejemplo con dos abonos y dos cargos sin conciliar.

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
usuarios, bloqueo en producción, reversión ante fallos y reinicio aislado de otra
organización con el mismo nombre. Las cascadas se simulan en memoria; para
comprobarlas contra Postgres, usa únicamente una base desechable, crea otra
organización, ejecuta el ciclo anterior y verifica que sus registros se conservan.

Validación adicional realizada con PostgreSQL 16 temporal, las 38 migraciones
existentes y un rol sin superusuario ni `BYPASSRLS`: dos ejecuciones de la semilla,
reinicio, segundo reinicio sin datos y nueva semilla. Se verificaron las cascadas
reales, las bitácoras sin FK y que otra organización con el mismo nombre conservó
sus usuarios, clientes, facturas y bitácoras.

Verificaciones completas: Prisma generado, TypeScript de API y frontend, 543
pruebas de Jest, 39 de Vitest y build del frontend. En esta máquina con Node 26,
Vitest requiere `NODE_OPTIONS=--no-experimental-webstorage`; CI usa Node 22. Se
fijó también el reloj de la prueba previa de llamadas, que fallaba al ejecutarse
entre las 9 y las 10 de CDMX.

No trae migración ni cambios al esquema de Prisma.
