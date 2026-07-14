import { Plan } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

/** Cambia el plan o el estado activo de una organización (solo SUPERADMIN). */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
