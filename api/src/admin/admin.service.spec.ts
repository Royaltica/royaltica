// firebase-admin arrastra ESM que jest no transpila; lo mockeamos porque
// AdminService importa FirebaseService (que importa firebase-admin).
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => []),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

import { ConflictException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseService } from '../auth/firebase/firebase.service';
import { EmailService } from '../email/email.service';
import { UsageService } from '../usage/usage.service';

describe('AdminService.createOrganization', () => {
  let service: AdminService;
  let prisma: {
    organization: { findUnique: jest.Mock; create: jest.Mock };
    user: { findUnique: jest.Mock };
    activityLog: { create: jest.Mock };
  };
  let firebase: { isConfigured: boolean; createOrGetUser: jest.Mock; generateInviteLink: jest.Mock };
  let email: { sendInvitation: jest.Mock };
  let usage: { record: jest.Mock };

  const dto = {
    name: 'ACME',
    rfc: 'aaa010101aaa',
    legalName: 'ACME SA de CV',
    adminEmail: 'Admin@ACME.com',
    adminName: 'Admin',
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'ACME',
          rfc: 'AAA010101AAA',
          legalName: 'ACME SA de CV',
          plan: 'FREE',
          isActive: true,
          createdAt: new Date(),
          users: [{ id: 'u-1', email: 'admin@acme.com', name: 'Admin', role: 'CORPORATE_ADMIN' }],
        }),
      },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      activityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    firebase = {
      isConfigured: false,
      createOrGetUser: jest.fn(),
      generateInviteLink: jest.fn(),
    };
    email = { sendInvitation: jest.fn().mockResolvedValue({ sent: false }) };
    usage = { record: jest.fn() };
    service = new AdminService(
      prisma as unknown as PrismaService,
      firebase as unknown as FirebaseService,
      email as unknown as EmailService,
      usage as unknown as UsageService,
    );
  });

  it('crea org + primer admin; en modo stub usa firebaseUid temporal y sin link', async () => {
    const r = await service.createOrganization(dto);
    expect(r.organization.id).toBe('org-1');
    expect(r.admin.role).toBe('CORPORATE_ADMIN');
    expect(r.inviteLink).toBeNull();
    expect(r.firebaseConfigured).toBe(false);

    // RFC y email se normalizan (mayúsculas / minúsculas)
    const createData = prisma.organization.create.mock.calls[0][0].data;
    expect(createData.rfc).toBe('AAA010101AAA');
    expect(createData.users.create.email).toBe('admin@acme.com');
    expect(createData.users.create.role).toBe('CORPORATE_ADMIN');
    // Firebase NO se llama en modo stub
    expect(firebase.createOrGetUser).not.toHaveBeenCalled();
  });

  it('rechaza RFC duplicado', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'existente' });
    await expect(service.createOrganization(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.organization.create).not.toHaveBeenCalled();
  });

  it('rechaza email de admin ya existente', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-existente' });
    await expect(service.createOrganization(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('con Firebase configurado crea cuenta y genera link de invitación', async () => {
    firebase.isConfigured = true;
    firebase.createOrGetUser.mockResolvedValue({ uid: 'fb-123' });
    firebase.generateInviteLink.mockResolvedValue('https://invite.link/abc');
    email.sendInvitation.mockResolvedValue({ sent: true });

    const r = await service.createOrganization(dto);
    expect(firebase.createOrGetUser).toHaveBeenCalledWith('admin@acme.com', 'Admin');
    expect(r.inviteLink).toBe('https://invite.link/abc');
    expect(r.emailSent).toBe(true);
    // el correo de invitación se etiqueta con la organización (cost tracking)
    expect(email.sendInvitation).toHaveBeenCalledWith(
      'admin@acme.com',
      'Admin',
      'https://invite.link/abc',
      'ACME',
      'org-1',
    );
  });
});
