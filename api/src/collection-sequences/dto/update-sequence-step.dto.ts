import { PartialType } from '@nestjs/mapped-types';
import { CreateSequenceStepDto } from './create-sequence-step.dto';

/** Todos los campos opcionales para edición parcial (PATCH). */
export class UpdateSequenceStepDto extends PartialType(
  CreateSequenceStepDto,
) {}
