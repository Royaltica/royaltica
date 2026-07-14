import { DocumentStatus, InvoiceStatus } from '@prisma/client';
import { SupplierScoringService } from './supplier-scoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('SupplierScoringService', () => {
  let service: SupplierScoringService;
  let prisma: {
    supplierDocument: { findMany: jest.Mock };
    invoice: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      supplierDocument: { findMany: jest.fn() },
      invoice: { findMany: jest.fn() },
    };
    service = new SupplierScoringService(prisma as unknown as PrismaService);
  });

  it('score perfecto: KYC vigente, forense 100, pagos puntuales, 10+ años', async () => {
    prisma.supplierDocument.findMany.mockResolvedValue([
      { status: DocumentStatus.VALIDATED, expiresAt: null },
      {
        status: DocumentStatus.VALIDATED,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    ]);
    prisma.invoice.findMany.mockResolvedValue([
      {
        forensicScore: 100,
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-08'),
      },
    ]);

    const r = await service.compute('sup-1', 12);
    expect(r.score).toBe(100);
    expect(r.components.kyc).toBe(100);
    expect(r.components.forensic).toBe(100);
    expect(r.components.punctuality).toBe(100);
    expect(r.components.seniority).toBe(100);
  });

  it('sin documentos KYC el componente kyc es 0', async () => {
    prisma.supplierDocument.findMany.mockResolvedValue([]);
    prisma.invoice.findMany.mockResolvedValue([]);
    const r = await service.compute('sup-1', 0);
    expect(r.components.kyc).toBe(0);
    // forense y puntualidad neutrales (50) sin datos; seniority 0.
    expect(r.components.forensic).toBe(50);
    expect(r.components.punctuality).toBe(50);
    // 0*.3 + 50*.4 + 50*.2 + 0*.1 = 30
    expect(r.score).toBe(30);
  });

  it('penaliza pagos tardíos en el componente de puntualidad', async () => {
    prisma.supplierDocument.findMany.mockResolvedValue([]);
    prisma.invoice.findMany.mockResolvedValue([
      {
        forensicScore: null,
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-20'), // 10 días tarde
      },
      {
        forensicScore: null,
        status: InvoiceStatus.PAID,
        dueDate: new Date('2026-05-10'),
        paidDate: new Date('2026-05-09'), // a tiempo
      },
    ]);
    const r = await service.compute('sup-1', 0);
    expect(r.components.punctuality).toBe(50); // 1 de 2 a tiempo
  });
});
