import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Cuerpo de POST /organization/collection/pause (interruptor de emergencia). */
export class PauseCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
