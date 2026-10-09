import { Plan } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { SEAT_PACKAGE_PRESETS } from '../../common/seat-limits';

const SEAT_PACKAGES = Object.keys(SEAT_PACKAGE_PRESETS);

/** Cambia el plan, paquete de licencias o el estado activo de una
 * organización (solo SUPERADMIN). */
export class UpdateOrganizationDto {
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  /**
   * Paquete de licencias de CxC (PAQUETE_1 = 3/3/3, PAQUETE_2 = 4/4/4,
   * PAQUETE_3 = 5/5/5 — ver common/seat-limits.ts). Opcional: sin paquete
   * asignado, la organización no tiene tope de subcuentas.
   */
  @IsOptional()
  @IsIn(SEAT_PACKAGES, {
    message: `El paquete debe ser uno de: ${SEAT_PACKAGES.join(', ')}.`,
  })
  seatPackage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
