// firebase-admin arrastra dependencias ESM que jest no transpila;
// lo mockeamos porque AuthService solo lo usa de forma inyectada.
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseService } from './firebase/firebase.service';
import type { Env } from '../config/env.validation';

const baseUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    firebaseUid: 'fb-uid-1',
    organizationId: 'org-1',
    role: 'CORPORATE_USER',
    email: 'analista@royaltica.com',
    name: 'Analista',
    avatarUrl: null,
    isActive: true,
    status: 'ACTIVE',
    permissions: ['finanzas', 'pagos'],
    invitedById: null,
    lastLoginAt: null,
    supplierId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock; verifyAsync: jest.Mock };
  let firebase: { verifyIdToken: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt'), verifyAsync: jest.fn() };
    firebase = { verifyIdToken: jest.fn() };
    const config = { get: jest.fn().mockReturnValue('8h') };
    const notifications = { create: jest.fn() };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      firebase as unknown as FirebaseService,
      config as unknown as ConfigService<Env, true>,
      notifications as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      // EmailService mock: send() nunca lanza, siempre reporta sent:false.
      { send: jest.fn().mockResolvedValue({ sent: false }) } as never,
    );
  });

  describe('verifyToken', () => {
    it('emite JWT para un usuario conocido y registra el login', async () => {
      firebase.verifyIdToken.mockResolvedValue({
        uid: 'fb-uid-1',
        email: 'analista@royaltica.com',
      });
      prisma.user.findUnique.mockResolvedValue(baseUser());
      prisma.user.update.mockResolvedValue(baseUser({ lastLoginAt: new Date() }));

      const result = await service.verifyToken('id-token');

      expect(result.accessToken).toBe('signed.jwt');
      expect(result.user.permissions).toEqual(['finanzas', 'pagos']);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('vincula una invitación pendiente por email en el primer ingreso', async () => {
      firebase.verifyIdToken.mockResolvedValue({
        uid: 'new-fb-uid',
        email: 'analista@royaltica.com',
      });
      // No existe por firebaseUid, sí por email (invitado).
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseUser({ status: 'INVITED' }));
      prisma.user.update
        .mockResolvedValueOnce(baseUser({ firebaseUid: 'new-fb-uid' }))
        .mockResolvedValueOnce(baseUser({ firebaseUid: 'new-fb-uid' }));

      const result = await service.verifyToken('id-token');
      expect(result.accessToken).toBe('signed.jwt');
    });

    it('rechaza un email no registrado', async () => {
      firebase.verifyIdToken.mockResolvedValue({
        uid: 'unknown',
        email: 'desconocido@x.com',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyToken('id-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rechaza a un usuario desactivado', async () => {
      firebase.verifyIdToken.mockResolvedValue({
        uid: 'fb-uid-1',
        email: 'analista@royaltica.com',
      });
      prisma.user.findUnique.mockResolvedValue(
        baseUser({ isActive: false, status: 'DISABLED' }),
      );

      await expect(service.verifyToken('id-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('entrega wildcard de permisos a un admin', async () => {
      firebase.verifyIdToken.mockResolvedValue({
        uid: 'fb-uid-1',
        email: 'director@royaltica.com',
      });
      const admin = baseUser({ role: 'CORPORATE_ADMIN', permissions: [] });
      prisma.user.findUnique.mockResolvedValue(admin);
      prisma.user.update.mockResolvedValue(admin);

      const result = await service.verifyToken('id-token');
      expect(result.user.permissions).toEqual(['*']);
    });
  });
});
