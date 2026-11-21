import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CollectionSequencesService } from './collection-sequences.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

/**
 * Consulta y control manual de las ejecuciones (CollectionSequenceRun) del
 * motor de escalamiento de cobranza: pausar/reanudar/cancelar cuando un
 * humano interviene (ej. cliente en negociación de pago).
 */
@Controller('collection-sequences/runs')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class CollectionSequenceRunsController {
  constructor(private readonly sequences: CollectionSequencesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sequences.findRuns(user);
  }

  @Get('command-center')
  commandCenter(@CurrentUser() user: AuthenticatedUser) {
    return this.sequences.commandCenter(user);
  }

  @Get('ai-actions')
  aiActionsInbox(@CurrentUser() user: AuthenticatedUser) {
    return this.sequences.aiActionsInbox(user);
  }

  /**
   * Lo que el modo sombra habría enviado en los últimos `dias` (1 por omisión,
   * máximo 14; 7 = la semana de prueba del piloto). Antes de ':id'.
   */
  @Get('shadow-report')
  shadowReport(@CurrentUser() user: AuthenticatedUser, @Query('dias') dias?: string) {
    const n = Math.min(14, Math.max(1, Math.floor(Number(dias) || 1)));
    return this.sequences.shadowReport(user, new Date(Date.now() - n * 24 * 3600 * 1000));
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.findRun(user, id);
  }

  @Patch(':id/pause')
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.pauseRun(user, id);
  }

  @Patch(':id/resume')
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.resumeRun(user, id);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sequences.cancelRun(user, id);
  }
}
