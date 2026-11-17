import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';
import { CollectionSequencesService } from './collection-sequences.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

class PlanSettingsDto {
  /** true = el motor envía solo cada mañana; false = con aprobación de una persona. */
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  /** Modo sombra: calcula y registra lo que enviaría, sin enviar. */
  @IsOptional()
  @IsBoolean()
  shadowMode?: boolean;

  /**
   * Horas máximas de antigüedad del último estado de cuenta para enviar
   * (guardia de frescura). null = apagada.
   */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(24 * 14)
  paymentDataMaxAgeHours?: number | null;
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

  /**
   * Ajustes del plan: envío automático o con aprobación, modo sombra y
   * guardia de frescura del estado de cuenta. Solo cambia lo que viene.
   */
  @Patch()
  updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: PlanSettingsDto) {
    return this.sequences.updatePlanSettings(user, dto);
  }
}
