import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { QueryCostsDto } from './dto/query-costs.dto';

/**
 * Panel SUPERADMIN. TODO el controlador exige rol SUPERADMIN: gestiona
 * organizaciones de toda la plataforma y expone el cost tracking. No se acota
 * por organizationId del JWT (a propósito).
 */
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('SUPERADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Organizaciones ────────────────────────────────────────

  @Post('organizations')
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.admin.createOrganization(dto);
  }

  @Get('organizations')
  listOrganizations() {
    return this.admin.listOrganizations();
  }

  @Get('organizations/:id')
  getOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getOrganization(id);
  }

  @Patch('organizations/:id')
  updateOrganization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.admin.updateOrganization(id, dto);
  }

  @Delete('organizations/:id')
  removeOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.removeOrganization(id);
  }

  /**
   * "Entrar como este cliente": emite una sesión real del admin de esa
   * organización para que el SUPERADMIN vea/opere su portal tal cual lo ve
   * él. Queda auditado en la bitácora de actividad (ver AuthService).
   */
  @Post('organizations/:id/impersonate')
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.impersonate(id, { id: user.id, email: user.email });
  }

  // ── Métricas globales ─────────────────────────────────────

  @Get('stats')
  stats() {
    return this.admin.globalStats();
  }

  /** Bitácora de actividad global (todas las orgs). SUPERADMIN. */
  @Get('activity')
  activity(@Query('limit') limit?: string) {
    return this.admin.recentActivity(limit ? Number(limit) : 50);
  }

  // ── Cost tracking ─────────────────────────────────────────

  @Get('costs')
  costs(@Query() query: QueryCostsDto) {
    return this.admin.costByOrganization(query);
  }

  @Get('costs/realtime')
  realtimeCosts() {
    return this.admin.realtimeCosts();
  }

  /** Desglose global por feature. Declarado ANTES de :orgId (no es UUID). */
  @Get('costs/by-feature')
  costsByFeature(@Query() query: QueryCostsDto) {
    return this.admin.globalCostByFeature(query);
  }

  @Get('costs/:orgId')
  costForOrganization(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryCostsDto,
  ) {
    return this.admin.costForOrganization(orgId, query);
  }

  // ── Hardening checklist ────────────────────────────────────

  @Get('production-readiness')
  getProductionReadiness() {
    return this.admin.getProductionReadiness();
  }
}
