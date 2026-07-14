import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Un turno previo de la conversación. `role` sigue la convención de Gemini:
 * 'user' (lo que escribió la persona) o 'model' (lo que respondió el asistente).
 */
export class ChatTurnDto {
  @IsIn(['user', 'model'])
  role!: 'user' | 'model';

  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}

/**
 * Cuerpo de POST /ai/chat. `message` es el mensaje nuevo del usuario;
 * `history` es el historial opcional de la conversación (sin incluir este
 * mensaje). El historial lo manda el cliente; el backend no guarda estado.
 */
export class ChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
