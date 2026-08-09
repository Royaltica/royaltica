import { Module } from '@nestjs/common';
import { EmailInboundService } from './email-inbound.service';
import { EmailInboundController } from './email-inbound.controller';

/**
 * Webhook de correo ENTRANTE para cobranza (CxC).
 *
 * Cierra el ciclo del recordatorio: sale un correo al cliente, el cliente
 * responde, y esa respuesta queda clasificada, registrada en bitácora y
 * notificada a los responsables.
 *
 * PrismaService, NotificationsService y WhatsappService vienen de módulos
 * globales, así que no hace falta importarlos aquí.
 */
@Module({
  controllers: [EmailInboundController],
  providers: [EmailInboundService],
  exports: [EmailInboundService],
})
export class EmailInboundModule {}
