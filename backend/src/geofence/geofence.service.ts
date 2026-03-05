import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class GeofenceService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.geofence.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      include: { client: true },
    });
  }

  async findById(tenantId: string, id: string) {
    const geofence = await this.prisma.geofence.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!geofence) throw new ResourceNotFoundException('Geofence', id);
    return geofence;
  }

  async create(tenantId: string, data: any, _userId?: string) {
    return this.prisma.geofence.create({ data: { tenantId, ...data } });
  }

  async update(tenantId: string, id: string, data: any, _userId?: string) {
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
