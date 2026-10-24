import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CollectionSequencesService } from './collection-sequences.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

class AutoSendDto {
  @IsBoolean()
  autoSend!: boolean;
}

/**
 * Plan de cobranza por niveles (Nivel 0-4 antes del vencimiento, Etapas A-D
 * después) con las plantillas de WhatsApp aprobadas por Meta. Mismo nivel
 * de acceso que las políticas de cobranza (AREAS.CONFIGURACION).
 */
@Controller('collection-sequences/level-plan')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class LevelPlanController {
  constructor(private readonly sequences: CollectionSequencesService) {}

  /** Plan activo de la organización (o null si aún no tiene). */
  @Get()
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.sequences.currentPlan(user);
  }

  /** Crea el plan por niveles si la organización no tiene uno activo. */
  @Post()
  ensure(@CurrentUser() user: AuthenticatedUser) {
    return this.sequences.ensureLevelPlan(user);
  }

  /** Recordatorios automáticos cada mañana, o con aprobación de una persona. */
  @Patch()
  setAutoSend(@CurrentUser() user: AuthenticatedUser, @Body() dto: AutoSendDto) {
    return this.sequences.setAutoSend(user, dto.autoSend);
  }
}
