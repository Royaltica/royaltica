import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ErpConnectorFactory } from './erp-connector.factory';
import type { ErpConnector } from './erp-connector.interface';

@Injectable()
export class ErpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityLogService,
    private readonly factory: ErpConnectorFactory,
  ) {}

  /** Estado de la integración ERP de la organización. */
  async status(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    const { erpProvider } = await this.settings.get(organizationId);
    const connector = this.factory.create(erpProvider);
    return {
      erpProvider,
      connected: connector?.isConfigured ?? false,
      mode: connector ? (connector.isConfigured ? 'live' : 'stub') : 'none',
      message: erpProvider
        ? `ERP ${erpProvider} ${connector?.isConfigured ? 'conectado' : 'en modo stub (sin credenciales)'}.`
        : 'No hay ERP configurado. Asígnalo en /organization/settings (erpProvider).',
    };
  }

  async syncInvoices(user: AuthenticatedUser) {
    const { organizationId, connector } = await this.resolve(user);
    const result = await connector.syncInvoices(organizationId);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'ERP_SYNC_INVOICES',
      metadata: { ...result },
    });
    return result;
  }

  async syncSuppliers(user: AuthenticatedUser) {
    const { organizationId, connector } = await this.resolve(user);
    const result = await connector.syncSuppliers(organizationId);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'ERP_SYNC_SUPPLIERS',
      metadata: { ...result },
    });
    return result;
  }

  async pushPayment(user: AuthenticatedUser, paymentId: string) {
    const { organizationId, connector } = await this.resolve(user);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado.');

    const result = await connector.pushPayment(organizationId, paymentId);
    await this.activity.record({
      organizationId,
      userId: user.id,
      action: 'ERP_PUSH_PAYMENT',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: { ...result },
    });
    return result;
  }

  // ── helpers ───────────────────────────────────────────────

  private async resolve(
    user: AuthenticatedUser,
  ): Promise<{ organizationId: string; connector: ErpConnector }> {
    const organizationId = this.requireOrg(user);
    const { erpProvider } = await this.settings.get(organizationId);
    const connector = this.factory.create(erpProvider);
    if (!connector) {
      throw new BadRequestException(
        'No hay ERP configurado para esta organización. Asígnalo en /organization/settings.',
      );
    }
    return { organizationId, connector };
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
