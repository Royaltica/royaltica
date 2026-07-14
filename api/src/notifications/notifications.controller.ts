import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  Sse,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { WhatsappPrefsDto } from './dto/whatsapp-prefs.dto';

/**
 * Centro de notificaciones del usuario (la campana). No lleva
 * `@RequirePermissions`: cada usuario autenticado —incluido un PROVIDER—
 * ve y gestiona únicamente sus propias notificaciones (scope por user.id).
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notifications.findAll(user, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user);
  }

  /**
   * Stream SSE en tiempo real (la campana se actualiza sin recargar).
   * EventSource no puede mandar headers, así que el JWT viaja como
   * `?token=` (la JwtStrategy lo extrae también del query param).
   */
  @Sse('stream')
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.notifications.streamFor(user.id);
  }

  /** Lee la preferencia de alertas críticas por WhatsApp del usuario. */
  @Get('whatsapp')
  getWhatsapp(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getWhatsappPrefs(user);
  }

  /** Activa/desactiva el opt-in de WhatsApp y registra el teléfono. */
  @Put('whatsapp')
  setWhatsapp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WhatsappPrefsDto,
  ) {
    return this.notifications.setWhatsappPrefs(user, dto);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.markRead(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notifications.remove(user, id);
  }
}
