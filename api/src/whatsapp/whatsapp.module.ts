import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookService } from './whatsapp-webhook.service';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { WhatsappConversationsController } from './whatsapp-conversations.controller';
import { CustomerPortalModule } from '../customer-portal/customer-portal.module';

/**
 * Módulo global: servicios que detectan eventos críticos (auditoría, pagos,
 * jobs) inyectan WhatsappService para emitir alertas de alta prioridad.
 * Además expone el webhook ENTRANTE de WhatsApp (respuestas de clientes a los
 * recordatorios de cobranza) vía WhatsappWebhookController, y la
 * conversación con el cliente deudor (plantilla por nivel → ventana de 24h →
 * respuesta redactada con IA) vía WhatsappConversationsController.
 * CustomerPortalModule da la liga de pago que llevan las plantillas.
 */
@Global()
@Module({
  imports: [CustomerPortalModule],
  controllers: [WhatsappWebhookController, WhatsappConversationsController],
  providers: [WhatsappService, WhatsappWebhookService, WhatsappConversationService],
  exports: [WhatsappService, WhatsappConversationService],
})
export class WhatsappModule {}
