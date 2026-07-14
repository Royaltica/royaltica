import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { DocumentType } from '@prisma/client';

/**
 * Metadatos que acompañan al archivo en la subida de un documento KYC.
 * El archivo viaja como multipart; estos campos como form-data.
 */
export class UploadDocumentDto {
  @IsEnum(DocumentType, { message: 'Tipo de documento inválido.' })
  type!: DocumentType;

  /** Fecha de vencimiento del documento (ISO), si aplica. */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
