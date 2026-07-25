import { Injectable, NotFoundException } from '@nestjs/common';
import type { LeadStatus, LeadType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Servicio admin para operar la tabla `Lead` desde el panel SUPERADMIN.
 * Los métodos públicos son idempotentes y devuelven 404 si el lead
 * no existe (para que la UI reaccione bien).
 */
@Injectable()
export class LeadsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    type?: LeadType;
    status?: LeadStatus;
    search?: string;
    limit: number;
    skip: number;
  }) {
    const where: Prisma.LeadWhereInput = {
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { company: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
        skip: params.skip,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: rows,
      total,
      limit: params.limit,
      skip: params.skip,
    };
  }

  /**
   * Cuenta leads por status × type. Útil para métricas en el dashboard.
   * Devuelve un objeto simple: { total, byStatus: {...}, byType: {...} }.
   */
  async summary() {
    const [total, byStatus, byType] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.lead.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(
        byStatus.map((r) => [r.status, r._count._all]),
      ),
      byType: Object.fromEntries(
        byType.map((r) => [r.type, r._count._all]),
      ),
    };
  }

  async get(id: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException(`Lead ${id} no encontrado.`);
    return lead;
  }

  async updateStatus(
    id: string,
    status: LeadStatus,
    handledByUserId: string,
    note?: string,
  ) {
    await this.get(id); // 404 si no existe
    // Si viene nota, la anexamos al message existente con timestamp.
    let messagePatch: string | undefined;
    if (note && note.trim()) {
      const existing = await this.prisma.lead.findUnique({
        where: { id },
        select: { message: true },
      });
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const append = `[${stamp}] ${note.trim()}`;
      messagePatch = existing?.message
        ? `${existing.message}\n\n${append}`
        : append;
    }

    return this.prisma.lead.update({
      where: { id },
      data: {
        status,
        handledByUserId,
        ...(messagePatch !== undefined ? { message: messagePatch } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.get(id); // 404 si no existe
    await this.prisma.lead.delete({ where: { id } });
    return { deleted: true, id };
  }
}
