import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateSpeiOrderDto {
  @IsString()
  @Length(18, 18)
  @Matches(/^\d{18}$/)
  clabeDestino!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreBeneficiario!: string;

  @IsOptional()
  @IsString()
  rfcBeneficiario?: string;

  @IsNumber()
  @IsPositive()
  @Max(50000000)
  monto!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  concepto!: string;

  @IsNumber()
  @Min(1000000)
  @Max(9999999)
  referenciaNumerica!: number;
}
