import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { buildPaginated } from '../common/dto/pagination.dto';
import { QueryActivityDto } from './dto/query-activity.dto';

/**
 * Bitácora de actividad de la organización. Solo administradores.
 * El JwtAuthGuard global ya garantiza autenticación.
 */
@Controller('activity')
@UseGuards(RolesGuard)
@Roles('CORPORATE_ADMIN', 'SUPERADMIN')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryActivityDto,
  ) {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query.dateTo) dateFilter.lte = new Date(query.dateTo);

    const where: Prisma.ActivityLogWhereInput = {
      organizationId: user.organizationId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.dateFrom || query.dateTo ? { createdAt: dateFilter } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return buildPaginated(rows, total, query.page, query.limit);
  }
}
