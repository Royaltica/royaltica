import { applyPayment, outstandingOf, reverseInvoicePayments } from './payment-ledger';

describe('payment-ledger', () => {
  let tx: {
    invoice: { findFirst: jest.Mock; update: jest.Mock };
    invoicePayment: { create: jest.Mock; aggregate: jest.Mock; updateMany: jest.Mock };
    invoiceAuditLog: { create: jest.Mock };
  };

  beforeEach(() => {
    tx = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'PENDING', total: 1000 }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoicePayment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        aggregate: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      invoiceAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
  });

  const input = {
    organizationId: 'org-1',
    invoiceId: 'inv-1',
    paidAt: new Date('2026-11-05'),
    source: 'BANK' as const,
  };

  it('outstandingOf resta los pagos vigentes y nunca baja de cero', () => {
    expect(outstandingOf({ total: 1000, amountPaid: 250 })).toBe(750);
    expect(outstandingOf({ total: 1000, amountPaid: 1200 })).toBe(0);
    expect(outstandingOf({ total: 1000 })).toBe(1000);
  });

  it('un pago parcial suma al saldo pagado y deja la factura PENDING', async () => {
    tx.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 400 } });
    const r = await applyPayment(tx as never, { ...input, amount: 400 });
    expect(r).toMatchObject({ settled: false, amountPaid: 400, outstanding: 600 });
    const data = tx.invoice.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();
    expect(Number(data.amountPaid)).toBe(400);
    expect(tx.invoiceAuditLog.create.mock.calls[0][0].data.action).toBe('PARTIAL_PAYMENT');
  });

  it('cuando los pagos cubren el total, la factura pasa a PAID con la fecha del pago', async () => {
    tx.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    const r = await applyPayment(tx as never, { ...input, amount: 600 });
    expect(r.settled).toBe(true);
    expect(tx.invoice.update.mock.calls[0][0].data).toMatchObject({
      status: 'PAID',
      paidDate: input.paidAt,
    });
    expect(tx.invoiceAuditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'STATUS_CHANGE',
      previousStatus: 'PENDING',
      newStatus: 'PAID',
    });
  });

  it('con settle (retención) la da por pagada y deja la diferencia en la bitácora', async () => {
    tx.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 900 } });
    const r = await applyPayment(tx as never, { ...input, amount: 900, settle: true });
    expect(r.settled).toBe(true);
    expect(tx.invoiceAuditLog.create.mock.calls[0][0].data.metadata).toMatchObject({
      settledWithDifference: 100,
    });
  });

  it('rechaza montos no positivos y facturas que ya no están pendientes', async () => {
    await expect(applyPayment(tx as never, { ...input, amount: 0 })).rejects.toThrow(
      'mayor a cero',
    );
    tx.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'PAID', total: 1000 });
    await expect(applyPayment(tx as never, { ...input, amount: 10 })).rejects.toThrow(
      'ya no está pendiente',
    );
    expect(tx.invoicePayment.create).not.toHaveBeenCalled();
  });

  it('reverseInvoicePayments marca los pagos como revertidos y deja el saldo pagado en 0', async () => {
    const n = await reverseInvoicePayments(tx as never, 'inv-1', 'u-1', 'depósito rebotado');
    expect(n).toBe(2);
    expect(tx.invoicePayment.updateMany).toHaveBeenCalledWith({
      where: { invoiceId: 'inv-1', reversedAt: null },
      data: {
        reversedAt: expect.any(Date),
        reversedReason: 'depósito rebotado',
        reversedByUserId: 'u-1',
      },
    });
    expect(Number(tx.invoice.update.mock.calls[0][0].data.amountPaid)).toBe(0);
  });
});
