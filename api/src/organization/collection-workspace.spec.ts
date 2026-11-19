import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { SettingsService, DEFAULT_SETTINGS } from '../settings/settings.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_COLLECTION_WORKSPACE } from '../settings/collection-workspace';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { Env } from '../config/env.validation';

describe('Workspace HTTP de cobranza', () => {
  const user = { id: 'usuario-1', organizationId: 'org-1', permissions: ['cxc'] } as AuthenticatedUser;
  const settings = { get: jest.fn(), update: jest.fn(), getWorkspace: jest.fn(), updateWorkspace: jest.fn() };
  const prisma = { organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1' }), findUniqueOrThrow: jest.fn().mockResolvedValue({}) } };
  const service = new OrganizationService(prisma as unknown as PrismaService, settings as unknown as SettingsService, { record: jest.fn() } as unknown as ActivityLogService, {} as ConfigService<Env, true>);
  const controller = new OrganizationController(service);

  beforeEach(() => {
    settings.get.mockResolvedValue({ ...DEFAULT_SETTINGS, collectionUserState: { otro: { ...DEFAULT_COLLECTION_WORKSPACE, alertas: { privada: { firma: 'Otra persona' } } } } });
    settings.update.mockImplementation(async () => settings.get());
  });

  it('toma organización y usuario de la sesión, sin selector del navegador', async () => {
    await controller.getWorkspace(user);
    await controller.updateWorkspace(user, { revision: 0, reportes: [] });
    expect(settings.getWorkspace).toHaveBeenCalledWith('org-1', 'usuario-1');
    expect(settings.updateWorkspace).toHaveBeenCalledWith('org-1', 'usuario-1', { revision: 0, reportes: [] });
    expect(() => service.getWorkspace({ ...user, organizationId: null })).toThrow(ForbiddenException);
  });

  it('no expone el mapa de usuarios en perfil ni en lecturas o actualizaciones generales', async () => {
    expect((await service.getProfile(user)).settings).not.toHaveProperty('collectionUserState');
    expect(await service.getSettings(user)).not.toHaveProperty('collectionUserState');
    expect(await service.updateSettings(user, {})).not.toHaveProperty('collectionUserState');
  });

  it('permite el workspace a CxC sin dar acceso a la configuración de la organización', () => {
    const guard = new PermissionsGuard(new Reflector());
    const context = (handler: unknown, permissions = ['cxc']) => ({ getHandler: () => handler, getClass: () => OrganizationController, switchToHttp: () => ({ getRequest: () => ({ user: { ...user, permissions } }) }) }) as ExecutionContext;
    expect(guard.canActivate(context(controller.getWorkspace))).toBe(true);
    expect(guard.canActivate(context(controller.updateWorkspace))).toBe(true);
    expect(() => guard.canActivate(context(controller.getSettings))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context(controller.updateWorkspace, ['dashboard']))).toThrow(ForbiddenException);
  });
});
