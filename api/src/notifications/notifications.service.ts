import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import type { Notification, Prisma } from '@prisma/client';
import { Observable, Subject, filter, map, merge, interval } from 'rxjs';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildPaginated,
  type Paginated,
} from '../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { WhatsappPrefsDto } from './dto/whatsapp-prefs.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/** Evento interno que viaja por el stream SSE antes de filtrarse por usuario. */
interface NotificationEvent {
  userId: string;
  notification: Notification;
}

/** Intervalo (ms) del heartbeat SSE para mantener viva la conexión. */
const SSE_HEARTBEAT_MS = 25_000;

/**
 * Centro de notificaciones in-app. La campana del frontend lee de aquí.
 * Otros módulos (jobs, factoraje, pagos) crean notificaciones vía `create`
 * o `createMany`; el usuario las consulta/marca leídas con el resto de métodos.
 */
@Injectable()
export class NotificationsService {
  /** Bus en memoria de notificaciones recién creadas, para el stream SSE. */
  private readonly events$ = new Subject<NotificationEvent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /** Crea una notificación para un usuario (uso interno entre módulos). */
  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    // Empuja en tiempo real al stream SSE del usuario (si está conectado).
    this.events$.next({ userId: input.userId, notification });
    return notification;
  }

  /** Crea la misma notificación para varios usuarios (p. ej. todos los admins). */
  async createMany(
    userIds: string[],
    payload: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    // Creamos una a una para poder empujar cada una por SSE con su id real.
    const created = await Promise.all(
      userIds.map((userId) => this.create({ userId, ...payload })),
    );
    return created.length;
  }

  /**
   * Notifica a todos los CORPORATE_ADMIN activos de una organización.
   * Reutilizable para alertas que deben llegar a "los responsables".
   */
  async notifyOrgAdmins(
    organizationId: string,
    payload: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<number> {
    const admins = await this.prisma.user.findMany({
      where: { organizationId, role: 'CORPORATE_ADMIN', isActive: true },
      select: { id: true },
    });
    return this.createMany(
      admins.map((a) => a.id),
      payload,
    );
  }

  /**
   * Stream SSE de notificaciones para un usuario. Emite cada notificación nueva
   * dirigida a él más un heartbeat periódico (evita que proxies cierren la
   * conexión inactiva). El filtrado por userId garantiza que un usuario solo
   * reciba lo suyo.
   */
  streamFor(userId: string): Observable<MessageEvent> {
    const notifications$ = this.events$.pipe(
      filter((e) => e.userId === userId),
      map(
        (e): MessageEvent => ({
          type: 'notification',
          data: e.notification,
        }),
      ),
    );
    const heartbeat$ = interval(SSE_HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: { ts: Date.now() } })),
    );
    return merge(notifications$, heartbeat$);
  }

  // ── Preferencias de WhatsApp (opt-in por usuario) ─────────

  /** Lee la preferencia de alertas por WhatsApp del usuario actual. */
  async getWhatsappPrefs(user: AuthenticatedUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { whatsappPhone: true, whatsappOptIn: true },
    });
    return {
      whatsappPhone: row?.whatsappPhone ?? null,
      whatsappOptIn: row?.whatsappOptIn ?? false,
    };
  }

  /** Actualiza el opt-in + teléfono de WhatsApp del usuario actual. */
  async setWhatsappPrefs(user: AuthenticatedUser, dto: WhatsappPrefsDto) {
    // Para activar el opt-in debe existir un teléfono (provisto ahora o ya guardado).
    if (dto.optIn && !dto.phone) {
      const current = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { whatsappPhone: true },
      });
      if (!current?.whatsappPhone) {
        throw new BadRequestException(
          'Para activar alertas por WhatsApp debes registrar un teléfono.',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        whatsappOptIn: dto.optIn,
        ...(dto.phone !== undefined ? { whatsappPhone: dto.phone } : {}),
      },
      select: { whatsappPhone: true, whatsappOptIn: true },
    });
  }

  async findAll(
    user: AuthenticatedUser,
    query: QueryNotificationsDto,
  ): Promise<Paginated<unknown> & { unread: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [rows, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return { ...buildPaginated(rows, total, query.page, query.limit), unread };
  }

  /** Conteo rápido de no leídas (para el badge de la campana). */
  async unreadCount(user: AuthenticatedUser) {
    const unread = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
    return { unread };
  }

  /**
   * Resumen de notificaciones creadas para un usuario desde `since` —
   * agrupado por `type` con un conteo. Uso interno del digest de WhatsApp
   * (ROY-25): no filtra por leídas/no leídas, cuenta todo lo creado en la
   * ventana para que el resumen refleje "qué pasó hoy", no un backlog que
   * crece para siempre si el usuario nunca abre la campana.
   */
  async summarySince(
    userId: string,
    since: Date,
  ): Promise<{ total: number; byType: { type: string; count: number }[] }> {
    const grouped = await this.prisma.notification.groupBy({
      by: ['type'],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    const byType = grouped
      .map((g) => ({ type: g.type, count: g._count._all }))
      .sort((a, b) => b.count - a.count);
    const total = byType.reduce((sum, g) => sum + g.count, 0);
    return { total, byType };
  }

  /**
   * Manda un mensaje de WhatsApp de prueba al usuario actual, usando su
   * propio teléfono ya registrado (nunca uno arbitrario que mande el
   * cliente — evita que este endpoint se use para spamear a terceros).
   * Requiere opt-in activo. Uso: botón "Enviar mensaje de prueba" en
   * Configuración, para validar Twilio/Meta sin esperar al cron diario.
   */
  async sendWhatsappTest(user: AuthenticatedUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { whatsappPhone: true, whatsappOptIn: true },
    });
    if (!row?.whatsappOptIn || !row.whatsappPhone) {
      throw new BadRequestException(
        'Activa tus alertas por WhatsApp y registra tu teléfono antes de mandar una prueba.',
      );
    }
    const result = await this.whatsapp.sendMessage(
      row.whatsappPhone,
      '🔔 Royáltica: este es un mensaje de prueba. Si lo recibiste, tus alertas por WhatsApp ya están funcionando.',
    );
    if (!result.sent) {
      throw new BadRequestException(
        result.mode === 'stub'
          ? 'WhatsApp no está configurado todavía en el servidor (falta el proveedor/token).'
          : 'No se pudo enviar el mensaje de prueba. Revisa las credenciales del proveedor.',
      );
    }
    return result;
  }

  async markRead(user: AuthenticatedUser, id: string) {
    await this.getOwned(user, id);
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(user: AuthenticatedUser) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    });
    return { updated: count };
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.getOwned(user, id);
    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ── helpers ───────────────────────────────────────────────

  private async getOwned(user: AuthenticatedUser, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } });
    if (!notif) throw new NotFoundException('Notificación no encontrada.');
    if (notif.userId !== user.id) {
      throw new ForbiddenException('Esta notificación no es tuya.');
    }
    return notif;
  }
}
