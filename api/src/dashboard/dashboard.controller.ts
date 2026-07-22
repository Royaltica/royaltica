import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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

  /** Antigüedad de saldos por cobrar (CxC), agrupada por cliente. */
  @Get('receivables/aging')
  receivablesAging(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getReceivablesAging(user);
  }

  /** Razones financieras de cuentas por cobrar (DSO, cartera, etc.). */
  @Get('receivables/ratios')
  receivablesRatios(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getReceivablesRatios(user);
  }

  /** Resumen de cobranza de un período (cobrado, recordatorios, pendiente). */
  @Get('receivables/digest')
  receivablesDigest(
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.getReceivablesDigest(user, { from, to });
  }

  /** Efectividad del agente de cobranza (cobertura y días recordatorio→pago). */
  @Get('receivables/reminder-effectiveness')
  reminderEffectiveness(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getReminderEffectiveness(user);
  }

  /** Ranking de clientes por comportamiento de pago (mejor → peor). */
  @Get('receivables/customer-ranking')
  customerRanking(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCustomerRanking(user);
  }

  /** Clientes en riesgo (alerta simple sí/no con motivo). */
  @Get('receivables/at-risk')
  atRiskCustomers(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getAtRiskCustomers(user);
  }

  /** Ciclo de conversión de efectivo (CCC = DSO − DPO). */
  @Get('cash-conversion-cycle')
  cashConversionCycle(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getCashConversionCycle(user);
  }
}
