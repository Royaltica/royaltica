import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierDto } from './create-supplier.dto';

/** Todos los campos opcionales para edición parcial (PATCH). */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
