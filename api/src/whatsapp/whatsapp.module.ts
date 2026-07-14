import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

/**
 * Módulo global: servicios que detectan eventos críticos (auditoría, pagos,
 * jobs) inyectan WhatsappService para emitir alertas de alta prioridad.
 */
@Global()
@Module({
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
