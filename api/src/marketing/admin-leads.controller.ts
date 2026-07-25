import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { LeadsAdminService } from './leads-admin.service';

class UpdateLeadStatusDto {
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISCARDED'] as const)
  status!: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'DISCARDED';

  /** Nota interna que se guarda en el message del lead (append). */
  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Panel admin de leads capturados desde royaltica.com.
 * Solo SUPERADMIN — los leads no pertenecen a una organización
 * (son prospectos), así que solo el equipo de Royáltica los puede ver.
 */
@ApiTags('admin')
@Controller('admin/leads')
@UseGuards(RolesGuard)
@Roles('SUPERADMIN')
export class AdminLeadsController {
  constructor(private readonly service: LeadsAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Lista leads con filtros y paginación.' })
  @ApiQuery({ name: 'type', required: false, enum: ['DEMO', 'CONTACT'] })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISCARDED'],
  })
  @ApiQuery({ name: 'search', required: false, description: 'Busca en nombre/empresa/correo' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  list(
    @Query('type') type?: 'DEMO' | 'CONTACT',
    @Query('status') status?:
      | 'NEW'
      | 'CONTACTED'
      | 'QUALIFIED'
      | 'CONVERTED'
      | 'DISCARDED',
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.list({
      type,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Contadores por status/type para el dashboard.' })
  summary() {
    return this.service.summary();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambia status y opcionalmente agrega una nota.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateStatus(id, dto.status, user.id, dto.note);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
