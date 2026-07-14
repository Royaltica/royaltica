import { Global, Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

/**
 * Módulo global: cualquier servicio (facturas, pagos, factoraje, proveedores)
 * inyecta WebhooksService para emitir eventos salientes vía dispatch().
 */
@Global()
@Module({
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
