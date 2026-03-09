import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { GeofenceType } from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query?: { page?: number; limit?: number; search?: string }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;
    const searchTerm = query?.search?.trim();

    // Busca com unaccent — raw SQL p/ IDs, Prisma p/ hydrate
    if (searchTerm) {
      return this.findAllWithSearch(tenantId, searchTerm, page, limit, skip);
    }

    const where: any = { tenantId, isActive: true, deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.geofence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: true },
      }),
      this.prisma.geofence.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async findAllWithSearch(
    tenantId: string,
    search: string,
    page: number,
    limit: number,
    skip: number,
  ) {
    const pattern = `%${search}%`;

    const [matchedIds, countResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM geofences
        WHERE "tenantId" = ${tenantId}::uuid
          AND "isActive" = true
          AND "deletedAt" IS NULL
          AND unaccent("name") ILIKE unaccent(${pattern})
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS "count" FROM geofences
        WHERE "tenantId" = ${tenantId}::uuid
          AND "isActive" = true
          AND "deletedAt" IS NULL
          AND unaccent("name") ILIKE unaccent(${pattern})
      `,
    ]);

    const total = Number(countResult[0].count);
    if (matchedIds.length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const ids = matchedIds.map((r) => r.id);
    const items = await this.prisma.geofence.findMany({
      where: { id: { in: ids } },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const geofence = await this.prisma.geofence.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!geofence) throw new ResourceNotFoundException('Geofence', id);
    return geofence;
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      type: GeofenceType;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      clientId?: string;
      isActive?: boolean;
    },
    _userId?: string,
  ) {
    return this.prisma.geofence.create({ data: { tenantId, ...data } });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      type?: GeofenceType;
      latitude?: number;
      longitude?: number;
      radiusMeters?: number;
      isActive?: boolean;
    },
    _userId?: string,
  ) {
    await this.findById(tenantId, id);
    return this.prisma.geofence.update({ where: { id }, data: { ...data } });
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.geofence.delete({ where: { id } });
  }

  /**
   * Calcula distância Haversine entre dois pontos em metros
   */
  haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // raio da Terra em metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Verifica se um ponto está dentro de uma geofence
   */
  isInsideGeofence(
    lat: number,
    lon: number,
    geoLat: number,
    geoLon: number,
    radiusMeters: number,
  ): boolean {
    const distance = this.haversineDistance(lat, lon, geoLat, geoLon);
    return distance <= radiusMeters;
  }

  /**
   * Encontra o geofence de cliente mais próximo
   */
  async findNearestClient(tenantId: string, lat: number, lon: number) {
    const geofences = await this.prisma.geofence.findMany({
      where: { tenantId, type: 'CLIENT', isActive: true, deletedAt: null },
    });

    let nearest: (typeof geofences)[0] | null = null;
    let minDistance = Infinity;

    for (const geo of geofences) {
      const distance = this.haversineDistance(
        lat,
        lon,
        Number(geo.latitude),
        Number(geo.longitude),
      );
      if (distance < minDistance && distance <= geo.radiusMeters) {
        minDistance = distance;
        nearest = geo;
      }
    }

    return nearest;
  }
}
