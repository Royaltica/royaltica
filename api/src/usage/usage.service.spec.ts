import { UsageService } from './usage.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { estimateCostMxn } from './usage.pricing';

describe('usage.pricing', () => {
  it('estima el costo de tokens Gemini (entrada + salida) en MXN', () => {
    // 1M entrada ($0.10) + 1M salida ($0.40) = $0.50 USD * 18.5 = 9.25 MXN
    const cost = estimateCostMxn('GEMINI_CHAT', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(9.25, 4);
  });

  it('estima el costo de correos enviados', () => {
    // 10 correos * $0.0004 * 18.5 = 0.074 MXN
    expect(estimateCostMxn('EMAIL_SENT', { units: 10 })).toBeCloseTo(0.074, 4);
  });

  it('features sin costo directo devuelven 0', () => {
    expect(estimateCostMxn('SAT_QUERY', { units: 5 })).toBe(0);
    expect(estimateCostMxn('JOB_RUN', { units: 1 })).toBe(0);
    expect(estimateCostMxn('FACTORAJE_API', { units: 1 })).toBe(0);
  });
});

describe('UsageService', () => {
  let service: UsageService;
  let prisma: { usageEvent: { create: jest.Mock } };

  beforeEach(() => {
    prisma = { usageEvent: { create: jest.fn().mockResolvedValue({}) } };
    service = new UsageService(prisma as unknown as PrismaService);
  });

  it('record persiste el evento con el costo calculado', async () => {
    await service.record({
      organizationId: 'org-1',
      feature: 'GEMINI_CHAT',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const data = prisma.usageEvent.create.mock.calls[0][0].data;
    expect(data.organizationId).toBe('org-1');
    expect(data.feature).toBe('GEMINI_CHAT');
    expect(data.units).toBe(2_000_000); // suma de tokens por defecto
    expect(Number(data.estimatedCostMxn)).toBeCloseTo(9.25, 4);
  });

  it('record NUNCA lanza aunque la escritura falle (fire-and-forget)', async () => {
    prisma.usageEvent.create.mockRejectedValue(new Error('db caída'));
    await expect(
      service.record({ organizationId: 'org-1', feature: 'JOB_RUN' }),
    ).resolves.toBeUndefined();
  });
});
