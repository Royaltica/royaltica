import { NotFoundException } from '@nestjs/common';
import { SettingsService, DEFAULT_SETTINGS } from './settings.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    organization: { findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn(), update: jest.fn() },
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
});
