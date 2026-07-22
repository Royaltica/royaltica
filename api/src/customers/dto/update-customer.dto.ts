import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

/** Todos los campos opcionales para edición parcial (PATCH). */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
