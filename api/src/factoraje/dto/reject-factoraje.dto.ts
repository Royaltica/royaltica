import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Motivo opcional al rechazar una solicitud de factoraje. */
export class RejectFactorajeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
