import { PartialType } from '@nestjs/mapped-types';
import { CreateVirtualNumberDto } from './create-virtual-number.dto';

export class UpdateVirtualNumberDto extends PartialType(CreateVirtualNumberDto) {}
