import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TEMPLATE_NAMES } from '../collection-templates';

/** Envío manual de la plantilla de un nivel para una factura pendiente. */
export class SendTemplateDto {
  @IsUUID()
  invoiceId!: string;

  @IsIn(TEMPLATE_NAMES)
  templateName!: string;
}

/** Texto libre (ya revisado por una persona) dentro de la ventana de 24h. */
export class SendTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}
