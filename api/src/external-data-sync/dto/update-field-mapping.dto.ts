import { IsObject } from 'class-validator';

/**
 * Cuerpo de PUT /external-data-sync/field-mapping/:entityType.
 * `mapping` es { campoRoyaltica: campoExterno }, ej. para CUSTOMER:
 * {"name":"CustomerName","rfc":"TaxId","email":"ContactEmail"}.
 * La validación de claves/campos requeridos vive en field-mapping.types.ts
 * (validateMappedRow se aplica fila por fila al importar, no acá: acá solo
 * se guarda la configuración, que puede estar incompleta mientras el admin
 * la arma).
 */
export class UpdateFieldMappingDto {
  @IsObject()
  mapping!: Record<string, string>;
}
