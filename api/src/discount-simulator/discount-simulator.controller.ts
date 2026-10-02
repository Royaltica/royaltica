import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DiscountSimulatorService } from './discount-simulator.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { SimulateDiscountDto } from './dto/simulate-discount.dto';

/**
 * FR-03 (spec "Mejoras V1"): simulador de quitas para campañas especiales
 * (Black Friday / Buen Fin) — atribución de Supervisor/Gerente en la matriz
 * de perfiles del spec ("simulaciones de quitas y análisis de KPIs").
 */
@Controller('discount-simulator')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class DiscountSimulatorController {
  constructor(private readonly simulator: DiscountSimulatorService) {}

  @Post('simulate')
  simulate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SimulateDiscountDto,
  ) {
    return this.simulator.simulate(user, dto);
  }
}
