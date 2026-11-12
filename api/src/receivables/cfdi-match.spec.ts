import { BadRequestException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { empatarCliente, normalizarNombre, parecido, rfcValido } from './cfdi-match';
import { ReceivablesService } from './receivables.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const CLIENTES = [
  { id: 'c1', name: 'Distribuidora del Norte', legalName: 'Distribuidora del Norte S.A. de C.V.', rfc: 'DNO010101AB1' },
  { id: 'c2', name: 'Materiales Peninsulares', legalName: 'Materiales Peninsulares SA de CV', rfc: 'XAXX010101000' },
  { id: 'c3', name: 'Grupo Ferretero Bajío', legalName: 'Grupo Ferretero del Bajío, S.A.P.I. de C.V.', rfc: 'GFB990101ZZ9' },
];

describe('cfdi-match', () => {
  it('normaliza acentos, puntuación y sufijos societarios', () => {
    expect(normalizarNombre('Grupo Ferretero del Bajío, S.A.P.I. de C.V.')).toBe('grupo ferretero bajio');
    expect(normalizarNombre('Materiales Peninsulares SA de CV')).toBe('materiales peninsulares');
  });

  it('distingue RFC reales de los genéricos del SAT', () => {
    expect(rfcValido('DNO010101AB1')).toBe(true);
    expect(rfcValido('XAXX010101000')).toBe(false);
    expect(rfcValido('')).toBe(false);
  });

  it('empata primero por RFC', () => {
    const m = empatarCliente('DNO010101AB1', 'Otro nombre', CLIENTES);
    expect(m.tipo).toBe('rfc');
    expect(m.cliente?.id).toBe('c1');
  });

  it('con RFC genérico o desconocido empata por nombre normalizado', () => {
    const m = empatarCliente('MPE200202CC3', 'MATERIALES PENINSULARES, S.A. DE C.V.', CLIENTES);
    expect(m.tipo).toBe('nombre');
    expect(m.cliente?.id).toBe('c2');
  });

  it('sin empate claro sugiere los más parecidos sin asignar', () => {
    const m = empatarCliente('ZZZ010101ZZ1', 'Ferretero Bajío Industrial', CLIENTES);
    expect(m.tipo).toBe('sin_match');
    expect(m.sugerencias[0]?.cliente.id).toBe('c3');
    expect(parecido('Ferretero Bajío Industrial', 'Grupo Ferretero del Bajío')).toBeGreaterThan(0.34);
  });

  it('dos clientes con el mismo RFC quedan a revisión', () => {
    const m = empatarCliente('DNO010101AB1', null, [...CLIENTES, { ...CLIENTES[0], id: 'c9' }]);
    expect(m.tipo).toBe('sin_match');
    expect(m.sugerencias).toHaveLength(2);
  });
});

// ── Carga con revisión (servicio) ──────────────────────────────────────

const user = { id: 'u-1', organizationId: 'org-1', role: 'CORPORATE_ADMIN', permissions: ['*'] } as unknown as AuthenticatedUser;

const cfdi = (uuid: string, rfc: string, nombre: string, total = 116) =>
  Buffer.from(
    `<?xml version="1.0"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Total="${total}" SubTotal="100" Moneda="MXN" Fecha="2026-10-01T10:00:00" Folio="F-${uuid.slice(0, 3)}" MetodoPago="PPD">` +
      `<cfdi:Emisor Rfc="RDE240101AA1" Nombre="Royaltica Demo"/><cfdi:Receptor Rfc="${rfc}" Nombre="${nombre}"/>` +
      `<cfdi:Complemento><tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" UUID="${uuid}"/></cfdi:Complemento></cfdi:Comprobante>`,
  );

describe('ReceivablesService · carga de CFDI con revisión', () => {
  let prisma: Record<string, any>;
  let service: ReceivablesService;

  beforeEach(() => {
    prisma = {
      customer: {
        findMany: jest.fn().mockResolvedValue(CLIENTES.map((c) => ({ ...c, creditLimitDays: 15 }))),
        findFirst: jest.fn(({ where }) => {
          const c = CLIENTES.find((x) => x.id === where.id || x.rfc === where.rfc);
          return Promise.resolve(c ? { id: c.id, creditLimitDays: 15 } : null);
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => Promise.resolve({ id: `inv-${data.cfdiUuid}`, status: 'PENDING', ...data })),
      },
      invoiceAuditLog: { create: jest.fn() },
      withOrg: jest.fn((_org: string, fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    const nada = {} as never;
    service = new ReceivablesService(prisma as unknown as PrismaService, nada, nada, nada, nada, nada);
  });

  it('lee XML sueltos y dentro de ZIP, y clasifica el empate de cada uno', async () => {
    const zip = new AdmZip();
    zip.addFile('octubre/b.xml', cfdi('BBBBBBBB-0000-0000-0000-000000000002', 'MPE200202CC3', 'Materiales Peninsulares SA de CV'));
    zip.addFile('__MACOSX/._b.xml', Buffer.from('basura'));
    const r = await service.previewBulkCfdi(user, [
      { originalname: 'a.xml', buffer: cfdi('AAAAAAAA-0000-0000-0000-000000000001', 'DNO010101AB1', 'Distribuidora') },
      { originalname: 'facturas.zip', buffer: zip.toBuffer() },
      { originalname: 'c.xml', buffer: cfdi('CCCCCCCC-0000-0000-0000-000000000003', 'ZZZ010101ZZ1', 'Ferretero Bajío Industrial') },
      { originalname: 'roto.xml', buffer: Buffer.from('<hola/>') },
    ]);
    expect(r.total).toBe(4);
    expect(r.resumen).toEqual({ porRfc: 1, porNombre: 1, sinMatch: 1, duplicadas: 0, errores: 1 });
    const porNombre = r.filas.find((f) => f.estado === 'por_nombre');
    expect(porNombre).toMatchObject({ archivo: 'b.xml', actualizaRfc: true });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('marca como duplicada una factura que ya existe', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { cfdiUuid: 'AAAAAAAA-0000-0000-0000-000000000001', organizationId: 'org-1', customer: { name: 'Distribuidora del Norte' } },
    ]);
    const r = await service.previewBulkCfdi(user, [
      { originalname: 'a.xml', buffer: cfdi('AAAAAAAA-0000-0000-0000-000000000001', 'DNO010101AB1', 'Distribuidora') },
    ]);
    expect(r.filas[0]).toMatchObject({ estado: 'duplicada', motivo: 'Ya está registrada en Distribuidora del Norte.' });
  });

  it('al confirmar respeta las asignaciones, omite las marcadas y completa el RFC del cliente', async () => {
    const r = await service.confirmBulkCfdi(
      user,
      [
        { originalname: 'b.xml', buffer: cfdi('BBBBBBBB-0000-0000-0000-000000000002', 'MPE200202CC3', 'Materiales Peninsulares SA de CV') },
        { originalname: 'c.xml', buffer: cfdi('CCCCCCCC-0000-0000-0000-000000000003', 'ZZZ010101ZZ1', 'Ferretero Bajío Industrial') },
        { originalname: 'd.xml', buffer: cfdi('DDDDDDDD-0000-0000-0000-000000000004', 'ZZZ010101ZZ1', 'Nadie') },
      ],
      JSON.stringify({
        'CCCCCCCC-0000-0000-0000-000000000003': 'c3',
        'DDDDDDDD-0000-0000-0000-000000000004': null,
      }),
    );
    expect(r).toMatchObject({ total: 3, creadas: 2, rfcActualizados: 1 });
    expect(r.omitidas).toEqual([{ archivo: 'd.xml', motivo: 'La omitiste en la revisión.' }]);
    // El de Materiales (RFC genérico) se queda con el del CFDI; Ferretero ya tenía uno real.
    expect(prisma.customer.update).toHaveBeenCalledWith({ where: { id: 'c2' }, data: { rfc: 'MPE200202CC3' } });
    // Vencimiento = emisión + días de crédito del cliente (15).
    const creada = prisma.invoice.create.mock.calls[0][0].data;
    expect(creada.dueDate.toISOString().slice(0, 10)).toBe('2026-10-16');
  });

  it('pide al menos un archivo', async () => {
    await expect(service.previewBulkCfdi(user, [])).rejects.toBeInstanceOf(BadRequestException);
  });
});
