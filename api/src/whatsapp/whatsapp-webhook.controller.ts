import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

/**
 * Endpoint PÚBLICO que Meta (WhatsApp Cloud API) llama para:
 *  - GET  /webhooks/whatsapp  → challenge de verificación (una sola vez, al
 *    configurar el webhook en el panel de Meta).
 *  - POST /webhooks/whatsapp  → entrega de mensajes entrantes de los clientes.
 *
 * Sin JWT (Meta no puede autenticarse con nuestro token): la confianza viene
 * del `verify_token` en el GET y de la firma HMAC (X-Hub-Signature-256) en el
 * POST. El contenido de los mensajes es dato NO confiable: solo se clasifica y
 * se avisa al director, nunca se ejecutan acciones dictadas por el mensaje.
 */
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly webhook: WhatsappWebhookService) {}

  /** Verificación del webhook (Meta manda hub.mode/hub.verify_token/hub.challenge). */
  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    return this.webhook.verifyChallenge(mode, token, challenge);
  }

  /**
   * Recepción de mensajes entrantes. Responde 200 siempre que la firma sea
   * válida (aunque un mensaje suelto falle) para que Meta no reintente en bucle.
   * Límite de tasa alto pero acotado (anti-abuso del endpoint público).
   */
  @Public()
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ received: true; processed: number }> {
    if (!this.webhook.verifySignature(req.rawBody, signature)) {
      throw new ForbiddenException('Firma de webhook inválida.');
    }
    const { processed } = await this.webhook.handleIncoming(payload);
    return { received: true, processed };
  }
}
