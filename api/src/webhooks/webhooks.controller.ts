import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AREAS } from '../auth/constants/permissions';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ALL_WEBHOOK_EVENTS } from './webhook-events';

@Controller('webhooks')
@UseGuards(PermissionsGuard)
@RequirePermissions(AREAS.CONFIGURACION)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /** Catálogo de eventos disponibles para suscripción. */
  @Get('events')
  events() {
    return { events: ALL_WEBHOOK_EVENTS };
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooks.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.webhooks.list(user);
  }

  @Get(':id/deliveries')
  deliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooks.deliveries(user, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.webhooks.remove(user, id);
  }
}
