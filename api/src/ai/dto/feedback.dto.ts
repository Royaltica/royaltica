import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Cuerpo de POST /ai/feedback. El usuario califica una respuesta del asistente
 * (👍 UP / 👎 DOWN). Se guarda con la pregunta y la respuesta para poder
 * revisar después los casos marcados como malos y afinar prompt/herramientas.
 */
export class FeedbackDto {
  @IsIn(['UP', 'DOWN'])
  rating!: 'UP' | 'DOWN';

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  answer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolsUsed?: string[];
}
