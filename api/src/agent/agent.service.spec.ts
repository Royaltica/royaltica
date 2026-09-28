import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AgentService } from './agent.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { ActivityLogService } from '../activity/activity-log.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const baseUser: AuthenticatedUser = {
  id: 'agent-1',
  firebaseUid: 'fb-1',
  email: 'agente@royaltica.com',
  role: 'CORPORATE_USER',
  organizationId: 'org-1',
  permissions: ['cxc'],
  supplierId: null,
  operationalProfile: 'AGENTE_EJECUTIVO',
};

describe('AgentService', () => {
  it('myAccounts sin organización lanza ForbiddenException', async () => {
    const service = new AgentService(
      {} as PrismaService,
      {} as ActivityLogService,
    );
    await expect(
      service.myAccounts({ ...baseUser, organizationId: null }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('myAccounts calcula saldo, días de atraso y contactabilidad', async () => {
    const now = new Date('2026-09-27T15:00:00.000Z'); // miércoles, dentro de horario
    jest.useFakeTimers().setSystemTime(now);

    const customer = {
      id: 'cust-1',
      name: 'Grupo Industrial Vela',
      phone: '+5215512345678',
      email: 'cxc@vela.com',
      doNotContact: false,
      invoices: [
        {
          total: { toString: () => '85400.00', valueOf: () => 85400 } as unknown as number,
          currency: 'MXN',
          dueDate: new Date('2026-09-20T00:00:00.000Z'), // 7 días de atraso
        },
      ],
    };
    const prisma = {
      withOrg: (_org: string, fn: (tx: unknown) => unknown) => fn({
        customer: { findMany: jest.fn().mockResolvedValue([customer]) },
        collectionPolicy: {
          findFirst: jest.fn().mockResolvedValue({
            timezone: 'America/Mexico_City',
            allowedContactStartHour: 8,
            allowedContactEndHour: 20,
            blackoutDates: [],
            preferredChannel: 'WHATSAPP',
          }),
        },
      }),
    } as unknown as PrismaService;

    const service = new AgentService(prisma, {} as ActivityLogService);
    const result = await service.myAccounts(baseUser);

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Grupo Industrial Vela');
    expect(result.items[0].balance).toBe(85400);
    expect(result.items[0].daysOverdue).toBe(7);
    expect(result.items[0].canContactNow).toBe(true);
    expect(result.items[0].priorityChannel).toBe('WHATSAPP');

    jest.useRealTimers();
  });

  it('updateAccountStatus rechaza si la cuenta no está asignada al agente', async () => {
    const prisma = {
      withOrg: (_org: string, fn: (tx: unknown) => unknown) => fn({
        customer: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cust-2',
            name: 'Otra empresa',
            assignedAgentId: 'otro-agente',
          }),
        },
      }),
    } as unknown as PrismaService;

    const service = new AgentService(prisma, { record: jest.fn() } as unknown as ActivityLogService);

    await expect(
      service.updateAccountStatus(baseUser, 'cust-2', { status: 'CONTACTED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateAccountStatus registra la gestión cuando la cuenta sí es del agente', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      withOrg: (_org: string, fn: (tx: unknown) => unknown) => fn({
        customer: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cust-1',
            name: 'Grupo Industrial Vela',
            assignedAgentId: 'agent-1',
          }),
        },
      }),
    } as unknown as PrismaService;

    const service = new AgentService(prisma, { record } as unknown as ActivityLogService);
    const res = await service.updateAccountStatus(baseUser, 'cust-1', {
      status: 'PROMISE_TO_PAY',
      note: 'Paga el viernes',
    });

    expect(res).toEqual({ recorded: true });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AGENT_ACCOUNT_STATUS_UPDATED',
        entityId: 'cust-1',
        metadata: { status: 'PROMISE_TO_PAY', note: 'Paga el viernes' },
      }),
    );
  });

  it('updateAccountStatus lanza NotFoundException si la cuenta no existe', async () => {
    const prisma = {
      withOrg: (_org: string, fn: (tx: unknown) => unknown) => fn({
        customer: { findFirst: jest.fn().mockResolvedValue(null) },
      }),
    } as unknown as PrismaService;

    const service = new AgentService(prisma, {} as ActivityLogService);
    await expect(
      service.updateAccountStatus(baseUser, 'no-existe', { status: 'CONTACTED' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
