import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { FirebaseService } from '../auth/firebase/firebase.service';
import { EmailService } from '../email/email.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Forma pública de un usuario para Configuración > Usuarios. */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  isActive: true,
  status: true,
  lastLoginAt: true,
  avatarUrl: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const TEAM_ROLES: UserRole[] = ['CORPORATE_ADMIN', 'CORPORATE_USER'];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly email: EmailService,
  ) {}

  /** Lista el equipo corporativo de la organización del admin. */
  async list(admin: AuthenticatedUser) {
    const organizationId = this.requireOrg(admin);
    return this.prisma.user.findMany({
      where: { organizationId, role: { in: TEAM_ROLES } },
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invita a un nuevo usuario: crea la cuenta en Firebase (sin contraseña),
   * genera el link para que defina su contraseña, y registra el User en
   * estado INVITED con sus áreas asignadas.
   */
  async invite(admin: AuthenticatedUser, dto: InviteUserDto) {
    const organizationId = this.requireOrg(admin);
    const email = dto.email.toLowerCase();
    const role: UserRole = dto.role ?? 'CORPORATE_USER';

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese email.');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // Áreas: un admin ve todo, así que no guardamos permisos para ese rol.
    const permissions = role === 'CORPORATE_ADMIN' ? [] : dto.permissions ?? [];

    const fbUser = await this.firebase.createOrGetUser(email, dto.name);
    const inviteLink = await this.firebase.generateInviteLink(email);

    const user = await this.prisma.user.create({
      data: {
        firebaseUid: fbUser.uid,
        organizationId,
        email,
        name: dto.name,
        role,
        permissions,
        status: 'INVITED',
        isActive: true,
        invitedById: admin.id,
      },
      select: USER_SELECT,
    });

    this.logger.log(`Usuario invitado: ${email} (rol ${role}).`);

    // Envío del correo de invitación (no bloquea si Resend no está configurado).
    const { sent } = await this.email.sendInvitation(
      email,
      dto.name,
      inviteLink,
      org?.name ?? 'tu organización',
      organizationId,
    );

    // Devolvemos el link igualmente para que el admin pueda compartirlo
    // manualmente (útil en stub mode o si el correo no llegó).
    return { user, inviteLink, emailSent: sent };
  }

  /** Edita nombre, rol y/o áreas de un usuario del mismo org. */
  async update(admin: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const target = await this.findInOrg(admin, id);

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) {
      data.role = dto.role;
      // Si se promueve a admin, las áreas dejan de aplicar.
      if (dto.role === 'CORPORATE_ADMIN') data.permissions = [];
    }
    if (dto.permissions !== undefined && dto.role !== 'CORPORATE_ADMIN') {
      data.permissions = dto.permissions;
    }

    return this.prisma.user.update({
      where: { id: target.id },
      data,
      select: USER_SELECT,
    });
  }

  /** Activa o desactiva el acceso de un usuario (sin borrarlo). */
  async setStatus(admin: AuthenticatedUser, id: string, isActive: boolean) {
    const target = await this.findInOrg(admin, id);

    if (target.id === admin.id) {
      throw new BadRequestException(
        'No puedes desactivar tu propia cuenta.',
      );
    }
    if (!isActive) {
      await this.assertNotLastAdmin(target);
    }

    if (this.firebase.isConfigured) {
      await this.firebase.setUserDisabled(target.firebaseUid, !isActive);
    }

    return this.prisma.user.update({
      where: { id: target.id },
      data: { isActive, status: isActive ? 'ACTIVE' : 'DISABLED' },
      select: USER_SELECT,
    });
  }

  /** Elimina un usuario del equipo (DB + Firebase). */
  async remove(admin: AuthenticatedUser, id: string) {
    const target = await this.findInOrg(admin, id);

    if (target.id === admin.id) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta.');
    }
    await this.assertNotLastAdmin(target);

    if (this.firebase.isConfigured) {
      await this.firebase.deleteUser(target.firebaseUid);
    }
    await this.prisma.user.delete({ where: { id: target.id } });
    return { deleted: true, id: target.id };
  }

  /** Lee la configuración de modo multi-usuario de la organización. */
  async getSettings(admin: AuthenticatedUser) {
    const organizationId = this.requireOrg(admin);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    return { multiUserEnabled: settings.multiUserEnabled === true };
  }

  /** Alterna modo "un solo admin" / "varios usuarios por área". */
  async setMultiUser(admin: AuthenticatedUser, enabled: boolean) {
    const organizationId = this.requireOrg(admin);
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const settings = (org?.settings ?? {}) as Prisma.JsonObject;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: { ...settings, multiUserEnabled: enabled } },
    });
    return { multiUserEnabled: enabled };
  }

  // ── helpers ───────────────────────────────────────────────

  private requireOrg(admin: AuthenticatedUser): string {
    if (!admin.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return admin.organizationId;
  }

  /** Garantiza que el usuario objetivo existe y es del mismo org. */
  private async findInOrg(
    admin: AuthenticatedUser,
    id: string,
  ): Promise<User> {
    const organizationId = this.requireOrg(admin);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.organizationId !== organizationId) {
      throw new NotFoundException('Usuario no encontrado.');
    }
    return user;
  }

  /** Evita dejar a la organización sin ningún administrador activo. */
  private async assertNotLastAdmin(target: User): Promise<void> {
    if (target.role !== 'CORPORATE_ADMIN') return;
    const activeAdmins = await this.prisma.user.count({
      where: {
        organizationId: target.organizationId,
        role: 'CORPORATE_ADMIN',
        isActive: true,
      },
    });
    if (activeAdmins <= 1) {
      throw new BadRequestException(
        'No puedes dejar a la organización sin administradores activos.',
      );
    }
  }
}
