import { CallGuardrailsService } from './call-guardrails.service';

const org = 'org-1';

const baseCustomer = {
  id: 'cust-1',
  organizationId: org,
  name: 'Cliente de Prueba',
  phone: '+5215512345678',
  doNotContact: false,
  deletedAt: null,
};

const basePolicy = {
  id: 'pol-1',
  organizationId: org,
  isActive: true,
  // Ventana amplia por default en los tests; cada caso la angosta si hace falta.
  allowedContactStartHour: 0,
  allowedContactEndHour: 24,
  timezone: 'America/Mexico_City',
  blackoutDates: [] as Date[],
  maxContactsPerWeek: 3,
  deletedAt: null,
};

describe('CallGuardrailsService', () => {
  let service: CallGuardrailsService;
  let prisma: {
    customer: { findFirst: jest.Mock; update: jest.Mock };
    collectionPolicy: { findFirst: jest.Mock };
    activityLog: { count: jest.Mock };
    withOrg: jest.Mock;
  };
  let activity: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn(), update: jest.fn() },
      collectionPolicy: { findFirst: jest.fn() },
      activityLog: { count: jest.fn().mockResolvedValue(0) },
      withOrg: jest.fn((_orgId: string, fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    service = new CallGuardrailsService(
      prisma as unknown as never,
      activity as unknown as never,
    );
  });

  describe('evaluateCallAttempt', () => {
    it('bloquea si el cliente no existe', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res).toEqual({ allowed: false, reason: 'customer-not-found' });
    });

    it('bloquea si el cliente tiene doNotContact=true (opt-out)', async () => {
      prisma.customer.findFirst.mockResolvedValue({ ...baseCustomer, doNotContact: true });
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res).toEqual({ allowed: false, reason: 'customer-do-not-contact' });
    });

    it('bloquea si el cliente no tiene teléfono', async () => {
      prisma.customer.findFirst.mockResolvedValue({ ...baseCustomer, phone: null });
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res).toEqual({ allowed: false, reason: 'no-phone' });
    });

    it('bloquea si no hay política activa', async () => {
      prisma.customer.findFirst.mockResolvedValue(baseCustomer);
      prisma.collectionPolicy.findFirst.mockResolvedValue(null);
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res).toEqual({ allowed: false, reason: 'no-active-policy' });
    });

    it('bloquea fuera de la ventana horaria permitida', async () => {
      prisma.customer.findFirst.mockResolvedValue(baseCustomer);
      prisma.collectionPolicy.findFirst.mockResolvedValue({
        ...basePolicy,
        allowedContactStartHour: 9,
        allowedContactEndHour: 10,
      });
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('outside-contact-window');
    });

    it('bloquea si ya se alcanzó el máximo de contactos por semana', async () => {
      prisma.customer.findFirst.mockResolvedValue(baseCustomer);
      prisma.collectionPolicy.findFirst.mockResolvedValue(basePolicy);
      prisma.activityLog.count.mockResolvedValue(3);
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res).toEqual({ allowed: false, reason: 'max-contacts-per-week' });
    });

    it('permite la llamada y devuelve el guion de apertura cuando todo está en regla', async () => {
      prisma.customer.findFirst.mockResolvedValue(baseCustomer);
      prisma.collectionPolicy.findFirst.mockResolvedValue(basePolicy);
      prisma.activityLog.count.mockResolvedValue(0);
      const res = await service.evaluateCallAttempt(org, 'cust-1', 'pol-1');
      expect(res.allowed).toBe(true);
      expect(res.disclosureScript).toContain('asistente automatizado');
      expect(res.recordingConsentLine).toContain('grabada');
    });
  });

  describe('screenAgentText', () => {
    it('marca como inseguro un texto que pide datos de tarjeta', () => {
      const res = service.screenAgentText('¿Me puede dar el número de tarjeta y el CVV?');
      expect(res.safe).toBe(false);
      expect(res.flaggedPhrases.length).toBeGreaterThan(0);
    });

    it('marca como inseguro un texto con amenaza legal falsa', () => {
      const res = service.screenAgentText('Si no paga hoy lo vamos a demandar mañana mismo.');
      expect(res.safe).toBe(false);
    });

    it('marca como seguro un texto normal de cobranza', () => {
      const res = service.screenAgentText(
        'Le recuerdo que tiene una factura vencida, ¿podemos agendar el pago?',
      );
      expect(res.safe).toBe(true);
      expect(res.flaggedPhrases).toEqual([]);
    });
  });

  describe('shouldEscalateFromDebtorText', () => {
    it('detecta cuando el deudor pide hablar con una persona', () => {
      expect(service.shouldEscalateFromDebtorText('quiero hablar con una persona')).toBe(true);
    });

    it('detecta cuando el deudor pide no ser contactado', () => {
      expect(service.shouldEscalateFromDebtorText('ya no me llamen por favor')).toBe(true);
    });

    it('no escala en una respuesta normal', () => {
      expect(service.shouldEscalateFromDebtorText('sí, puedo pagar la próxima semana')).toBe(
        false,
      );
    });
  });

  describe('setDoNotContact', () => {
    it('actualiza al cliente y registra la actividad', async () => {
      prisma.customer.update.mockResolvedValue({ ...baseCustomer, doNotContact: true });

      await service.setDoNotContact(org, 'cust-1', 'Pidió no ser contactado', 'user-1');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cust-1' },
          data: expect.objectContaining({
            doNotContact: true,
            doNotContactReason: 'Pidió no ser contactado',
          }),
        }),
      );
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: org,
          userId: 'user-1',
          action: 'CUSTOMER_DO_NOT_CONTACT_SET',
          entityId: 'cust-1',
        }),
      );
    });
  });
});
