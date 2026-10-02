import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateVirtualNumberDto } from './dto/create-virtual-number.dto';
import { UpdateVirtualNumberDto } from './dto/update-virtual-number.dto';

/**
 * FR-08 (spec "Mejoras V1"): administración del pool de números virtuales
 * propios de Royáltica por organización. WhatsappService.sendForOrg rota
 * sobre los números activos al despachar cobranza (ver ReceivablesService);
 * este CRUD es lo que el perfil Administrador/Data usa para darlos de alta
 * ("configuración de seguridad" / infraestructura, matriz de perfiles del
 * spec sección 2).
 */
@Injectable()
export class VirtualNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateVirtualNumberDto) {
    const organizationId = this.requireOrg(user);
    return this.prisma.withOrg(organizationId, (tx) =>
      tx.virtualNumber.create({
        data: {
          organizationId,
          phoneId: dto.phoneId,
          label: dto.label,
          isActive: dto.isActive ?? true,
        },
      }),
    );
  }

  async findAll(user: AuthenticatedUser) {
    const organizationId = this.requireOrg(user);
    return this.prisma.withOrg(organizationId, (tx) =>
      tx.virtualNumber.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateVirtualNumberDto) {
    const organizationId = this.requireOrg(user);
    return this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      return tx.virtualNumber.update({ where: { id }, data: dto });
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const organizationId = this.requireOrg(user);
    await this.prisma.withOrg(organizationId, async (tx) => {
      await this.ensureExists(tx, organizationId, id);
      await tx.virtualNumber.delete({ where: { id } });
    });
    return { deleted: true, id };
  }

  private async ensureExists(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<void> {
    const found = await tx.virtualNumber.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Número virtual no encontrado.');
  }

  private requireOrg(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      throw new ForbiddenException('Tu cuenta no pertenece a una organización.');
    }
    return user.organizationId;
  }
}
