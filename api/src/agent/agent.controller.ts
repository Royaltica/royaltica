import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';

/**
 * Endpoints exclusivos de la pantalla ultra-simplificada del perfil
 * Agente/Ejecutivo. Reutiliza el área `cxc` de permisos (los agentes son
 * CORPORATE_USER con permissions=['cxc']) — un Supervisor/Admin con acceso a
 * `cxc` también puede llamarlos, pero `myAccounts` solo devuelve lo
 * ASIGNADO al usuario que llama, así que no hay fuga de datos entre agentes.
 */
@Controller('agent')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  @Get('my-accounts')
  myAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.agent.myAccounts(user);
  }

  @Patch('accounts/:customerId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    return this.agent.updateAccountStatus(user, customerId, dto);
  }
}
