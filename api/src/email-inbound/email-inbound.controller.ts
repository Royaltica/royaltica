import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { EmailInboundService } from './email-inbound.service';

/**
 * Endpoint PÚBLICO que el proveedor de correo entrante llama cuando un
 * cliente RESPONDE a un recordatorio de cobranza.
 *
 * Sin JWT (el proveedor no puede autenticarse con nuestro token): la
 * confianza viene de la firma HMAC sobre el cuerpo crudo. El contenido del
 * correo es dato NO confiable — solo se clasifica y se avisa a los
 * responsables; jamás se marca una factura como pagada desde aquí.
 *
 * Compatible con Resend (firma Svix) y con cualquier reenviador propio
 * (p. ej. un Worker de Cloudflare Email Routing) que firme con HMAC-SHA256.
 */
@ApiTags('webhooks')
@Controller('webhooks/email')
export class EmailInboundController {
  constructor(private readonly inbound: EmailInboundService) {}

  @Public()
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recibe la respuesta de un cliente a un recordatorio de cobranza.',
  })
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-royaltica-signature') signature: string | undefined,
    @Headers('svix-id') svixId: string | undefined,
    @Headers('svix-timestamp') svixTimestamp: string | undefined,
    @Headers('svix-signature') svixSignature: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ received: true; processed: boolean; reason?: string }> {
    const valid = this.inbound.verifySignature(req.rawBody, {
      signature,
      svixId,
      svixTimestamp,
      svixSignature,
    });
    if (!valid) {
      throw new ForbiddenException('Firma de webhook inválida.');
    }

    const { processed, reason } = await this.inbound.handleIncoming(payload);
    return { received: true, processed, ...(reason ? { reason } : {}) };
  }
}
