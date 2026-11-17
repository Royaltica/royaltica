import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { WhatsappConversationService } from './whatsapp-conversation.service';
import { AssignUnmatchedDto } from './dto/conversation.dto';

/**
 * Bandeja de WhatsApp de la plataforma (solo SUPERADMIN): mensajes que no se
 * pudieron atribuir a ninguna organización (teléfono desconocido o repetido
 * entre organizaciones). Las organizaciones ven solo los suyos en
 * /whatsapp/conversations/unmatched.
 */
@Controller('admin/whatsapp/unmatched')
@UseGuards(RolesGuard)
@Roles('SUPERADMIN')
export class AdminWhatsappController {
  constructor(private readonly conversations: WhatsappConversationService) {}

  @Get()
  list() {
    return this.conversations.listUnmatchedPlatform();
  }

  @Post(':id/assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignUnmatchedDto,
  ) {
    return this.conversations.assignUnmatchedPlatform(user.id, id, dto.customerId);
  }

  @Post(':id/dismiss')
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.dismissUnmatchedPlatform(user.id, id);
  }
}
