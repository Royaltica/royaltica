import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService, type SearchIndex } from './search.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Búsqueda full-text (Meilisearch). Autenticada: filtra por
 * organizationId del usuario para respetar aislamiento multi-tenant.
 */
@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Búsqueda instantánea (suppliers / invoices / customers).' })
  @ApiQuery({ name: 'q', required: true, description: 'Query text' })
  @ApiQuery({
    name: 'index',
    required: false,
    enum: ['suppliers', 'invoices', 'customers'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async query(
    @Query('q') q: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('index') index: SearchIndex = 'suppliers',
    @Query('limit') limit?: string,
  ): Promise<{ index: SearchIndex; total: number; hits: unknown[] }> {
    const filter = user.organizationId
      ? `organizationId = "${user.organizationId}"`
      : undefined;
    const res = await this.search.search(index, q ?? '', {
      filter,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return { index, total: res.total, hits: res.hits };
  }
}
