import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma, AlertType, AlertPriority, GeofenceType } from '@prisma/client';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query?: { page?: number; limit?: number; includeInactive?: boolean; search?: string },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const searchTerm = query?.search?.trim();

    // Busca com unaccent — usa raw SQL p/ IDs, Prisma p/ hydrate
    if (searchTerm) {
      return this.findAllWithSearch(tenantId, searchTerm, page, limit, query?.includeInactive);
    }

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(query?.includeInactive ? {} : { isActive: true }),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { geofences: true },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async findAllWithSearch(
    tenantId: string,
    search: string,
    page: number,
    limit: number,
    includeInactive?: boolean,
  ) {
    const pattern = `%${search}%`;
    const skip = (page - 1) * limit;
    const activeFilter = includeInactive
      ? Prisma.empty
      : Prisma.sql`AND "isActive" = true`;

    const [matchedIds, countResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM clients
        WHERE "tenantId" = ${tenantId}::uuid
          AND "deletedAt" IS NULL
          ${activeFilter}
          AND (
            unaccent("name") ILIKE unaccent(${pattern})
            OR unaccent(COALESCE("tradeName",'')) ILIKE unaccent(${pattern})
            OR "cnpj" ILIKE ${pattern}
          )
        ORDER BY "name" ASC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS "count" FROM clients
        WHERE "tenantId" = ${tenantId}::uuid
          AND "deletedAt" IS NULL
          ${activeFilter}
          AND (
            unaccent("name") ILIKE unaccent(${pattern})
            OR unaccent(COALESCE("tradeName",'')) ILIKE unaccent(${pattern})
            OR "cnpj" ILIKE ${pattern}
          )
      `,
    ]);

    const total = Number(countResult[0].count);
    if (matchedIds.length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const ids = matchedIds.map((r) => r.id);
    const items = await this.prisma.client.findMany({
      where: { id: { in: ids } },
      include: { geofences: true },
      orderBy: { name: 'asc' },
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { geofences: true },
    });
    if (!client) throw new ResourceNotFoundException('Client', id);
    return client;
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      tradeName?: string;
      cnpj?: string;
      phone?: string;
      email?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      connectorType?: string;
    },
    _userId?: string,
  ) {
    // Verificar CNPJ único
    if (data.cnpj) {
      const existing = await this.prisma.client.findFirst({
        where: { tenantId, cnpj: data.cnpj, deletedAt: null },
      });
      if (existing)
        throw new ResourceAlreadyExistsException('Client', 'cnpj', data.cnpj);
    }

    const client = await this.prisma.client.create({
      data: { tenantId, ...data },
    });

    // Auto-criar geofence CLIENT se tem coordenadas
    if (data.latitude && data.longitude) {
      await this.prisma.geofence.create({
        data: {
          tenantId,
          name: `Geofence - ${data.tradeName || data.name}`,
          type: GeofenceType.CLIENT,
          latitude: data.latitude,
          longitude: data.longitude,
          radiusMeters: 500,
          clientId: client.id,
        },
      });
    }

    return this.findById(tenantId, client.id);
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      tradeName?: string;
      cnpj?: string;
      phone?: string;
      email?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      connectorType?: string;
      isActive?: boolean;
    },
    _userId?: string,
  ) {
    await this.findById(tenantId, id);
    return this.prisma.client.update({
      where: { id },
      data: { ...data },
      include: { geofences: true },
    });
  }

  /**
   * Inativar cliente. Se houver barris no local, cria alerta.
   */
  async deactivate(tenantId: string, id: string) {
    const client = await this.findById(tenantId, id);

    // Buscar barris cujo último evento logístico indica localização neste cliente
    const pendingBarrels = await this.prisma.barrel.findMany({
      where: {
        tenantId,
        lastClientId: id,
        status: 'AT_CLIENT',
        deletedAt: null,
      },
      select: { id: true, internalCode: true, chassisNumber: true },
    });

    // Inativar o cliente
    await this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });

    // Se houver barris pendentes, criar alerta
    if (pendingBarrels.length > 0) {
      await this.prisma.alert.create({
        data: {
          tenantId,
          alertType: AlertType.CLIENT_DEACTIVATED_WITH_BARRELS,
          priority: AlertPriority.HIGH,
          title: `Cliente inativado com ${pendingBarrels.length} barril(is) pendente(s)`,
          description: `O cliente "${client.tradeName || client.name}" foi inativado mas possui ${pendingBarrels.length} barril(is) ainda no local. É necessário coletar os barris.`,
          metadata: {
            clientId: id,
            clientName: client.tradeName || client.name,
            barrels: pendingBarrels.map((b) => ({
              id: b.id,
              internalCode: b.internalCode,
              chassisNumber: b.chassisNumber,
            })),
          },
        },
      });
    }

    return {
      deactivated: true,
      pendingBarrels: pendingBarrels.map((b) => ({
        id: b.id,
        internalCode: b.internalCode,
        chassisNumber: b.chassisNumber,
      })),
    };
  }

  /**
   * Reativar cliente
   */
  async activate(tenantId: string, id: string) {
    // Allow finding inactive clients
    const client = await this.prisma.client.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!client) throw new ResourceNotFoundException('Client', id);

    await this.prisma.client.update({
      where: { id },
      data: { isActive: true },
    });

    return { activated: true };
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
