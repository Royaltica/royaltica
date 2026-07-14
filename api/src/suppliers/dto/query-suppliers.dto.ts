import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Filtros + paginación para GET /suppliers. */
export class QuerySuppliersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isApproved?: boolean;

  /** Búsqueda por nombre, razón social o RFC. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
