import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ChatDto } from './dto/chat.dto';
import { FeedbackDto } from './dto/feedback.dto';

/**
 * Asistente de IA conversacional. No lleva @RequirePermissions: cualquier
 * usuario autenticado de una organización puede consultarlo. El aislamiento de
 * datos es por organizationId del JWT dentro de cada herramienta.
 *
 * Rate-limit dedicado en chat/chat-stream (más ajustado que el límite global
 * de 100 req/60s): cada mensaje dispara una o más llamadas a Vertex AI que
 * cuestan dinero, así que un límite laxo es una superficie de abuso/costo.
 */
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Estado del asistente (si hay GEMINI_API_KEY configurada). */
  @Get('status')
  status() {
    return { available: this.ai.isConfigured };
  }

  /** Envía un mensaje al asistente. Devuelve la respuesta y las herramientas usadas. */
  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChatDto) {
    return this.ai.chat(user, dto);
  }

  /**
   * Igual que /chat pero en streaming (Server-Sent Events): manda eventos
   * `data: {...}\n\n` con fragmentos de texto conforme el modelo los genera,
   * más eventos de herramienta invocada y un evento final `done` con la
   * respuesta completa y las herramientas usadas (para feedback/telemetría).
   */
  @Post('chat/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chatStream(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      for await (const event of this.ai.chatStream(user, dto)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: 'El asistente de IA no pudo procesar tu mensaje en este momento.' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  /** Califica una respuesta del asistente (👍/👎) para mejorar el modelo. */
  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  feedback(@CurrentUser() user: AuthenticatedUser, @Body() dto: FeedbackDto) {
    return this.ai.recordFeedback(user, dto);
  }
}
