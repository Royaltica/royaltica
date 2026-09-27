import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { isBlackoutDate, isWithinContactWindow } from '../common/timezone.util';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { UpdateAccountStatusDto } from './dto/update-account-status.dto';

export interface AgentAccountItem {
  customerId: string;
  name: string;
  balance: number;
  currency: string;
  invoiceCount: number;
  daysOverdue: number;
  /** Puede contactarse AHORA mismo (FR-01): dentro de horario, sin blackout,
   * sin opt-out. Si no hay política activa, no se bloquea (sin guardarraíl
   * configurado todavía) pero sí se respeta doNotContact siempre. */
  canContactNow: boolean;
  /** Motivo por el que no se puede contactar ahora, para mostrar en la UI. */
  blockedReason: 'DO_NOT_CONTACT' | 'OUTSIDE_HOURS' | 'BLACKOUT_DATE' | null;
  priorityChannel: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Servicio detrás de la pantalla ultra-simplificada del perfil
 * Agente/Ejecutivo (spec "Mejoras V1", sección 2): solo expone lo que ese
 * perfil necesita ver — identidad del cliente + saldo, si se puede contactar
 * AHORA (motor de contactabilidad por zona horaria, FR-01) y el canal
 * prioritario — nunca el resto de la plataforma.
 */
@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Bandeja de cuentas asignadas al agente autenticado. */
  async myAccounts(user: AuthenticatedUser): Promise<{
    total: number;
    contactableNow: number;
    items: AgentAccountItem[];
  }> {
    const organizationId = this.requireOrg(user);

    const [customers, policy] = await Promise.all([
      this.prisma.withOrg(organizationId, (tx) =>
        tx.customer.findMany({
          where: {
            organizationId,
            assignedAgentId: user.id,
            isActive: true,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            doNotContact: true,
            invoices: {
              where: {
                direction: 'RECEIVABLE',
                status: 'PENDING',
                deletedAt: null,
              },
              select: { total: true, currency: true, dueDate: true },
            },
          },
        }),
      ),
      this.prisma.withOrg(organizationId, (tx) =>
        tx.collectionPolicy.findFirst({
          where: { organizationId, isActive: true, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      ),
    ]);

    const now = new Date();
    const items: AgentAccountItem[] = customers.map((c) => {
      const balance = c.invoices.reduce((sum, i) => sum + Number(i.total), 0);
      const currency = c.invoices[0]?.currency ?? 'MXN';
      const overdueDays = c.invoices
        .filter((i) => i.dueDate)
        .map((i) =>
          Math.max(
            0,
            Math.floor(
              (now.getTime() - i.dueDate!.getTime()) / 86_400_000,
            ),
          ),
        );
      const daysOverdue = overdueDays.length ? Math.max(...overdueDays) : 0;

      let canContactNow = true;
      let blockedReason: AgentAccountItem['blockedReason'] = null;
      if (c.doNotContact) {
        canContactNow = false;
        blockedReason = 'DO_NOT_CONTACT';
      } else if (policy) {
        if (isBlackoutDate(now, policy.blackoutDates, policy.timezone)) {
          canContactNow = false;
          blockedReason = 'BLACKOUT_DATE';
        } else if (
          !isWithinContactWindow(
            now,
            policy.timezone,
            policy.allowedContactStartHour,
            policy.allowedContactEndHour,
          )
        ) {
          canContactNow = false;
          blockedReason = 'OUTSIDE_HOURS';
        }
      }

      return {
        customerId: c.id,
        name: c.name,
        balance,
        currency,
        invoiceCount: c.invoices.length,
        daysOverdue,
        canContactNow,
        blockedReason,
        priorityChannel: policy?.preferredChannel ?? null,
        phone: c.phone,
        email: c.email,
      };
    });

    // Más urgente (más días de atraso) primero.
    items.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return {
      total: items.length,
      contactableNow: items.filter((i) => i.canContactNow).length,
      items,
    };
  }

  /**
   * Deja constancia de la gestión que hizo el agente sobre una cuenta
   * asignada (spec: "actualización de estatus de gestión"). No es el
   * estatus de la factura — es bitácora de la gestión humana.
   */
  async updateAccountStatus(
    user: AuthenticatedUser,
    customerId: string,
    dto: UpdateAccountStatusDto,
  ): Promise<{ recorded: true }> {
    const organizationId = this.requireOrg(user);

    const customer = await this.prisma.withOrg(organizationId, (tx) =>
      tx.customer.findFirst({
        where: { id: customerId, organizationId, deletedAt: null },
        select: { id: true, name: true, assignedAgentId: true },
      }),
    );
    if (!customer) {
      throw new NotFoundException('Cuenta no encontrada.');
    }
    // Un agente solo puede reportar gestión sobre SUS propias cuentas
    // asignadas (Supervisor/Admin gestionan por otras vías).
    if (customer.assignedAgentId !== user.id) {
      throw new ForbiddenException('Esta cuenta no está asignada a ti.');
    }

    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'AGENT_ACCOUNT_STATUS_UPDATED',
      entityType: 'Customer',
      entityId: customer.id,
      metadata: { status: dto.status, note: dto.note ?? null },
    });

    return { recorded: true };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
