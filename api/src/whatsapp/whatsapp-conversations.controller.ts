import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { AssignUnmatchedDto, SendTemplateDto, SendTextDto } from './dto/conversation.dto';

/**
 * Conversaciones de WhatsApp con clientes deudores (Cobranza IA). Área CxC:
 * Administrador/Supervisor ven toda la cartera; un Agente solo sus clientes
 * asignados (filtro en el servicio).
 */
@Controller('whatsapp/conversations')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CXC)
export class WhatsappConversationsController {
  constructor(private readonly conversations: WhatsappConversationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.listConversations(user);
  }

  /** Plantillas de cobranza con su estado en Meta. Antes de ':customerId'. */
  @Get('templates')
  templates() {
    return this.conversations.templatesWithStatus();
  }

  /** Nivel del plan en el que va cada cliente según lo enviado/respondido. Antes de ':customerId'. */
  @Get('plan-activity')
  planActivity(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.planActivity(user);
  }

  /** Bandeja de mensajes sin cliente claro. Antes de ':customerId'. */
  @Get('unmatched')
  unmatched(@CurrentUser() user: AuthenticatedUser) {
    return this.conversations.listUnmatched(user);
  }

  @Post('unmatched/:id/assign')
  assignUnmatched(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUnmatchedDto,
  ) {
    return this.conversations.assignUnmatched(user, id, dto.customerId);
  }

  @Post('unmatched/:id/dismiss')
  dismissUnmatched(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.conversations.dismissUnmatched(user, id);
  }

  @Get(':customerId')
  thread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.conversations.getThread(user, customerId);
  }

  /** Primer contacto de un nivel: plantilla aprobada por Meta. */
  @Post(':customerId/template')
  sendTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: SendTemplateDto,
  ) {
    return this.conversations.sendTemplateManual(user, customerId, dto.invoiceId, dto.templateName);
  }

  /** Borrador con IA (solo con la ventana de 24h abierta; no envía). */
  @Post(':customerId/draft')
  draft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.conversations.draftReply(user, customerId);
  }

  /** Envía el texto revisado por la persona (solo con la ventana abierta). */
  @Post(':customerId/send')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: SendTextDto,
  ) {
    return this.conversations.sendFreeText(user, customerId, dto.text, dto.levelTemplate);
  }
}
