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
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      withOrg: jest.fn((_org: string, fn: (tx: unknown) => unknown) => fn(txMock)),
    };
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
      txMock.$queryRaw
        .mockResolvedValueOnce([
          { id: 'tx-1', bankStatementImportId: 'import-1', organizationId: ORG_ID, matchedInvoiceId: 'inv-1' },
        ])
        .mockResolvedValueOnce([{ matched: 1, unmatched: 0 }]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PENDING' });

      const result = await service.confirmMatch('tx-1', ORG_ID, 'user-1');

      expect(result).toEqual({ ok: true, invoiceId: 'inv-1' });
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
        { id: 'tx-1', bankStatementImportId: 'import-1', organizationId: ORG_ID, matchedInvoiceId: 'inv-1' },
      ]);
      txMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PAID' });

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
