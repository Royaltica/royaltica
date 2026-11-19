import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { SettingsService } from './settings.service';
import { DEFAULT_COLLECTION_COMPANY as COMPANY, DEFAULT_COLLECTION_NOTIFICATIONS as NOTIFICATIONS, DEFAULT_COLLECTION_WORKSPACE as EMPTY, collectionWorkspaceSchema } from './collection-workspace';

describe('Persistencia de cobranza en Organization.settings', () => {
  let db: Record<string, unknown>;
  let prisma: { withOrg: jest.Mock; $queryRaw: jest.Mock; organization: { findUnique: jest.Mock; update: jest.Mock } };
  let service: SettingsService;
  beforeEach(() => {
    db = { uno: { product: 'CXC', seatLimits: { agente: 3 }, collectionEngineHour: 12 }, dos: {} };
    prisma = {
      withOrg: jest.fn((_org, fn) => fn(prisma)),
      $queryRaw: jest.fn(async (_sql, id) => id in db ? [{ settings: db[id] }] : []),
      organization: {
        findUnique: jest.fn(async ({ where }) => where.id in db ? { settings: db[where.id] } : null),
        update: jest.fn(async ({ where, data }) => { db[where.id] = data.settings; return {}; }),
      },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  it('guarda empresa y destinatarios; una instancia nueva los recupera sin tocar otras claves ni organizaciones', async () => {
    const company = { ...COMPANY, empresa: 'Empresa de prueba', banco: 'Banco de prueba', clabe: '000000000000000000', correo: 'prueba@empresa.invalid', liga: 'https://empresa.invalid/pago' };
    const notifications = { ...NOTIFICATIONS, noMolestar: false, resumenHora: '18:00', destinatarios: [{ id: 'd-1', nombre: 'Persona de prueba', puesto: '', telefono: '+000000000000', nivel: 'altas' as const, modo: 'resumen' as const, activo: true, verificado: false as const }] };
    await service.update('uno', { collectionCompany: company });
    await service.update('uno', { collectionNotifications: notifications });
    const restored = await new SettingsService(prisma as unknown as PrismaService).get('uno');
    expect(restored.collectionCompany).toEqual(company);
    expect(restored.collectionNotifications).toEqual(notifications);
    expect(db.uno).toMatchObject({ product: 'CXC', seatLimits: { agente: 3 }, collectionEngineHour: 12 });
    expect(db.dos).toEqual({});
    expect(prisma.withOrg).toHaveBeenCalledWith('uno', expect.any(Function));
  });

  it('recupera reportes, alertas y borradores, y los aísla por usuario y organización', async () => {
    const workspace = { ...EMPTY, revision: 0, alertas: { saldo: { firma: 'Saldo|Cliente de prueba', hasta: '2026-11-20' } }, reportes: [{ nombre: 'Reporte de prueba', filtros: { agente: 'Todos', linea: 'Todas', resultado: 'Todos', desde: '2026-11-18', hasta: '2026-11-18', horaDesde: '00:00', horaHasta: '23:59', soloNoGestionadas: false } }], segmentos: { c1: { segmento: 'nuevo' as const, motivo: 'Revisión de prueba' } }, tiposDeudor: { activos: ['tipo-prueba'], asignaciones: { c1: 'tipo-prueba' }, archivo: 'prueba.csv', fecha: '2026-11-18T16:00:00Z' }, campanas: [{ id: 'campana-1', nombre: 'Borrador de prueba', estado: 'Borrador' as const, enviados: 0 as const, config: { ocasion: 'contacto' as const, plantilla: 'S1', oferta: { tipo: 'ninguna' as const, valor: 0 }, inicio: '2026-11-18', fin: '2026-11-18', canal: 'WhatsApp' as const, clientes: ['c1'] } }] };
    await service.updateWorkspace('uno', 'usuario-1', workspace);
    expect(await service.getWorkspace('uno', 'usuario-1')).toEqual({ ...workspace, revision: 1 });
    expect(await service.getWorkspace('uno', 'usuario-2')).toEqual(EMPTY);
    expect(await service.getWorkspace('dos', 'usuario-1')).toEqual(EMPTY);
    await service.updateWorkspace('uno', 'usuario-2', { revision: 0, alertas: { propia: { firma: 'Otra alerta' } } });
    await service.update('uno', { collectionCompany: { ...COMPANY, empresa: 'Nueva empresa' } });
    expect(await service.getWorkspace('uno', 'usuario-1')).toEqual({ ...workspace, revision: 1 });
    expect((await service.getWorkspace('uno', 'usuario-2')).alertas).toEqual({ propia: { firma: 'Otra alerta' } });
    expect(prisma.$queryRaw.mock.calls[0][0].join('?')).toContain('WHERE "id" = ? FOR UPDATE');
  });

  it('rechaza una revisión vieja sin pisar cambios ni escribir otra vez', async () => {
    await service.updateWorkspace('uno', 'usuario', { revision: 0, alertas: { a: { firma: 'Primera' } } });
    const writes = prisma.organization.update.mock.calls.length;
    await expect(service.updateWorkspace('uno', 'usuario', { revision: 0, reportes: [] })).rejects.toThrow(ConflictException);
    expect(prisma.organization.update).toHaveBeenCalledTimes(writes);
    expect((await service.getWorkspace('uno', 'usuario')).alertas).toEqual({ a: { firma: 'Primera' } });
  });

  it.each([
    { collectionCompany: { ...COMPANY, clabe: '123' } },
    { collectionCompany: { ...COMPANY, liga: 'javascript:alert(1)' } },
    { collectionCompany: { ...COMPANY, correo: 'sin-correo' } },
    { collectionNotifications: { ...NOTIFICATIONS, resumenHora: '25:00' } },
    { collectionNotifications: { ...NOTIFICATIONS, noMolestar: 'sí' } },
    { collectionNotifications: { ...NOTIFICATIONS, destinatarios: [{ id: 'd', nombre: 'Prueba', puesto: '', telefono: '+000000000000', nivel: 'todas', modo: 'resumen', activo: true, verificado: true }] } },
  ])('rechaza configuración inválida sin escribir (%j)', async (patch) => {
    await expect(service.update('uno', patch as never)).rejects.toThrow(BadRequestException);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it.each([
    {}, { revision: -1 }, { revision: 0, userId: 'otro' }, { revision: 0, reportes: 'texto' },
    { revision: 0, alertas: { a: { firma: 'Prueba', hasta: 'mañana' } } },
    { revision: 0, segmentos: { c: { segmento: 'inventado', motivo: '' } } },
    { revision: 0, campanas: [{ estado: 'Activa', enviados: 1 }] },
  ])('rechaza trabajo inválido o intento de elegir otro usuario (%j)', async (patch) => {
    await expect(service.updateWorkspace('uno', 'usuario', patch)).rejects.toThrow(BadRequestException);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('usa defaults con JSON inválido y no comparte referencias mutables entre lecturas', async () => {
    db.uno = { collectionCompany: { clabe: 'mal' }, collectionNotifications: [], collectionUserState: { usuario: { revision: 'mal' } } };
    const settings = await service.get('uno');
    expect(settings.collectionCompany).toEqual(COMPANY);
    expect(settings.collectionNotifications).toEqual(NOTIFICATIONS);
    const state = await service.getWorkspace('uno', 'usuario'); state.alertas.a = { firma: 'Local' };
    expect(await service.getWorkspace('uno', 'usuario')).toEqual(EMPTY);
    expect(collectionWorkspaceSchema.safeParse({ ...EMPTY, reportes: new Array(51).fill({}) }).success).toBe(false);
  });

  it('propaga errores de escritura y rechaza organizaciones inexistentes', async () => {
    await expect(service.updateWorkspace('inexistente', 'usuario', { revision: 0 })).rejects.toThrow(NotFoundException);
    prisma.organization.update.mockRejectedValue(new Error('Escritura fallida'));
    await expect(service.updateWorkspace('uno', 'usuario', { revision: 0, alertas: {} })).rejects.toThrow('Escritura fallida');
    expect(await service.getWorkspace('uno', 'usuario')).toEqual(EMPTY);
  });
});
