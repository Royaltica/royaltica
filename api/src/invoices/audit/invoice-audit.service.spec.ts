import { ForensicStatus, InvoiceStatus } from '@prisma/client';
import { InvoiceAuditService } from './invoice-audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../../gemini/gemini.service';
import { SatService } from '../../sat/sat.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

const user: AuthenticatedUser = {
  id: 'user-1',
  firebaseUid: 'fb-1',
  email: 'admin@royaltica.com',
  role: 'CORPORATE_ADMIN',
  organizationId: 'org-1',
  permissions: ['*'],
  supplierId: null,
};

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: 'org-1',
    supplierId: 'sup-1',
    status: InvoiceStatus.PENDING,
    cfdiUuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    rfcEmisor: 'LAN180423QF1',
    rfcReceptor: 'ROY200101AAA',
    subtotal: 1000,
    iva: 160,
    total: 1160,
    date: new Date('2026-06-01T00:00:00.000Z'),
    supplier: { id: 'sup-1', rfc: 'LAN180423QF1', name: 'Logística Andrade' },
    organization: { rfc: 'ROY200101AAA' },
    ...overrides,
  };
}

describe('InvoiceAuditService', () => {
  let service: InvoiceAuditService;
  let prisma: {
    invoice: { findFirst: jest.Mock; count: jest.Mock; aggregate: jest.Mock; update: jest.Mock };
    invoiceAuditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let gemini: { isConfigured: boolean; generateJson: jest.Mock };
  let sat: { verifyCfdi: jest.Mock; check69b: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { total: null },
          _count: { _all: 0 },
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'inv-1', ...data }),
        ),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    gemini = { isConfigured: false, generateJson: jest.fn() };
    sat = {
      verifyCfdi: jest.fn().mockResolvedValue({
        status: 'Vigente',
        verifiedAt: '2026-06-17T00:00:00.000Z',
        mode: 'mock',
      }),
      check69b: jest.fn().mockResolvedValue({
        rfc: 'LAN180423QF1',
        listed: false,
        status: null,
        name: null,
      }),
    };
    const notifications = {
      notifyOrgAdmins: jest.fn().mockResolvedValue(0),
    };
    const whatsapp = {
      notifyOrgAdmins: jest.fn().mockResolvedValue({ recipients: 0, sent: 0 }),
    };
    service = new InvoiceAuditService(
      prisma as unknown as PrismaService,
      gemini as unknown as GeminiService,
      sat as unknown as SatService,
      notifications as unknown as NotificationsService,
      whatsapp as unknown as WhatsappService,
    );
  });

  it('factura limpia → VALIDATED con score 100 y pasa a AUDITED', async () => {
    prisma.invoice.findFirst.mockResolvedValue(buildInvoice());
    const result = await service.audit(user, 'inv-1');

    expect(result.forensicScore).toBe(100);
    expect(result.forensicStatus).toBe(ForensicStatus.VALIDATED);
    expect(result.status).toBe(InvoiceStatus.AUDITED);
    // Sin Gemini configurado, el análisis AI es null pero la auditoría corre.
    expect(result.analysis.ai).toBeNull();
    expect(prisma.invoiceAuditLog.create).toHaveBeenCalled();
  });

  it('RFC emisor distinto al del proveedor → DISCREPANCY', async () => {
    prisma.invoice.findFirst.mockResolvedValue(
      buildInvoice({ rfcEmisor: 'XAX010101000' }),
    );
    const result = await service.audit(user, 'inv-1');

    expect(result.forensicScore).toBe(70);
    expect(result.forensicStatus).toBe(ForensicStatus.DISCREPANCY);
  });

  it('duplicado por proveedor/monto/fecha → BLOCKED', async () => {
    prisma.invoice.findFirst.mockResolvedValue(buildInvoice());
    prisma.invoice.count.mockResolvedValue(1);
    const result = await service.audit(user, 'inv-1');

    expect(result.forensicStatus).toBe(ForensicStatus.BLOCKED);
  });

  it('CFDI cancelado ante el SAT → BLOCKED', async () => {
    prisma.invoice.findFirst.mockResolvedValue(buildInvoice());
    sat.verifyCfdi.mockResolvedValue({
      status: 'Cancelado',
      verifiedAt: '2026-06-17T00:00:00.000Z',
      mode: 'mock',
    });
    const result = await service.audit(user, 'inv-1');

    expect(result.forensicStatus).toBe(ForensicStatus.BLOCKED);
  });

  it('emisor en lista 69-B del SAT → BLOCKED', async () => {
    prisma.invoice.findFirst.mockResolvedValue(buildInvoice());
    sat.check69b.mockResolvedValue({
      rfc: 'LAN180423QF1',
      listed: true,
      status: 'DEFINITIVO',
      name: 'EFOS detectado',
    });
    const result = await service.audit(user, 'inv-1');

    expect(result.forensicStatus).toBe(ForensicStatus.BLOCKED);
  });
});
