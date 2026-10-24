import { Prisma } from '@prisma/client';

/**
 * Mensaje entendible para quien sube el archivo. Los errores de Prisma traen
 * el stack y la consulta completa: inútiles (y ruidosos) en la pantalla.
 */
export function friendlyImportError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return 'Ya existe otro registro con un dato que no se puede repetir (RFC, folio o UUID).';
    if (err.code === 'P2003') return 'Hace referencia a un registro que no existe.';
    return `No se pudo guardar el registro (código ${err.code}).`;
  }
  if (err instanceof Prisma.PrismaClientValidationError) return 'Algún dato del renglón tiene un formato inválido.';
  return err instanceof Error ? err.message : String(err);
}
