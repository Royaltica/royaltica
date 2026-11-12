import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PortfolioAnalysisService } from './portfolio-analysis.service';
import { REPORT_FREQUENCIES, type ReportFrequency } from './portfolio-period.util';

class GenerateReportDto {
  @IsOptional()
  @IsIn(REPORT_FREQUENCIES)
  frequency?: ReportFrequency;

  /** true = periodo en curso hasta hoy (vista previa); false = último cerrado. */
  @IsOptional()
  @IsBoolean()
  current?: boolean;
}

class SetFrequencyDto {
  @IsIn(REPORT_FREQUENCIES)
  frequency!: ReportFrequency;
}

/** Análisis periódico de cartera (Cobranza IA → Reportes). Área CxC. */
@Controller('portfolio-analysis')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class PortfolioAnalysisController {
  constructor(private readonly analysis: PortfolioAnalysisService) {}

  /** Historial de reportes + frecuencia configurada. */
  @Get('reports')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.analysis.list(user);
  }

  @Get('reports/:id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.analysis.get(user, id);
  }

  @Post('generate')
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateReportDto) {
    return this.analysis.generateNow(user, dto);
  }

  @Patch('frequency')
  setFrequency(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetFrequencyDto) {
    return this.analysis.setFrequency(user, dto.frequency);
  }
}
