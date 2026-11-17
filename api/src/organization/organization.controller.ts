import { Body, Controller, Get, HttpCode, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PauseCollectionDto } from './dto/pause-collection.dto';

@Controller('organization')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.getProfile(user);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.getSettings(user);
  }

  @Get('readiness')
  getReadiness(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.getReadiness(user);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.organization.updateSettings(user, dto);
  }

  // Interruptor de emergencia de cobranza: detiene todos los envíos
  // automáticos a deudores de la organización hasta que se reanude.
  @Get('collection/status')
  getCollectionStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.getCollectionStatus(user);
  }

  @Post('collection/pause')
  @HttpCode(200)
  pauseCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PauseCollectionDto,
  ) {
    return this.organization.pauseCollection(user, dto.reason);
  }

  @Post('collection/resume')
  @HttpCode(200)
  resumeCollection(@CurrentUser() user: AuthenticatedUser) {
    return this.organization.resumeCollection(user);
  }
}
