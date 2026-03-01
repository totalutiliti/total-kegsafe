import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarrelStatus, HealthScore } from '@prisma/client';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) { }

    async getFleetHealth(tenantId: string) {
        const [total, active, inTransit, atClient, inMaintenance, blocked, disposed, lost] = await Promise.all([
            this.prisma.barrel.count({ where: { tenantId, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.ACTIVE, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.IN_TRANSIT, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.AT_CLIENT, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.IN_MAINTENANCE, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.BLOCKED, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.DISPOSED, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.LOST, deletedAt: null } }),
        ]);

        const [greenComponents, yellowComponents, redComponents] = await Promise.all([
            this.prisma.componentCycle.count({ where: { healthScore: HealthScore.GREEN, barrel: { tenantId, deletedAt: null } } }),
            this.prisma.componentCycle.count({ where: { healthScore: HealthScore.YELLOW, barrel: { tenantId, deletedAt: null } } }),
            this.prisma.componentCycle.count({ where: { healthScore: HealthScore.RED, barrel: { tenantId, deletedAt: null } } }),
        ]);

        return {
            barrels: { total, active, inTransit, atClient, inMaintenance, blocked, disposed, lost },
            componentHealth: { green: greenComponents, yellow: yellowComponents, red: redComponents },
        };
    }

    async getCostPerLiter(tenantId: string) {
        const barrels = await this.prisma.barrel.findMany({
            where: { tenantId, deletedAt: null, totalCycles: { gt: 0 } },
            select: { capacityLiters: true, totalCycles: true, totalMaintenanceCost: true, acquisitionCost: true },
        });

        let totalCost = 0;
        let totalLiters = 0;

        for (const b of barrels) {
            totalCost += Number(b.totalMaintenanceCost) + Number(b.acquisitionCost || 0);
            totalLiters += b.capacityLiters * b.totalCycles;
        }

        return {
            costPerLiter: totalLiters > 0 ? Math.round((totalCost / totalLiters) * 100) / 100 : 0,
            totalCost,
            totalLiters,
            barrelsAnalyzed: barrels.length,
        };
    }

    async getAssetTurnover(tenantId: string) {
        const barrels = await this.prisma.barrel.findMany({
            where: { tenantId, deletedAt: null },
            select: { totalCycles: true, createdAt: true },
        });

        const totalCycles = barrels.reduce((sum, b) => sum + b.totalCycles, 0);
        const avgCycles = barrels.length > 0 ? Math.round(totalCycles / barrels.length) : 0;

        return {
            totalBarrels: barrels.length,
            totalCycles,
            avgCyclesPerBarrel: avgCycles,
        };
    }

    async getLossReport(tenantId: string) {
        const [lost, blocked, disposed] = await Promise.all([
            this.prisma.barrel.findMany({
                where: { tenantId, status: BarrelStatus.LOST, deletedAt: null },
                select: { id: true, internalCode: true, acquisitionCost: true, lastEventAt: true },
            }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.BLOCKED, deletedAt: null } }),
            this.prisma.barrel.count({ where: { tenantId, status: BarrelStatus.DISPOSED, deletedAt: null } }),
        ]);

        const lostValue = lost.reduce((sum, b) => sum + Number(b.acquisitionCost || 0), 0);

        return { lost: { count: lost.length, estimatedValue: lostValue, barrels: lost }, blocked, disposed };
    }
}
