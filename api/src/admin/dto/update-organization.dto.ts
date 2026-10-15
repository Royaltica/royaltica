import { Plan } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { SEAT_PACKAGE_PRESETS } from '../../common/seat-limits';

const SEAT_PACKAGES = Object.keys(SEAT_PACKAGE_PRESETS);

/**
 * Producto de CxC que ve esta organización. Pedido explícito de José: "el
 * cliente solo tiene o CXP o CXC" — nunca ambos, por ahora. Null/no asignado
 * = organización legacy, sigue viendo todo (comportamiento actual, sin
 * romper nada retroactivamente).
 */
export const PRODUCTS = ['CXP', 'CXC'] as const;
export type Product = (typeof PRODUCTS)[number];

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

  /**
   * Producto contratado (CXP = cuentas por pagar, CXC = cuentas por
   * cobrar/cobranza). Opcional: sin producto asignado, la organización ve
   * todo (comportamiento legacy).
   */
  @IsOptional()
  @IsIn(PRODUCTS, { message: `El producto debe ser uno de: ${PRODUCTS.join(', ')}.` })
  product?: Product;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
