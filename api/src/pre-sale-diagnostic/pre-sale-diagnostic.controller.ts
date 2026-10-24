import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { PreSaleDiagnosticService } from './pre-sale-diagnostic.service';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';

/**
 * Endpoints PÚBLICOS del "Diagnóstico" pre-venta (Fase 4, concepto de
 * Paolo): un prospecto lo responde ANTES de contratar, sin cuenta. Mismo
 * criterio de rate-limit que /marketing (5 req / 60s por IP).
 */
@ApiTags('diagnostico-cobranza')
@Controller('diagnostico-cobranza')
export class PreSaleDiagnosticController {
  constructor(private readonly diagnostic: PreSaleDiagnosticService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Responder el diagnóstico de cobranza (público).' })
  submit(@Body() dto: SubmitDiagnosticDto) {
    return this.diagnostic.submit(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':id')
  @ApiOperation({ summary: 'Consultar un diagnóstico ya respondido (liga compartible).' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.diagnostic.findOne(id);
  }
}
