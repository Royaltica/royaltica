import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Filtros + paginación para GET /notifications. */
export class QueryNotificationsDto extends PaginationDto {
  /** Si es true, solo devuelve las no leídas. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}
