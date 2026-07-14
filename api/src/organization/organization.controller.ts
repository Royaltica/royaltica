import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';

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

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.organization.updateSettings(user, dto);
  }
}
