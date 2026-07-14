import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ChatDto } from './dto/chat.dto';
import { FeedbackDto } from './dto/feedback.dto';

/**
 * Asistente de IA conversacional. No lleva @RequirePermissions: cualquier
 * usuario autenticado de una organización puede consultarlo. El aislamiento de
 * datos es por organizationId del JWT dentro de cada herramienta.
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
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChatDto) {
    return this.ai.chat(user, dto);
  }

  /** Califica una respuesta del asistente (👍/👎) para mejorar el modelo. */
  @Post('feedback')
  @HttpCode(HttpStatus.OK)
  feedback(@CurrentUser() user: AuthenticatedUser, @Body() dto: FeedbackDto) {
    return this.ai.recordFeedback(user, dto);
  }
}
