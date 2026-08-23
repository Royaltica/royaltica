import { Body, Controller, ForbiddenException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CallGuardrailsService } from './call-guardrails.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CheckCallGuardrailDto } from './dto/check-call-guardrail.dto';
import { SetDoNotContactDto } from './dto/set-do-not-contact.dto';

/**
 * Guardrails de llamadas con IA: mismo nivel de acceso que el resto de
 * cobranza (AREAS.CXC). No hace llamadas — solo evalúa reglas y registra
 * el opt-out del cliente. La integración con el proveedor de voz (Retell
 * AI u otro) consulta `POST /calls/guardrails/check` antes de marcar.
 */
@Controller('calls/guardrails')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class CallsController {
  constructor(private readonly guardrails: CallGuardrailsService) {}

  @Post('check')
  check(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckCallGuardrailDto) {
    const organizationId = this.requireOrg(user);
    return this.guardrails.evaluateCallAttempt(organizationId, dto.customerId, dto.policyId);
  }

  @Post('opt-out/:customerId')
  async optOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: SetDoNotContactDto,
  ) {
    const organizationId = this.requireOrg(user);
    await this.guardrails.setDoNotContact(organizationId, customerId, dto.reason, user.id);
    return { ok: true, customerId };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
