import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SettingsService, DEFAULT_SETTINGS } from './settings.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    organization: { findUnique: jest.Mock; update: jest.Mock };
    withOrg: jest.Mock;
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn(), update: jest.fn() },
      withOrg: jest.fn((_id: string, fn: (tx: unknown) => unknown) => fn(prisma)),
      $queryRaw: jest.fn(async (_sql: unknown, id: string) => {
        const org = await prisma.organization.findUnique({ where: { id }, select: { settings: true } });
        return org ? [org] : [];
      }),
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  it('devuelve defaults cuando settings está vacío', async () => {
    prisma.organization.findUnique.mockResolvedValue({ settings: {} });
    const result = await service.get('org-1');
    expect(result).toEqual(DEFAULT_SETTINGS);
  });

  it('combina valores guardados con defaults', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: { documentAlertDays: 7, fiscalRegimen: '601' },
    });
    const result = await service.get('org-1');
    expect(result.documentAlertDays).toBe(7);
    expect(result.fiscalRegimen).toBe('601');
    expect(result.costRatio).toBe(DEFAULT_SETTINGS.costRatio);
  });

  it('deriva requiredSignatures del número de autorizadores operativos', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      settings: {
        authorizers: [
          { name: 'Ana', cargo: 'Tesorera', email: 'ana@x.mx' },
          { name: 'Beto', cargo: 'Director', email: 'beto@x.mx' },
        ],
      },
    });
    const result = await service.get('org-1');
    expect(result.requiredSignatures).toBe(2);
    expect(result.authorizers).toHaveLength(2);
  });

  it('0 autorizadores ⇒ requiredSignatures 0 (aprobación automática)', async () => {
    prisma.organization.findUnique.mockResolvedValue({ settings: {} });
    const result = await service.get('org-1');
    expect(result.requiredSignatures).toBe(0);
  });

  it('lanza NotFound si la organización no existe', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.get('org-x')).rejects.toThrow(NotFoundException);
  });

  it('sanitiza el parche: descarta claves desconocidas y acota valores', async () => {
    prisma.organization.findUnique.mockResolvedValue({ settings: {} });
    prisma.organization.update.mockResolvedValue({});

    const result = await service.update('org-1', {
      authorizers: [
        { name: 'Ana', cargo: 'Tesorera', email: 'ana@x.mx' },
        { name: '', cargo: 'sin nombre', email: '' }, // se descarta (sin nombre)
      ],
      costRatio: 5, // se acota a máximo 1
      hacker: 'x', // clave desconocida, se descarta
    } as never);

    expect(result.authorizers).toHaveLength(1); // la entrada sin nombre se filtró
    expect(result.requiredSignatures).toBe(1); // derivado del conteo
    expect(result.costRatio).toBe(1);
    expect(result).not.toHaveProperty('hacker');
    expect(prisma.organization.update).toHaveBeenCalled();
  });

  it('guarda seguridad y reglas, conserva claves ajenas y mantiene la hora del motor', async () => {
    let stored = { product: 'CXC', seatLimits: { agente: 3 }, collectionEngineHour: 14 };
    prisma.organization.findUnique.mockImplementation(async () => ({ settings: stored }));
    prisma.organization.update.mockImplementation(async ({ data }) => { stored = data.settings; return {}; });
    await service.update('org-1', { collectionSecurity: { dosPasos: true }, collectionRules: { descuentoMax: 15, aprueba: 'supervisor' } });
    await service.update('org-1', { collectionSecurity: { inactividad: true }, collectionRules: { parcialidades: true } });
    const restored = await service.get('org-1');
    expect(restored.collectionSecurity).toEqual({ dosPasos: true, inactividad: true });
    expect(restored.collectionRules).toMatchObject({ descuentoMax: 15, aprueba: 'supervisor', parcialidades: true });
    expect(stored).toMatchObject({ product: 'CXC', seatLimits: { agente: 3 }, collectionEngineHour: 14 });
    expect(prisma.withOrg).toHaveBeenCalledWith('org-1', expect.any(Function));
    expect(prisma.$queryRaw.mock.calls[0][0].join('?')).toContain('WHERE "id" = ? FOR UPDATE');
  });

  it('tolera configuración guardada inválida y usa defaults conservadores', async () => {
    prisma.organization.findUnique.mockResolvedValue({ settings: { collectionSecurity: { dosPasos: 'sí' }, collectionRules: { descuentoMax: 99 } } });
    const result = await service.get('org-1');
    expect(result.collectionSecurity).toEqual(DEFAULT_SETTINGS.collectionSecurity);
    expect(result.collectionRules).toEqual(DEFAULT_SETTINGS.collectionRules);
  });

  it.each([
    { collectionSecurity: { dosPasos: 'true' } },
    { collectionSecurity: null },
    { collectionRules: { descuentoMax: 31 } },
    { collectionRules: { descuentoMax: 1.5 } },
    { collectionRules: { aprueba: 'agente' } },
    { collectionRules: { maxSemana: 4 } },
    { collectionRules: { dias: [true] } },
    { collectionRules: { hora: '10:00' } },
  ])('rechaza un parche inválido antes de escribir (%j)', async (patch) => {
    prisma.organization.findUnique.mockResolvedValue({ settings: {} });
    await expect(service.update('org-1', patch as never)).rejects.toThrow(BadRequestException);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('no escribe si no existe la organización', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);
    await expect(service.update('org-x', { collectionRules: { descuentoMax: 10 } })).rejects.toThrow(NotFoundException);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('guarda solo la organización solicitada y propaga el fallo de escritura', async () => {
    prisma.organization.findUnique.mockResolvedValue({ settings: {} });
    prisma.organization.update.mockRejectedValue(new Error('Sin conexión'));
    await expect(service.update('org-2', { collectionRules: { prorroga: true } })).rejects.toThrow('Sin conexión');
    expect(prisma.withOrg).toHaveBeenCalledWith('org-2', expect.any(Function));
    expect(prisma.organization.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org-2' } }));
  });
});
