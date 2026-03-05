import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertType, AlertPriority, Prisma } from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

const VALID_ALERT_TYPES = Object.values(AlertType);

@Injectable()
export class AlertService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query?: {
      page?: number;
      limit?: number;
      type?: string;
      resolved?: boolean | string;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    // Validate alert type enum
    if (query?.type) {
      if (!VALID_ALERT_TYPES.includes(query.type as AlertType)) {
        throw new BadRequestException(
          `Tipo de alerta inválido: ${query.type}. Valores válidos: ${VALID_ALERT_TYPES.join(', ')}`,
        );
      }
    }

    // Coerce resolved from string to boolean (query params are strings)
    const resolvedBool =
      query?.resolved !== undefined
        ? query.resolved === true || query.resolved === 'true'
        : undefined;

    const where: Prisma.AlertWhereInput = {
      tenantId,
      ...(query?.type ? { alertType: query.type as AlertType } : {}),
      ...(resolvedBool !== undefined
        ? resolvedBool
          ? { resolvedAt: { not: null } }
          : { resolvedAt: null }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { barrel: true },
      }),
      this.prisma.alert.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, tenantId },
      include: { barrel: true },
    });
    if (!alert) throw new ResourceNotFoundException('Alert', id);
    return alert;
  }

  async acknowledge(tenantId: string, id: string, userId: string) {
    await this.findById(tenantId, id);
    return this.prisma.alert.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
        status: 'ACKNOWLEDGED',
      },
    });
  }

  async resolve(
    tenantId: string,
    id: string,
    userId: string,
    resolution?: string,
  ) {
    await this.findById(tenantId, id);
    return this.prisma.alert.update({
      where: { id },
      data: {
        resolvedAt: new Date(),
        resolvedById: userId,
        resolutionNotes: resolution,
        status: 'RESOLVED',
      },
    });
  }

  async createAlert(data: {
    tenantId: string;
    barrelId: string;
    type: string;
    priority: string;
    title: string;
    description: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    // Verificar se já existe alerta não resolvido do mesmo tipo para o barril
    const existing = await this.prisma.alert.findFirst({
      where: {
        tenantId: data.tenantId,
        barrelId: data.barrelId,
        alertType: data.type as AlertType,
        resolvedAt: null,
      },
    });
    if (existing) return existing;

    return this.prisma.alert.create({
      data: {
        tenantId: data.tenantId,
        barrelId: data.barrelId,
        alertType: data.type as AlertType,
        priority: data.priority as AlertPriority,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
      },
    });
  }

  async getAlertCounts(tenantId: string) {
    const [total, pending, critical] = await Promise.all([
      this.prisma.alert.count({ where: { tenantId, resolvedAt: null } }),
      this.prisma.alert.count({
        where: { tenantId, resolvedAt: null, acknowledgedAt: null },
      }),
      this.prisma.alert.count({
        where: { tenantId, resolvedAt: null, priority: 'CRITICAL' },
      }),
    ]);
    return { total, pending, critical };
  }
}
