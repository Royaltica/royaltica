import { PartialType } from '@nestjs/mapped-types';
import { CreateCollectionPolicyDto } from './create-collection-policy.dto';

/** Todos los campos opcionales para edición parcial (PATCH). */
export class UpdateCollectionPolicyDto extends PartialType(
  CreateCollectionPolicyDto,
) {}
