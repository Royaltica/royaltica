import { IsString, Matches } from 'class-validator';

/** Período mensual en formato YYYY-MM. */
const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class GenerateDiotDto {
  @IsString()
  @Matches(PERIOD_REGEX, { message: 'El período debe tener formato YYYY-MM.' })
  period!: string;
}
