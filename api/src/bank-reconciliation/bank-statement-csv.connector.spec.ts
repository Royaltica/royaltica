import { BankStatementCsvConnector } from './bank-statement-csv.connector';
import { PrismaService } from '../common/prisma/prisma.service';
import type { FieldMapping } from '../external-data-sync/field-mapping.types';

const ORG_ID = 'org-1';

describe('BankStatementCsvConnector', () => {
  let txMock: { $executeRaw: jest.Mock };
  let prisma: { withOrg: jest.Mock };

  beforeEach(() => {
    txMock = { $executeRaw: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      withOrg: jest.fn((_org: string, fn: (tx: unknown) => unknown) => fn(txMock)),
    };
  });

  it('parsea un CSV con mapeo de columnas y crea las filas de BankTransaction esperadas', async () => {
    const csv =
      'Fecha,Monto,Concepto,Referencia\n' +
      '2026-07-01,500.00,Wire transfer INV-100,REF-1\n' +
      '2026-07-05,"1,250.50",e-transfer from Acme Inc,REF-2\n';

    const mapping: FieldMapping = {
      transactionDate: 'Fecha',
      amount: 'Monto',
      description: 'Concepto',
      referenceNumber: 'Referencia',
    };

    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mapping,
    );

    const result = await connector.import(ORG_ID, 'RBC');

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toEqual([]);

    // 1 INSERT para BankStatementImport + 2 para BankTransaction.
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(3);

    const txInsertCalls = txMock.$executeRaw.mock.calls.slice(1);
    const firstRowValues = txInsertCalls[0];
    // El tagged template llega como [TemplateStringsArray, ...values]; el
    // monto (500) y la descripción viajan como valores interpolados.
    expect(firstRowValues).toContain(500);
    expect(firstRowValues).toContain('Wire transfer INV-100');
    expect(firstRowValues).toContain('REF-1');

    const secondRowValues = txInsertCalls[1];
    expect(secondRowValues).toContain(1250.5);
  });

  it('salta filas inválidas (fecha o monto no parseable) y reporta el error', async () => {
    const csv =
      'Fecha,Monto,Concepto,Referencia\n' +
      'no-es-fecha,500.00,x,\n' +
      '2026-07-01,no-es-monto,y,\n' +
      '2026-07-02,100.00,z,\n';

    const mapping: FieldMapping = {
      transactionDate: 'Fecha',
      amount: 'Monto',
      description: 'Concepto',
      referenceNumber: 'Referencia',
    };

    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mapping,
    );

    const result = await connector.import(ORG_ID, 'unknown');

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it('normaliza montos con paréntesis (negativos) a valor absoluto', async () => {
    const csv = 'Fecha,Monto,Concepto,Referencia\n2026-07-01,(75.00),refund reversal,\n';
    const mapping: FieldMapping = {
      transactionDate: 'Fecha',
      amount: 'Monto',
      description: 'Concepto',
      referenceNumber: 'Referencia',
    };

    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mapping,
    );

    const result = await connector.import(ORG_ID, 'unknown');
    expect(result.imported).toBe(1);

    const insertCall = txMock.$executeRaw.mock.calls[1];
    expect(insertCall).toContain(75);
  });
});
