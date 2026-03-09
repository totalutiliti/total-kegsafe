import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarrelStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fleet health: 2 groupBy queries em vez de 11 COUNT individuais
   */
  async getFleetHealth(tenantId: string) {
    const [fleetStats, healthStats] = await Promise.all([
      this.prisma.barrel.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.componentCycle.groupBy({
        by: ['healthScore'],
        where: { barrel: { tenantId, deletedAt: null } },
        _count: { _all: true },
      }),
    ]);

    // Montar objeto de contagem por status a partir do groupBy
    const statusMap: Record<string, number> = {};
    for (const row of fleetStats) {
      statusMap[row.status] = row._count._all;
    }

    const healthMap: Record<string, number> = {};
    for (const row of healthStats) {
      healthMap[row.healthScore] = row._count._all;
    }

    const total = Object.values(statusMap).reduce((sum, v) => sum + v, 0);

    return {
      barrels: {
        total,
        active: statusMap[BarrelStatus.ACTIVE] || 0,
        inTransit: statusMap[BarrelStatus.IN_TRANSIT] || 0,
        atClient: statusMap[BarrelStatus.AT_CLIENT] || 0,
        inYard: statusMap[BarrelStatus.IN_YARD] || 0,
        inMaintenance: statusMap[BarrelStatus.IN_MAINTENANCE] || 0,
        blocked: statusMap[BarrelStatus.BLOCKED] || 0,
        disposed: statusMap[BarrelStatus.DISPOSED] || 0,
        lost: statusMap[BarrelStatus.LOST] || 0,
      },
      componentHealth: {
        green: healthMap['GREEN'] || 0,
        yellow: healthMap['YELLOW'] || 0,
        red: healthMap['RED'] || 0,
      },
    };
  }

  /**
   * Custo por litro: agregação SQL em vez de findMany + loop em memória
   */
  async getCostPerLiter(tenantId: string) {
    const result = await this.prisma.$queryRaw<
      [
        {
          totalCost: string | null;
          totalLiters: string | null;
          barrelsAnalyzed: bigint;
        },
      ]
    >`
            SELECT
                COALESCE(SUM(CAST("totalMaintenanceCost" AS NUMERIC) + COALESCE(CAST("acquisitionCost" AS NUMERIC), 0)), 0) AS "totalCost",
                COALESCE(SUM(CAST("capacityLiters" AS BIGINT) * CAST("totalCycles" AS BIGINT)), 0) AS "totalLiters",
                COUNT(*)::bigint AS "barrelsAnalyzed"
            FROM barrels
            WHERE "tenantId" = ${tenantId}::uuid
              AND "deletedAt" IS NULL
              AND "totalCycles" > 0
        `;

    const row = result[0];
    const totalCost = Number(row.totalCost || 0);
    const totalLiters = Number(row.totalLiters || 0);
    const barrelsAnalyzed = Number(row.barrelsAnalyzed);

    return {
      costPerLiter:
        totalLiters > 0 ? Math.round((totalCost / totalLiters) * 100) / 100 : 0,
      totalCost,
      totalLiters,
      barrelsAnalyzed,
    };
  }

  /**
   * Giro de ativos: agregação SQL em vez de findMany + reduce
   */
  async getAssetTurnover(tenantId: string) {
    const result = await this.prisma.$queryRaw<
      [
        {
          totalBarrels: bigint;
          totalCycles: string | null;
        },
      ]
    >`
            SELECT
                COUNT(*)::bigint AS "totalBarrels",
                COALESCE(SUM("totalCycles"), 0) AS "totalCycles"
            FROM barrels
            WHERE "tenantId" = ${tenantId}::uuid
              AND "deletedAt" IS NULL
        `;

    const row = result[0];
    const totalBarrels = Number(row.totalBarrels);
    const totalCycles = Number(row.totalCycles || 0);
    const avgCycles =
      totalBarrels > 0 ? Math.round(totalCycles / totalBarrels) : 0;

    return {
      totalBarrels,
      totalCycles,
      avgCyclesPerBarrel: avgCycles,
    };
  }

  /**
   * Relatório de perdas: agregação SQL para valor total + contadores groupBy
   */
  async getLossReport(tenantId: string) {
    const [lostAggResult, lostBarrels, blocked, disposed] = await Promise.all([
      this.prisma.$queryRaw<
        [
          {
            count: bigint;
            estimatedValue: string | null;
          },
        ]
      >`
                SELECT
                    COUNT(*)::bigint AS "count",
                    COALESCE(SUM(CAST("acquisitionCost" AS NUMERIC)), 0) AS "estimatedValue"
                FROM barrels
                WHERE "tenantId" = ${tenantId}::uuid
                  AND "status" = 'LOST'::"BarrelStatus"
                  AND "deletedAt" IS NULL
            `,
      this.prisma.barrel.findMany({
        where: { tenantId, status: BarrelStatus.LOST, deletedAt: null },
        select: {
          id: true,
          internalCode: true,
          acquisitionCost: true,
          lastEventAt: true,
        },
        take: 100,
        orderBy: { lastEventAt: 'desc' },
      }),
      this.prisma.barrel.count({
        where: { tenantId, status: BarrelStatus.BLOCKED, deletedAt: null },
      }),
      this.prisma.barrel.count({
        where: { tenantId, status: BarrelStatus.DISPOSED, deletedAt: null },
      }),
    ]);

    const agg = lostAggResult[0];

    return {
      lost: {
        count: Number(agg.count),
        estimatedValue: Number(agg.estimatedValue || 0),
        barrels: lostBarrels,
      },
      blocked,
      disposed,
    };
  }
}
