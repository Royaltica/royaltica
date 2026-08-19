import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { BillingService, type PaidPlan } from './billing.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

class CreateCheckoutSessionDto {
  @IsIn(['PRO', 'ENTERPRISE'])
  plan!: PaidPlan;
}

@Controller('billing')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Crea la sesión de Stripe Checkout para contratar/actualizar un plan. */
  @Post('checkout-session')
  createCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.billing.createCheckoutSession(user, dto.plan);
  }

  /** Crea la sesión del Billing Portal de Stripe (gestionar/cancelar suscripción). */
  @Post('portal-session')
  createPortalSession(@CurrentUser() user: AuthenticatedUser) {
    return this.billing.createPortalSession(user);
  }
}
