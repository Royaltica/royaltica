import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetDoNotContactDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}
