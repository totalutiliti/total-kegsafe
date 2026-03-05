import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeofenceType } from '@prisma/client';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class ClientService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const where = { tenantId, isActive: true, deletedAt: null };

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
    userId?: string,
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

  async update(tenantId: string, id: string, data: any, userId?: string) {
    await this.findById(tenantId, id);
    return this.prisma.client.update({
      where: { id },
      data: { ...data },
      include: { geofences: true },
    });
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.client.delete({ where: { id } });
  }
}
