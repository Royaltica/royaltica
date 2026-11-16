import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  BankReconciliationMatchingService,
  evaluateCandidates,
} from './bank-reconciliation-matching.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { MatchCandidate } from './bank-reconciliation.types';

const ORG_ID = 'org-1';

function makeInvoice(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv-1',
    total: 500,
    folio: 'INV-100',
    status: 'PENDING',
    customer: { name: 'Acme Inc' },
    ...overrides,
  };
}

describe('evaluateCandidates', () => {
  it('sin candidatos → NONE', () => {
    expect(evaluateCandidates([]).outcome).toBe('NONE');
  });

  it('un único candidato de alta confianza → AUTO', () => {
    const candidates: MatchCandidate[] = [
      { invoiceId: 'inv-1', folio: 'INV-100', total: 500, confidence: 0.95, reasons: [] },
    ];
    const result = evaluateCandidates(candidates);
    expect(result.outcome).toBe('AUTO');
    expect(result.best?.invoiceId).toBe('inv-1');
  });

  it('un único candidato de confianza media → LOW_CONFIDENCE (no auto-match)', () => {
    const candidates: MatchCandidate[] = [
      { invoiceId: 'inv-1', folio: null, total: 500, confidence: 0.75, reasons: [] },
    ];
    expect(evaluateCandidates(candidates).outcome).toBe('LOW_CONFIDENCE');
  });

  it('varios candidatos parejos → AMBIGUOUS, no adivina', () => {
    const candidates: MatchCandidate[] = [
      { invoiceId: 'inv-1', folio: null, total: 500, confidence: 0.4, reasons: [] },
      { invoiceId: 'inv-2', folio: null, total: 500, confidence: 0.38, reasons: [] },
    ];
    const result = evaluateCandidates(candidates);
    expect(result.outcome).toBe('AMBIGUOUS');
    expect(result.best).toBeNull();
  });

  it('un candidato claramente por delante → AUTO usando el mejor', () => {
    const candidates: MatchCandidate[] = [
      { invoiceId: 'inv-1', folio: 'INV-100', total: 500, confidence: 0.95, reasons: [] },
      { invoiceId: 'inv-2', folio: null, total: 500, confidence: 0.38, reasons: [] },
    ];
    const result = evaluateCandidates(candidates);
    expect(result.outcome).toBe('AUTO');
    expect(result.best?.invoiceId).toBe('inv-1');
  });
});

describe('BankReconciliationMatchingService', () => {
  let service: BankReconciliationMatchingService;
  let txMock: {
    invoice: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    invoiceAuditLog: { create: jest.Mock };
    invoicePayment: { create: jest.Mock; aggregate: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let prisma: { withOrg: jest.Mock };
  let activity: { record: jest.Mock };
  let notifications: { notifyOrgAdmins: jest.Mock };

  beforeEach(() => {
    txMock = {
      invoice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
      invoicePayment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        // Suma del libro después del pago: por defecto, lo que se acaba de crear.
        aggregate: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma = {
      withOrg: jest.fn((_org: string, fn: (tx: unknown) => unknown) => fn(txMock)),
    };
    let ledgerSum = 0;
    txMock.invoicePayment.create.mockImplementation(async ({ data }) => {
      ledgerSum += Number(data.amount);
      return { id: 'pay-1' };
    });
    txMock.invoicePayment.aggregate.mockImplementation(async () => ({ _sum: { amount: ledgerSum } }));
    activity = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { notifyOrgAdmins: jest.fn().mockResolvedValue(1) };

    service = new BankReconciliationMatchingService(
      prisma as unknown as PrismaService,
      activity as unknown as ActivityLogService,
      notifications as unknown as NotificationsService,
    );
  });

  describe('matchTransaction', () => {
    it('monto exacto + única factura pendiente → un candidato de confianza alta', async () => {
      txMock.invoice.findMany.mockResolvedValue([makeInvoice()]);

      const candidates = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'Wire transfer', referenceNumber: null },
        ORG_ID,
      );

      expect(candidates).toHaveLength(1);
      expect(candidates[0].invoiceId).toBe('inv-1');
      expect(candidates[0].confidence).toBeGreaterThanOrEqual(0.7);
      expect(candidates[0].reasons[0]).toMatch(/única factura/);
    });

    it('monto exacto compartido por varias facturas → varios candidatos de baja confianza cada uno', async () => {
      txMock.invoice.findMany.mockResolvedValue([
        makeInvoice({ id: 'inv-1', folio: 'INV-100' }),
        makeInvoice({ id: 'inv-2', folio: 'INV-200', customer: { name: 'Otra Empresa' } }),
      ]);

      const candidates = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'e-transfer received', referenceNumber: null },
        ORG_ID,
      );

      expect(candidates).toHaveLength(2);
      expect(evaluateCandidates(candidates).outcome).toBe('AMBIGUOUS');
    });

    it('el folio en la descripción sube la confianza por encima del monto solo', async () => {
      txMock.invoice.findMany.mockResolvedValue([makeInvoice({ id: 'inv-1', folio: 'INV-100' })]);

      const withoutFolio = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'Wire transfer', referenceNumber: null },
        ORG_ID,
      );
      const withFolio = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'Payment ref INV-100', referenceNumber: null },
        ORG_ID,
      );

      expect(withFolio[0].confidence).toBeGreaterThan(withoutFolio[0].confidence);
      expect(withFolio[0].reasons.some((r) => r.includes('INV-100'))).toBe(true);
      expect(evaluateCandidates(withFolio).outcome).toBe('AUTO');
    });

    it('el folio desempata entre facturas que comparten el mismo monto', async () => {
      txMock.invoice.findMany.mockResolvedValue([
        makeInvoice({ id: 'inv-1', folio: 'INV-100' }),
        makeInvoice({ id: 'inv-2', folio: 'INV-200', customer: { name: 'Otra Empresa' } }),
      ]);

      const candidates = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'Payment ref INV-100', referenceNumber: null },
        ORG_ID,
      );

      const evaluation = evaluateCandidates(candidates);
      expect(evaluation.outcome).not.toBe('AMBIGUOUS');
      expect(evaluation.best?.invoiceId ?? candidates[0].invoiceId).toBe('inv-1');
    });

    it('sin ninguna factura con ese monto → sin candidatos', async () => {
      txMock.invoice.findMany.mockResolvedValue([makeInvoice({ total: 999 })]);
      const candidates = await service.matchTransaction(
        { amount: 500 as unknown as never, description: 'x', referenceNumber: null },
        ORG_ID,
      );
      expect(candidates).toEqual([]);
    });
  });

  describe('runAutoMatch', () => {
    it('marca AUTO_MATCHED y notifica cuando hay un único candidato de alta confianza', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            bankStatementImportId: 'import-1',
            organizationId: ORG_ID,
            amount: 500,
            description: 'Wire transfer ref INV-100',
            referenceNumber: null,
            matchStatus: 'UNMATCHED',
          },
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findMany.mockResolvedValue([makeInvoice()]);

      const result = await service.runAutoMatch('import-1', ORG_ID);

      expect(result.autoMatched).toBe(1);
      expect(result.ambiguous).toBe(0);
      expect(notifications.notifyOrgAdmins).toHaveBeenCalledTimes(1);
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_TX_AUTO_MATCHED' }),
      );
    });

    it('marca AMBIGUOUS y NO auto-matchea cuando hay varios candidatos parejos', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            bankStatementImportId: 'import-1',
            organizationId: ORG_ID,
            amount: 500,
            description: 'e-transfer',
            referenceNumber: null,
            matchStatus: 'UNMATCHED',
          },
        ])
        .mockResolvedValueOnce([{ matched: 0, unmatched: 1 }]);
      txMock.invoice.findMany.mockResolvedValue([
        makeInvoice({ id: 'inv-1', folio: 'INV-100' }),
        makeInvoice({ id: 'inv-2', folio: 'INV-200', customer: { name: 'Otra Empresa' } }),
      ]);

      const result = await service.runAutoMatch('import-1', ORG_ID);

      expect(result.autoMatched).toBe(0);
      expect(result.ambiguous).toBe(1);
      expect(notifications.notifyOrgAdmins).not.toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_TX_AMBIGUOUS' }),
      );
    });
  });

  describe('confirmMatch', () => {
    it('marca la factura PAID y audita, cuando la transacción tiene un match propuesto', async () => {
      const depositDate = new Date('2026-11-05T00:00:00Z');
      txMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'tx-1',
            bankStatementImportId: 'import-1',
            organizationId: ORG_ID,
            matchedInvoiceId: 'inv-1',
            amount: 500,
            transactionDate: depositDate,
            isDebit: false,
            matchStatus: 'AUTO_MATCHED',
          },
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PENDING', total: 500, amountPaid: 0 });

      const result = await service.confirmMatch('tx-1', ORG_ID, 'user-1');

      expect(result).toMatchObject({ ok: true, invoiceId: 'inv-1', settled: ['inv-1'], partial: [] });
      // Queda en el libro de pagos, con la fecha del depósito.
      expect(txMock.invoicePayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          source: 'BANK',
          bankTransactionId: 'tx-1',
          paidAt: depositDate,
        }),
      });
      expect(txMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' }, data: expect.objectContaining({ status: 'PAID' }) }),
      );
      expect(txMock.invoiceAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceId: 'inv-1', newStatus: 'PAID' }),
        }),
      );
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_TX_MATCH_CONFIRMED' }),
      );
    });

    it('rechaza si la factura ya no está PENDING', async () => {
      txMock.$queryRaw.mockResolvedValueOnce([
        {
          id: 'tx-1',
          bankStatementImportId: 'import-1',
          organizationId: ORG_ID,
          matchedInvoiceId: 'inv-1',
          amount: 500,
          isDebit: false,
        },
      ]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PAID', total: 500 });

      await expect(service.confirmMatch('tx-1', ORG_ID, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('404 si la transacción no existe', async () => {
      txMock.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.confirmMatch('tx-none', ORG_ID, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmMatch con propuestas compuestas', () => {
    const txRow = (over: Record<string, unknown>) => ({
      id: 'tx-9',
      bankStatementImportId: 'import-1',
      organizationId: ORG_ID,
      matchedInvoiceId: null,
      amount: 1500,
      transactionDate: new Date('2026-11-05T00:00:00Z'),
      isDebit: false,
      matchStatus: 'AMBIGUOUS',
      ...over,
    });

    it('MULTI: liquida cada factura de la combinación por su saldo', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          txRow({
            matchProposal: { kind: 'MULTI', invoiceIds: ['inv-a', 'inv-b'], explanation: 'suma exacta' },
          }),
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      const invoices: Record<string, unknown> = {
        'inv-a': { id: 'inv-a', status: 'PENDING', total: 1000, amountPaid: 0 },
        'inv-b': { id: 'inv-b', status: 'PENDING', total: 500, amountPaid: 0 },
      };
      txMock.invoice.findFirst.mockImplementation(async ({ where }) => invoices[where.id]);
      // El libro suma por factura: devolvemos lo de la última creada.
      txMock.invoicePayment.aggregate.mockImplementation(async ({ where }) => ({
        _sum: { amount: where.invoiceId === 'inv-a' ? 1000 : 500 },
      }));

      const result = await service.confirmMatch('tx-9', ORG_ID, 'user-1');

      expect(result.settled).toEqual(['inv-a', 'inv-b']);
      const amounts = txMock.invoicePayment.create.mock.calls.map((c) => Number(c[0].data.amount));
      expect(amounts).toEqual([1000, 500]);
    });

    it('RETENTION: da por liquidada la factura aunque el depósito llegue neto', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          txRow({
            amount: 1060,
            matchProposal: {
              kind: 'RETENTION',
              invoiceIds: ['inv-r'],
              retentionRate: 0.1,
              explanation: 'retención de ISR',
            },
          }),
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findFirst.mockResolvedValue({
        id: 'inv-r',
        status: 'PENDING',
        total: 1160,
        subtotal: 1000,
        amountPaid: 0,
      });
      txMock.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 1060 } });

      const result = await service.confirmMatch('tx-9', ORG_ID, 'user-1');

      expect(result.settled).toEqual(['inv-r']);
      expect(txMock.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }),
      );
    });

    it('PARTIAL: registra el abono y la factura sigue pendiente', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          txRow({
            amount: 400,
            matchProposal: { kind: 'PARTIAL', invoiceIds: ['inv-p'], explanation: 'parcial' },
          }),
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-p', status: 'PENDING', total: 1000, amountPaid: 0 });
      txMock.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 400 } });

      const result = await service.confirmMatch('tx-9', ORG_ID, 'user-1');

      expect(result.partial).toEqual(['inv-p']);
      expect(result.settled).toEqual([]);
      const update = txMock.invoice.update.mock.calls[0][0];
      expect(update.data.status).toBeUndefined();
      expect(Number(update.data.amountPaid)).toBe(400);
    });

    it('nunca aplica más que el saldo de la factura', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([txRow({ amount: 2000 })])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PENDING', total: 1200, amountPaid: 200 });
      txMock.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 1200 } });

      await service.confirmMatch('tx-9', ORG_ID, 'user-1', 'inv-1');

      expect(Number(txMock.invoicePayment.create.mock.calls[0][0].data.amount)).toBe(1000);
    });

    it('si otra persona ya lo concilió (confirmación simultánea), no registra el pago dos veces', async () => {
      txMock.$queryRaw.mockResolvedValueOnce([txRow({ matchedInvoiceId: 'inv-1' })]);
      txMock.$executeRaw.mockResolvedValueOnce(0); // el UPDATE condicional no tomó la fila
      await expect(service.confirmMatch('tx-9', ORG_ID, 'user-1')).rejects.toThrow('ya se concilió');
      expect(txMock.invoicePayment.create).not.toHaveBeenCalled();
    });

    it('rechaza conciliar un cargo (retiro)', async () => {
      txMock.$queryRaw.mockResolvedValueOnce([txRow({ isDebit: true, matchedInvoiceId: 'inv-1' })]);
      await expect(service.confirmMatch('tx-9', ORG_ID, 'user-1')).rejects.toThrow(
        'Un cargo (retiro)',
      );
    });

    it('sin propuesta aplicable pide indicar la factura', async () => {
      txMock.$queryRaw.mockResolvedValueOnce([
        txRow({ matchProposal: { kind: 'MULTI_AMBIGUOUS', invoiceIds: ['a', 'b'], explanation: 'x' } }),
      ]);
      await expect(service.confirmMatch('tx-9', ORG_ID, 'user-1')).rejects.toThrow('indica invoiceId');
    });
  });

  describe('runAutoMatch con propuestas', () => {
    const depositRow = (over: Record<string, unknown>) => ({
      id: 'tx-5',
      bankStatementImportId: 'import-1',
      organizationId: ORG_ID,
      amount: 1500,
      description: 'SPEI RECIBIDO DISTRIBUIDORA PEREZ',
      referenceNumber: null,
      matchStatus: 'UNMATCHED',
      ...over,
    });

    it('sin coincidencia exacta propone varias facturas del mismo cliente (queda AMBIGUOUS)', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([depositRow({})])
        .mockResolvedValueOnce([{ matched: 0, unmatched: 1 }]);
      const perez = { name: 'Distribuidora Pérez', rfc: 'DPE010101AA1' };
      txMock.invoice.findMany.mockResolvedValue([
        makeInvoice({ id: 'i1', total: 1000, subtotal: 862.07, amountPaid: 0, customerId: 'c1', customer: perez }),
        makeInvoice({ id: 'i2', total: 500, subtotal: 431.03, amountPaid: 0, customerId: 'c1', customer: perez }),
        makeInvoice({ id: 'i3', total: 9999, subtotal: 8619.83, amountPaid: 0, customerId: 'c2', customer: { name: 'Otra' } }),
      ]);

      const result = await service.runAutoMatch('import-1', ORG_ID);

      expect(result.ambiguous).toBe(1);
      const update = txMock.$executeRaw.mock.calls.find((c) =>
        (c[0] as TemplateStringsArray).join('?').includes('"matchProposal"'),
      )!;
      expect(update).toContain('AMBIGUOUS');
      const proposal = JSON.parse(update.find((v: unknown) => typeof v === 'string' && v.startsWith('{')));
      expect(proposal).toMatchObject({ kind: 'MULTI', invoiceIds: ['i1', 'i2'] });
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_TX_PROPOSAL' }),
      );
    });

    it('un solo candidato sin evidencia queda como sugerencia (UNMATCHED) para frenar envíos', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([depositRow({ amount: 500, description: 'DEPOSITO' })])
        .mockResolvedValueOnce([{ matched: 0, unmatched: 1 }]);
      txMock.invoice.findMany.mockResolvedValue([makeInvoice({ folio: null, customer: { name: 'Zeta' } })]);

      await service.runAutoMatch('import-1', ORG_ID);

      const update = txMock.$executeRaw.mock.calls.find((c) =>
        (c[0] as TemplateStringsArray).join('?').includes('"matchProposal"'),
      )!;
      expect(update).toContain('UNMATCHED');
      const proposal = JSON.parse(update.find((v: unknown) => typeof v === 'string' && v.startsWith('{')));
      expect(proposal).toMatchObject({ kind: 'SUGGESTED', invoiceIds: ['inv-1'] });
    });
  });

  describe('rejectMatch', () => {
    it('resetea la transacción a UNMATCHED y audita', async () => {
      txMock.$queryRaw
        .mockResolvedValueOnce([
          { id: 'tx-1', bankStatementImportId: 'import-1', organizationId: ORG_ID, matchedInvoiceId: 'inv-1' },
        ])
        .mockResolvedValueOnce([{ matched: 0, unmatched: 1 }]);

      const result = await service.rejectMatch('tx-1', ORG_ID, 'user-1');

      expect(result).toEqual({ ok: true });
      expect(txMock.$executeRaw).toHaveBeenCalled();
      expect(activity.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'BANK_TX_MATCH_REJECTED' }),
      );
    });
  });
});
