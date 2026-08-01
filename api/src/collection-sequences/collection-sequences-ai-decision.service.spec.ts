import { CollectionSequencesAiDecisionService } from './collection-sequences-ai-decision.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { DashboardService } from '../dashboard/dashboard.service';

const baseContext = {
  organizationId: 'org-1',
  customerId: 'cust-1',
  customerName: 'Cliente Uno',
  daysOverdue: 20,
  amount: 5000,
  currency: 'CAD',
  step: {
    stepOrder: 2,
    channel: 'EMAIL' as const,
    tone: 'STANDARD' as const,
    escalatesToHuman: false,
  },
  policy: {
    maxContactsPerWeek: 3,
    allowedContactStartHour: 9,
    allowedContactEndHour: 17,
    timezone: 'America/Toronto',
    escalationThresholdDays: 30,
  },
};

describe('CollectionSequencesAiDecisionService', () => {
  let service: CollectionSequencesAiDecisionService;
  let prisma: {
    invoice: { aggregate: jest.Mock };
    customer: { findUnique: jest.Mock };
  };
  let gemini: { isConfigured: boolean; generateFunctionCall: jest.Mock };
  let dashboard: { getCustomerRanking: jest.Mock; getAtRiskCustomers: jest.Mock };

  beforeEach(() => {
    prisma = {
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 10000 } }),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({ createdAt: new Date('2020-01-01T00:00:00Z') }),
      },
    };
    gemini = {
      isConfigured: true,
      generateFunctionCall: jest.fn(),
    };
    dashboard = {
      getCustomerRanking: jest.fn().mockResolvedValue({ customers: [] }),
      getAtRiskCustomers: jest.fn().mockResolvedValue({ customers: [] }),
    };

    service = new CollectionSequencesAiDecisionService(
      prisma as unknown as PrismaService,
      gemini as unknown as GeminiService,
      dashboard as unknown as DashboardService,
    );
  });

  it('Gemini no configurado: cae al respaldo determinista (paso configurado)', async () => {
    gemini.isConfigured = false;

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.aiDriven).toBe(false);
    expect(decision.action).toBe('SEND');
    expect(decision.channel).toBe('EMAIL');
    expect(decision.tone).toBe('STANDARD');
    expect(gemini.generateFunctionCall).not.toHaveBeenCalled();
  });

  it('Gemini configurado pero escalatesToHuman=true en el paso: el respaldo determinista escala', async () => {
    gemini.isConfigured = false;

    const decision = await service.decideNextAction('inv-1', {
      ...baseContext,
      step: { ...baseContext.step, escalatesToHuman: true },
    });

    expect(decision.action).toBe('ESCALATE');
    expect(decision.aiDriven).toBe(false);
  });

  it('Gemini lanza error: cae al respaldo determinista sin propagar la excepción', async () => {
    gemini.generateFunctionCall.mockRejectedValue(new Error('timeout'));

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.aiDriven).toBe(false);
    expect(decision.action).toBe('SEND');
    expect(decision.channel).toBe('EMAIL');
  });

  it('Gemini devuelve HOLD: se respeta la decisión de la IA', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'HOLD',
      reasoning: 'Cliente de alto valor con historial impecable; primer atraso menor.',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.action).toBe('HOLD');
    expect(decision.aiDriven).toBe(true);
    expect(decision.reasoning).toContain('alto valor');
    expect(decision.channel).toBeUndefined();
  });

  it('Gemini devuelve ESCALATE: se respeta la decisión de la IA', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'ESCALATE',
      reasoning: 'Monto alto y deterioro claro del historial de pago.',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.action).toBe('ESCALATE');
    expect(decision.aiDriven).toBe(true);
  });

  it('Gemini devuelve SEND con canal sugerido: se usa el canal/tono de la IA', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'SEND',
      channel: 'WHATSAPP',
      tone: 'FIRM',
      reasoning: 'El cliente no responde correos; WhatsApp funciona mejor con él.',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.action).toBe('SEND');
    expect(decision.channel).toBe('WHATSAPP');
    expect(decision.tone).toBe('FIRM');
    expect(decision.aiDriven).toBe(true);
  });

  it('Gemini devuelve SEND sin canal/tono: usa los valores por defecto del paso', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'SEND',
      reasoning: 'Sin señales de riesgo a la relación; continúa con el paso normal.',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.action).toBe('SEND');
    expect(decision.channel).toBe('EMAIL');
    expect(decision.tone).toBe('STANDARD');
  });

  it('respuesta malformada (acción inválida): cae al respaldo determinista sin lanzar', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'DELETE_EVERYTHING',
      reasoning: 'texto libre inesperado',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.aiDriven).toBe(false);
    expect(decision.action).toBe('SEND');
  });

  it('respuesta null (función no invocada por el modelo): cae al respaldo determinista', async () => {
    gemini.generateFunctionCall.mockResolvedValue(null);

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.aiDriven).toBe(false);
  });

  it('canal/tono inválidos en la respuesta: se ignoran y se usan los del paso', async () => {
    gemini.generateFunctionCall.mockResolvedValue({
      action: 'SEND',
      channel: 'CARRIER_PIGEON',
      tone: 'ANGRY',
      reasoning: 'valores fuera de catálogo',
    });

    const decision = await service.decideNextAction('inv-1', baseContext);

    expect(decision.channel).toBe('EMAIL');
    expect(decision.tone).toBe('STANDARD');
  });
});
