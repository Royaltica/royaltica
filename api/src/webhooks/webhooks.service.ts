import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import type { WebhookEvent } from './webhook-events';

/** Endpoint serializado SIN exponer el secreto completo. */
const serialize = (e: {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  description: string | null;
  secret: string;
  createdAt: Date;
}) => ({
  id: e.id,
  url: e.url,
  events: e.events,
  isActive: e.isActive,
  description: e.description,
  // Solo se muestra una pista del secreto; el valor completo se devuelve
  // una única vez al crear el endpoint.
  secretHint: `••••${e.secret.slice(-4)}`,
  createdAt: e.createdAt,
});

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateWebhookDto) {
    const organizationId = this.requireOrg(user);
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    const endpoint = await this.prisma.withOrg(organizationId, (tx) =>
      tx.webhookEndpoint.create({
        data: {
          organizationId,
          url: dto.url,
          events: dto.events ?? [],
          description: dto.description,
          secret,
        },
      }),
    );

    // El secreto completo se entrega solo aquí; después solo queda la pista.
    return { ...serialize(endpoint), secret };
  }

  async list(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const rows = await this.prisma.withOrg(organizationId, (tx) =>
      tx.webhookEndpoint.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map(serialize);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    await this.prisma.withOrg(organizationId, async (tx) => {
      const endpoint = await tx.webhookEndpoint.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });
      if (!endpoint) throw new NotFoundException('Webhook no encontrado.');
      await tx.webhookEndpoint.delete({ where: { id } });
    });
    return { deleted: true, id };
  }

  async deliveries(user: AuthenticatedUser, endpointId: string) {
    const organizationId = this.requireOrg(user);
    const endpoint = await this.prisma.withOrg(organizationId, (tx) =>
      tx.webhookEndpoint.findFirst({
        where: { id: endpointId, organizationId },
        select: { id: true },
      }),
    );
    if (!endpoint) throw new NotFoundException('Webhook no encontrado.');
    // WebhookDelivery no tiene RLS (no está en la lista de la migración);
    // el acceso ya quedó acotado por el check de endpoint de arriba.
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Emite un evento a todos los endpoints activos de la organización suscritos
   * a él. Es "fire-and-forget": nunca lanza ni bloquea la operación de negocio
   * que lo dispara. Cada intento se registra en WebhookDelivery.
   */
  async dispatch(
    organizationId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    let endpoints;
    try {
      endpoints = await this.prisma.withOrg(organizationId, (tx) =>
        tx.webhookEndpoint.findMany({
          where: {
            organizationId,
            isActive: true,
            // events vacío = todos; si no, debe incluir el evento.
            OR: [{ events: { isEmpty: true } }, { events: { has: event } }],
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `No se pudieron consultar webhooks para ${event}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    await Promise.all(
      endpoints.map((ep) => this.deliver(ep.id, ep.url, ep.secret, event, body)),
    );
  }

  // ── helpers ───────────────────────────────────────────────

  private async deliver(
    endpointId: string,
    url: string,
    secret: string,
    event: string,
    body: string,
  ): Promise<void> {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    let success = false;
    let statusCode: number | null = null;
    let error: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-royaltica-event': event,
          'x-royaltica-signature': `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      statusCode = res.status;
      success = res.ok;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    try {
      await this.prisma.webhookDelivery.create({
        data: {
          endpointId,
          event,
          payload: JSON.parse(body) as Prisma.InputJsonValue,
          success,
          statusCode,
          error,
        },
      });
    } catch {
      this.logger.warn(`No se pudo registrar entrega de webhook ${event}.`);
    }
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
