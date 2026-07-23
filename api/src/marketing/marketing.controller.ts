import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { MarketingService } from './marketing.service';
import { ScheduleDemoDto } from './dto/schedule-demo.dto';
import { ContactDto } from './dto/contact.dto';

/**
 * Endpoints PÚBLICOS para el sitio marketing (royaltica.com):
 * agendar demo y formulario de contacto.
 *
 * - Sin auth (Public).
 * - Rate-limit dedicado (5 req / 60s por IP) para evitar spam sin
 *   estrangular al usuario legítimo.
 */
@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('demo')
  @HttpCode(200)
  @ApiOperation({ summary: 'Solicitar una demo (público).' })
  scheduleDemo(@Body() dto: ScheduleDemoDto): Promise<{ ok: true }> {
    return this.marketing.scheduleDemo(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('contact')
  @HttpCode(200)
  @ApiOperation({ summary: 'Enviar un mensaje de contacto (público).' })
  contact(@Body() dto: ContactDto): Promise<{ ok: true }> {
    return this.marketing.contact(dto);
  }
}
