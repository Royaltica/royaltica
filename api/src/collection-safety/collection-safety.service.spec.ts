import { CollectionSafetyService } from './collection-safety.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

const NOW = new Date('2026-11-16T17:00:00Z');
const HOUR = 3_600_000;

describe('CollectionSafetyService', () => {
  let prisma: {
    organization: { findUnique: jest.Mock };
    invoiceAuditLog: { findFirst: jest.Mock };
    bankStatementImport: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let redis: { set: jest.Mock; get: jest.Mock; del: jest.Mock };
  let service: CollectionSafetyService;

  const base = () => ({
    organizationId: 'org-1',
    invoiceId: 'inv-1',
    customer: { id: 'c-1', doNotContact: false, paymentClaimedAt: null as Date | null },
    invoicePaymentClaimedAt: null as Date | null,
    paymentDataMaxAgeHours: null as number | null,
    now: NOW,
  });

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ collectionPausedAt: null }) },
      invoiceAuditLog: { findFirst: jest.fn().mockResolvedValue(null) },
      bankStatementImport: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new CollectionSafetyService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
    );
  });

  it('deja pasar cuando no hay ninguna señal de pago', async () => {
    await expect(service.checkBeforeSend(base())).resolves.toEqual({ ok: true });
  });

  it('bloquea si la organización tiene el interruptor de emergencia encendido', async () => {
    prisma.organization.findUnique.mockResolvedValue({ collectionPausedAt: NOW });
    await expect(service.checkBeforeSend(base())).resolves.toMatchObject({
      ok: false,
      reason: 'collection-paused',
    });
  });

  it('bloquea si el cliente pidió la baja', async () => {
    const input = base();
    input.customer.doNotContact = true;
    await expect(service.checkBeforeSend(input)).resolves.toMatchObject({
      reason: 'customer-do-not-contact',
    });
  });

  it('bloquea 72 h después de un "ya pagué" del cliente y libera después', async () => {
    const recent = base();
    recent.customer.paymentClaimedAt = new Date(NOW.getTime() - 71 * HOUR);
    await expect(service.checkBeforeSend(recent)).resolves.toMatchObject({
      reason: 'payment-claimed',
    });

    const old = base();
    old.customer.paymentClaimedAt = new Date(NOW.getTime() - 73 * HOUR);
    await expect(service.checkBeforeSend(old)).resolves.toEqual({ ok: true });
  });

  it('también bloquea por un "ya pagué" sobre la factura (portal)', async () => {
    const input = base();
    input.invoicePaymentClaimedAt = new Date(NOW.getTime() - 2 * HOUR);
    await expect(service.checkBeforeSend(input)).resolves.toMatchObject({
      reason: 'payment-claimed',
    });
  });

  it('bloquea si el cobro se revirtió hace menos de 24 h', async () => {
    prisma.invoiceAuditLog.findFirst.mockResolvedValue({
      createdAt: new Date(NOW.getTime() - HOUR),
    });
    await expect(service.checkBeforeSend(base())).resolves.toMatchObject({
      reason: 'recently-reverted',
    });
    expect(prisma.invoiceAuditLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ previousStatus: 'PAID', newStatus: 'PENDING' }),
      }),
    );
  });

  it('bloquea si hay un depósito sin revisar que podría ser de esta factura', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'tx-1' }]);
    await expect(service.checkBeforeSend(base())).resolves.toEqual({
      ok: false,
      reason: 'payment-pending-review',
      detail: { bankTransactionId: 'tx-1' },
    });
  });

  it('la guardia de frescura solo aplica si la política la pide', async () => {
    // Apagada (null): no consulta los estados de cuenta.
    await service.checkBeforeSend(base());
    expect(prisma.bankStatementImport.findFirst).not.toHaveBeenCalled();

    // Encendida y sin ningún estado de cuenta: bloquea.
    const input = { ...base(), paymentDataMaxAgeHours: 36 };
    await expect(service.checkBeforeSend(input)).resolves.toMatchObject({
      reason: 'stale-payment-data',
    });

    // Estado de cuenta de hace 40 h: bloquea; de hace 10 h: pasa.
    prisma.bankStatementImport.findFirst.mockResolvedValue({
      importedAt: new Date(NOW.getTime() - 40 * HOUR),
    });
    await expect(service.checkBeforeSend(input)).resolves.toMatchObject({
      reason: 'stale-payment-data',
    });
    prisma.bankStatementImport.findFirst.mockResolvedValue({
      importedAt: new Date(NOW.getTime() - 10 * HOUR),
    });
    await expect(service.checkBeforeSend(input)).resolves.toEqual({ ok: true });
  });

  describe('withOrganizationLock', () => {
    it('ejecuta y libera el candado si lo obtiene', async () => {
      redis.get.mockImplementation(async () => redis.set.mock.calls[0][1]);
      const fn = jest.fn().mockResolvedValue('hecho');
      await expect(service.withOrganizationLock('org-1', fn)).resolves.toBe('hecho');
      expect(redis.set).toHaveBeenCalledWith(
        'lock:collection:org-1',
        expect.any(String),
        'PX',
        expect.any(Number),
        'NX',
      );
      expect(redis.del).toHaveBeenCalledWith('lock:collection:org-1');
    });

    it('no ejecuta si otro proceso tiene el candado', async () => {
      redis.set.mockResolvedValue(null);
      const fn = jest.fn();
      await expect(service.withOrganizationLock('org-1', fn)).resolves.toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('falla cerrada si Redis no responde (no ejecuta)', async () => {
      redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
      const fn = jest.fn();
      await expect(service.withOrganizationLock('org-1', fn)).resolves.toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });

    it('no borra un candado que ya no es suyo', async () => {
      redis.get.mockResolvedValue('otro-token');
      await service.withOrganizationLock('org-1', async () => 1);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
