import { IsBoolean } from 'class-validator';

/** Aprueba o rechaza un proveedor (PATCH /suppliers/:id/approve). */
export class ApproveSupplierDto {
  @IsBoolean()
  isApproved!: boolean;
}
