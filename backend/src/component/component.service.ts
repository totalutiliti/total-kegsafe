import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Criticality, HealthScore, Prisma } from '@prisma/client';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class ComponentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;
    const where = { tenantId, isActive: true, deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.componentConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.componentConfig.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const config = await this.prisma.componentConfig.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!config) throw new ResourceNotFoundException('ComponentConfig', id);
    return config;
  }

  async create(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      maxCycles: number;
      maxDays: number;
      criticality: string;
      alertThreshold?: number;
      averageReplacementCost?: number;
    },
  ) {
    const existing = await this.prisma.componentConfig.findFirst({
      where: { tenantId, name: data.name, deletedAt: null },
    });
    if (existing)
      throw new ResourceAlreadyExistsException(
        'ComponentConfig',
        'name',
        data.name,
      );

    return this.prisma.componentConfig.create({
      data: { tenantId, ...data } as Prisma.ComponentConfigUncheckedCreateInput,
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      maxCycles?: number;
      maxDays?: number;
      criticality?: Criticality;
      alertThreshold?: number;
      averageReplacementCost?: number;
      isActive?: boolean;
    },
  ) {
    await this.findById(tenantId, id);
    return this.prisma.componentConfig.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.componentConfig.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  async deactivate(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.componentConfig.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Retorna os componentes de um barril com remainingCycles calculado
   */
  async getBarrelComponents(barrelId: string) {
    const cycles = await this.prisma.componentCycle.findMany({
      where: { barrelId },
      include: { componentConfig: true },
    });

    return cycles.map((cycle) => ({
      id: cycle.id,
      componentConfigId: cycle.componentConfigId,
      name: cycle.componentConfig.name,
      description: cycle.componentConfig.description,
      criticality: cycle.componentConfig.criticality,
      maxCycles: cycle.componentConfig.maxCycles,
      maxDays: cycle.componentConfig.maxDays,
      cyclesSinceLastService: cycle.cyclesSinceLastService,
      lastServiceDate: cycle.lastServiceDate,
      healthScore: cycle.healthScore,
      healthPercentage: cycle.healthPercentage,
      remainingCycles: Math.max(
        0,
        cycle.componentConfig.maxCycles - cycle.cyclesSinceLastService,
      ),
      isActive: cycle.componentConfig.isActive,
    }));
  }

  /**
   * Calcula o health score de um componente
   * MAX(cyclePercentage, dayPercentage)
   * GREEN < 80% | YELLOW 80-99% | RED >= 100%
   */
  calculateHealthScore(
    cyclesSinceLastService: number,
    maxCycles: number,
    lastServiceDate: Date | null,
    maxDays: number,
  ): { healthScore: HealthScore; healthPercentage: number } {
    const cyclePercentage = (cyclesSinceLastService / maxCycles) * 100;

    let dayPercentage = 0;
    if (lastServiceDate) {
      const daysSinceService = Math.floor(
        (Date.now() - lastServiceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      dayPercentage = (daysSinceService / maxDays) * 100;
    }

    const healthPercentage = Math.max(cyclePercentage, dayPercentage);

    let healthScore: HealthScore;
    if (healthPercentage >= 100) {
      healthScore = HealthScore.RED;
    } else if (healthPercentage >= 80) {
      healthScore = HealthScore.YELLOW;
    } else {
      healthScore = HealthScore.GREEN;
    }

    return {
      healthScore,
      // Cap at 999.99 to fit Decimal(5,2) column — very old barrels can exceed 100% by far
      healthPercentage: Math.min(
        999.99,
        Math.round(healthPercentage * 100) / 100,
      ),
    };
  }

  /**
   * Recalcula o health score de todos os componentes de um barril.
   * Usa transação batch ($transaction) para agrupar N updates em 1 roundtrip.
   */
  async recalculateBarrelHealth(barrelId: string) {
    const cycles = await this.prisma.componentCycle.findMany({
      where: { barrelId },
      include: { componentConfig: true },
    });

    if (cycles.length === 0) return;

    // Calcular todos os scores em memória e agrupar updates
    const updates = cycles.map((cycle) => {
      const { healthScore, healthPercentage } = this.calculateHealthScore(
        cycle.cyclesSinceLastService,
        cycle.componentConfig.maxCycles,
        cycle.lastServiceDate,
        cycle.componentConfig.maxDays,
      );

      return this.prisma.componentCycle.update({
        where: { id: cycle.id },
        data: { healthScore, healthPercentage },
      });
    });

    // Executar todos os updates em uma única transação (1 roundtrip ao DB)
    await this.prisma.$transaction(updates);
  }
}
