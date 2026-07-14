import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { FactorajeStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Filtros + paginación para GET /factoraje. */
export class QueryFactorajeDto extends PaginationDto {
  @IsOptional()
  @IsEnum(FactorajeStatus)
  status?: FactorajeStatus;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
