import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ALL_WEBHOOK_EVENTS } from '../webhook-events';

/** Registra un endpoint saliente para recibir eventos de Royáltica. */
export class CreateWebhookDto {
  @IsUrl({ require_tld: false }, { message: 'url debe ser una URL válida.' })
  url!: string;

  /** Eventos a suscribir. Vacío o ausente = todos los eventos. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALL_WEBHOOK_EVENTS, { each: true })
  events?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
