import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SatService } from './sat.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Sync69bDto } from './dto/sync-69b.dto';

/**
 * Cumplimiento SAT: verificación de RFC en padrón y lista 69-B (EFOS/EDOS).
 * El JwtAuthGuard global ya garantiza autenticación.
 */
@Controller('sat')
export class SatController {
  constructor(private readonly sat: SatService) {}

  /** Verifica un RFC: estatus en padrón + si está en lista 69-B. */
  @Get('check-rfc/:rfc')
  async checkRfc(@Param('rfc') rfc: string) {
    const [active, blacklist] = await Promise.all([
      this.sat.checkRfcActive(rfc),
      this.sat.check69b(rfc),
    ]);
    return { ...active, list69b: blacklist };
  }

  /** Sincroniza la lista 69-B con entradas manuales (solo administradores). */
  @Post('sync-69b')
  @UseGuards(RolesGuard)
  @Roles('CORPORATE_ADMIN', 'SUPERADMIN')
  sync69b(@Body() dto: Sync69bDto) {
    return this.sat.sync69b(dto.entries);
  }

  /**
   * Descarga y sincroniza la lista 69-B oficial del SAT ahora mismo
   * (además del cron nocturno). Solo administradores.
   */
  @Post('sync-69b/download')
  @UseGuards(RolesGuard)
  @Roles('CORPORATE_ADMIN', 'SUPERADMIN')
  sync69bDownload() {
    return this.sat.sync69bFromSat();
  }
}
