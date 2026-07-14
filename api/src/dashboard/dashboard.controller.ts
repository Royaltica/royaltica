import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@Controller('dashboard')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.DASHBOARD)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getOverview(user);
  }

  @Get('aging')
  aging(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getAging(user);
  }

  /** Razones financieras de cuentas por pagar (DPO, puntualidad, etc.). */
  @Get('financial-ratios')
  financialRatios(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getFinancialRatios(user);
  }
}
