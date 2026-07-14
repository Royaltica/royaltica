import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { PaymentRoute, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

/** Filtros + paginación para GET /payments. */
export class QueryPaymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentRoute)
  route?: PaymentRoute;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
