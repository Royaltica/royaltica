import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';

/**
 * Módulo global: servicios que detectan eventos críticos (auditoría, pagos,
 * jobs) inyectan WhatsappService para emitir alertas de alta prioridad.
 * Además expone el webhook ENTRANTE de WhatsApp (respuestas de clientes a los
 * recordatorios de cobranza) vía WhatsappWebhookController.
 */
@Global()
@Module({
  controllers: [WhatsappWebhookController],
  providers: [WhatsappService, WhatsappWebhookService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
