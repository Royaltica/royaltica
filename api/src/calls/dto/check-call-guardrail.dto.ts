import { IsUUID } from 'class-validator';

export class CheckCallGuardrailDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  policyId!: string;
}
