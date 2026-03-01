import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthScore } from '@prisma/client';
import { ResourceNotFoundException, ResourceAlreadyExistsException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class ComponentService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string) {
        return this.prisma.componentConfig.findMany({
            where: { tenantId, isActive: true, deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }

    async findById(tenantId: string, id: string) {
        const config = await this.prisma.componentConfig.findFirst({
            where: { id, tenantId, deletedAt: null },
        });
        if (!config) throw new ResourceNotFoundException('ComponentConfig', id);
        return config;
    }

    async create(tenantId: string, data: {
        name: string;
        description?: string;
        maxCycles: number;
        maxDays: number;
        criticality: string;
        alertThreshold?: number;
        averageReplacementCost?: number;
    }) {
        const existing = await this.prisma.componentConfig.findFirst({
            where: { tenantId, name: data.name, deletedAt: null },
        });
        if (existing) throw new ResourceAlreadyExistsException('ComponentConfig', 'name', data.name);

        return this.prisma.componentConfig.create({
            data: { tenantId, ...data } as any,
        });
    }

    async update(tenantId: string, id: string, data: any) {
        await this.findById(tenantId, id);
        return this.prisma.componentConfig.update({ where: { id }, data });
    }

    async delete(tenantId: string, id: string) {
        await this.findById(tenantId, id);
        return this.prisma.componentConfig.delete({ where: { id } });
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

        return { healthScore, healthPercentage: Math.round(healthPercentage * 100) / 100 };
    }

    /**
     * Recalcula o health score de todos os componentes de um barril
     */
    async recalculateBarrelHealth(barrelId: string) {
        const cycles = await this.prisma.componentCycle.findMany({
            where: { barrelId },
            include: { componentConfig: true },
        });

        for (const cycle of cycles) {
            const { healthScore, healthPercentage } = this.calculateHealthScore(
                cycle.cyclesSinceLastService,
                cycle.componentConfig.maxCycles,
                cycle.lastServiceDate,
                cycle.componentConfig.maxDays,
            );

            await this.prisma.componentCycle.update({
                where: { id: cycle.id },
                data: { healthScore, healthPercentage },
            });
        }
    }
}
