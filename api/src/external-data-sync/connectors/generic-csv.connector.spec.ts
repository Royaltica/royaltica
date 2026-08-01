import { GenericCsvConnector } from './generic-csv.connector';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IDENTITY_MAPPING } from '../field-mapping.types';

describe('GenericCsvConnector', () => {
  let prisma: {
    customer: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    invoice: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    organization: { findUnique: jest.Mock };
    withOrg: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      customer: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      invoice: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      organization: {
        findUnique: jest.fn().mockResolvedValue({ rfc: 'RDE240101AA1' }),
      },
      withOrg: jest.fn(),
    };
    prisma.withOrg.mockImplementation((_orgId: string, fn: (tx: unknown) => unknown) =>
      fn(prisma),
    );
  });

  const buildConnector = (csv: string) =>
    new GenericCsvConnector(
      prisma as unknown as PrismaService,
      Buffer.from(csv, 'utf8'),
      IDENTITY_MAPPING.CUSTOMER,
      IDENTITY_MAPPING.RECEIVABLE,
    );

  describe('isConfigured', () => {
    it('false sin archivo (stub)', async () => {
      const connector = new GenericCsvConnector(
        prisma as unknown as PrismaService,
        undefined,
        IDENTITY_MAPPING.CUSTOMER,
        IDENTITY_MAPPING.RECEIVABLE,
      );
      expect(connector.isConfigured).toBe(false);
      const result = await connector.syncCustomers('org-1');
      expect(result.mode).toBe('stub');
      expect(result.imported).toBe(0);
    });
  });

  describe('syncCustomers', () => {
    it('importa filas válidas aplicando el mapeo', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const csv =
        'externalId,name,legalName,rfc,email,phone,category\n' +
        'CUST-1,Acme Co,Acme Corporation,,ops@acme.ca,+15145551234,retail\n';

      const connector = buildConnector(csv);
      const result = await connector.syncCustomers('org-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
      const created = prisma.customer.create.mock.calls[0][0].data;
      expect(created.organizationId).toBe('org-1');
      expect(created.externalId).toBe('CUST-1');
      expect(created.name).toBe('Acme Co');
      // Sin RFC en el CSV (cliente canadiense): se genera uno sintético válido.
      expect(created.rfc).toMatch(/^[A-Z]{3,4}\d{6}[A-Z0-9]{3}$/);
    });

    it('salta filas con campos requeridos faltantes sin abortar el resto', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const csv =
        'externalId,name,legalName,rfc,email,phone,category\n' +
        ',Sin ID,,,ops@acme.ca,,\n' + // falta externalId
        'CUST-2,,,,,,\n' + // falta name y contacto
        'CUST-3,Beta Inc,,,beta@x.ca,,\n'; // válida

      const connector = buildConnector(csv);
      const result = await connector.syncCustomers('org-1');

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toMatch(/Fila 2/);
      expect(result.errors[1]).toMatch(/Fila 3/);
    });

    it('reimportar el mismo externalId actualiza en vez de duplicar', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-db-1' });
      const csv =
        'externalId,name,legalName,rfc,email,phone,category\n' +
        'CUST-1,Acme Co Updated,,,ops@acme.ca,,\n';

      const connector = buildConnector(csv);
      const result = await connector.syncCustomers('org-1');

      expect(result.imported).toBe(1);
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-db-1' },
        data: expect.objectContaining({ name: 'Acme Co Updated' }),
      });
    });
  });

  describe('syncReceivables', () => {
    it('importa una factura válida ligada a un cliente ya existente', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-db-1', rfc: 'XAX000000AAA' });
      prisma.invoice.findFirst.mockResolvedValue(null);
      const csv =
        'externalId,customerExternalId,folio,total,subtotal,iva,currency,date,dueDate,description\n' +
        'INV-1,CUST-1,F-001,1000,900,100,CAD,2026-08-01,2026-09-01,Servicios agosto\n';

      const connector = buildConnector(csv);
      const result = await connector.syncReceivables('org-1');

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
      const created = prisma.invoice.create.mock.calls[0][0].data;
      expect(created.direction).toBe('RECEIVABLE');
      expect(created.externalId).toBe('INV-1');
      expect(created.total).toBe(1000);
      expect(created.cfdiUuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('salta la fila si el cliente externo no existe todavía', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      const csv =
        'externalId,customerExternalId,folio,total,subtotal,iva,currency,date,dueDate,description\n' +
        'INV-1,CUST-DESCONOCIDO,F-001,1000,900,100,CAD,2026-08-01,2026-09-01,X\n';

      const connector = buildConnector(csv);
      const result = await connector.syncReceivables('org-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toMatch(/no encontrado/);
    });

    it('salta filas con monto o fecha inválidos', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-db-1', rfc: 'XAX000000AAA' });
      const csv =
        'externalId,customerExternalId,folio,total,subtotal,iva,currency,date,dueDate,description\n' +
        'INV-1,CUST-1,F-001,no-es-numero,900,100,CAD,2026-08-01,2026-09-01,X\n';

      const connector = buildConnector(csv);
      const result = await connector.syncReceivables('org-1');

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
