import { BankStatementCsvConnector, bankTransactionDedupeKey } from './bank-statement-csv.connector';
import { PrismaService } from '../common/prisma/prisma.service';
import type { FieldMapping } from '../external-data-sync/field-mapping.types';

const ORG_ID = 'org-1';

describe('BankStatementCsvConnector', () => {
  let txMock: { $executeRaw: jest.Mock };
  let prisma: { withOrg: jest.Mock };

  beforeEach(() => {
    // $executeRaw devuelve cuántas filas afectó: 1 = se insertó.
    txMock = { $executeRaw: jest.fn().mockResolvedValue(1) };
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

    // 1 INSERT para BankStatementImport + 2 para BankTransaction + 1 UPDATE de totales.
    expect(txMock.$executeRaw).toHaveBeenCalledTimes(4);

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

  it('un monto entre paréntesis (negativo) se guarda como CARGO, no como depósito', async () => {
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
    expect(insertCall).toContain(true); // isDebit
    expect(result.debits).toBe(1);
  });

  const mxMapping: FieldMapping = {
    transactionDate: 'Fecha',
    description: 'Concepto',
    referenceNumber: 'Referencia',
    creditAmount: 'Abono',
    debitAmount: 'Cargo',
  };

  it('lee columnas separadas de Abono y Cargo (formato de bancos mexicanos)', async () => {
    const csv =
      'Fecha,Concepto,Referencia,Cargo,Abono\n' +
      '05/11/2026,SPEI RECIBIDO ACME SA,123,,"10,000.00"\n' +
      '06/11/2026,PAGO PROVEEDOR,456,"10,000.00",\n';
    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mxMapping,
    );

    const result = await connector.import(ORG_ID, 'BBVA');

    expect(result).toMatchObject({ imported: 2, debits: 1, duplicates: 0, skipped: 0 });
    const [abono, cargo] = txMock.$executeRaw.mock.calls.slice(1, 3);
    expect(abono).toContain(10000);
    expect(abono).toContain(false);
    expect(cargo).toContain(10000);
    expect(cargo).toContain(true);
    // 05/11/2026 es 5 de noviembre (día/mes/año), no 11 de mayo.
    expect(abono).toContainEqual(new Date(Date.UTC(2026, 10, 5)));
  });

  it('rechaza una fila con abono y cargo a la vez', async () => {
    const csv = 'Fecha,Concepto,Referencia,Cargo,Abono\n05/11/2026,RARO,1,10.00,10.00\n';
    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mxMapping,
    );
    const result = await connector.import(ORG_ID, 'BBVA');
    expect(result.imported).toBe(0);
    expect(result.errors[0]).toContain('abono y cargo');
  });

  it('no duplica movimientos ya importados (mismo estado de cuenta subido otra vez)', async () => {
    const csv =
      'Fecha,Concepto,Referencia,Cargo,Abono\n' +
      '05/11/2026,SPEI RECIBIDO ACME SA,123,,500.00\n' +
      '05/11/2026,SPEI RECIBIDO OTRO,124,,700.00\n';
    // La BD ya tenía el primero: ON CONFLICT DO NOTHING devuelve 0.
    txMock.$executeRaw
      .mockResolvedValueOnce(1) // INSERT del import
      .mockResolvedValueOnce(0) // 1er movimiento: duplicado
      .mockResolvedValueOnce(1) // 2.º movimiento: nuevo
      .mockResolvedValueOnce(1); // UPDATE de totales
    const connector = new BankStatementCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv),
      mxMapping,
    );

    const result = await connector.import(ORG_ID, 'BBVA');

    expect(result).toMatchObject({ imported: 1, duplicates: 1 });
    const sql = (txMock.$executeRaw.mock.calls[1][0] as TemplateStringsArray).join('?');
    expect(sql).toContain('ON CONFLICT ("organizationId", "dedupeKey") DO NOTHING');
  });

  it('dos movimientos idénticos en el mismo archivo tienen huellas distintas y estables', () => {
    const base = {
      organizationId: ORG_ID,
      transactionDate: new Date(Date.UTC(2026, 10, 5)),
      amount: 1000,
      isDebit: false,
      referenceNumber: null,
      description: 'DEPOSITO EFECTIVO',
    };
    const k0 = bankTransactionDedupeKey({ ...base, occurrence: 0 });
    const k1 = bankTransactionDedupeKey({ ...base, occurrence: 1 });
    expect(k0).not.toBe(k1);
    expect(bankTransactionDedupeKey({ ...base, occurrence: 0 })).toBe(k0);
    // Espacios y mayúsculas en el concepto no cambian la huella.
    expect(
      bankTransactionDedupeKey({ ...base, description: '  deposito   efectivo ', occurrence: 0 }),
    ).toBe(k0);
  });
});
