import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BarrelStatus,
  DisposalStatus,
  MaintenanceOrderStatus,
  HealthScore,
} from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Asset report: all barrels with status, cycles, costs, components health
   */
  async getAssetReport(tenantId: string) {
    const barrels = await this.prisma.barrel.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { internalCode: 'asc' },
      include: {
        componentCycles: {
          include: {
            componentConfig: { select: { name: true, maxCycles: true } },
          },
        },
      },
    });

    return barrels.map((b) => ({
      id: b.id,
      internalCode: b.internalCode,
      chassisNumber: b.chassisNumber,
      status: b.status,
      material: b.material,
      capacityLiters: b.capacityLiters,
      totalCycles: b.totalCycles,
      totalMaintenanceCost: Number(b.totalMaintenanceCost),
      acquisitionCost: Number(b.acquisitionCost || 0),
      manufactureDate: b.manufactureDate,
      components: b.componentCycles.map((c) => ({
        name: c.componentConfig.name,
        healthScore: c.healthScore,
        cyclesSinceLastService: c.cyclesSinceLastService,
        maxCycles: c.componentConfig.maxCycles,
        remainingCycles: Math.max(
          0,
          c.componentConfig.maxCycles - c.cyclesSinceLastService,
        ),
      })),
    }));
  }

  /**
   * Maintenance report: all maintenance orders with details
   */
  async getMaintenanceReport(
    tenantId: string,
    query?: { from?: string; to?: string },
  ) {
    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (query?.from || query?.to) {
      where.createdAt = {};
      if (query?.from)
        (where.createdAt as Record<string, unknown>).gte = new Date(query.from);
      if (query?.to)
        (where.createdAt as Record<string, unknown>).lte = new Date(query.to);
    }

    const orders = await this.prisma.maintenanceOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        barrel: { select: { internalCode: true, chassisNumber: true } },
        provider: { select: { name: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      barrelCode: o.barrel.internalCode,
      chassisNumber: o.barrel.chassisNumber,
      orderType: o.orderType,
      status: o.status,
      priority: o.priority,
      description: o.description,
      provider: o.provider?.name || null,
      estimatedCost: o.estimatedCost ? Number(o.estimatedCost) : null,
      actualCost: o.actualCost ? Number(o.actualCost) : null,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
    }));
  }

  /**
   * Disposal report: all disposals with barrel info
   */
  async getDisposalReport(tenantId: string) {
    const disposals = await this.prisma.disposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        barrel: {
          select: {
            internalCode: true,
            chassisNumber: true,
            manufactureDate: true,
          },
        },
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });

    return disposals.map((d) => ({
      id: d.id,
      barrelCode: d.barrel.internalCode,
      chassisNumber: d.barrel.chassisNumber,
      status: d.status,
      reason: d.reason,
      destination: d.destination,
      tcoAccumulated: Number(d.tcoAccumulated),
      replacementCost: Number(d.replacementCost),
      scrapValue: d.scrapValue ? Number(d.scrapValue) : null,
      requestedBy: d.requestedBy.name,
      approvedBy: d.approvedBy?.name || null,
      createdAt: d.createdAt,
      approvedAt: d.approvedAt,
      completedAt: d.completedAt,
    }));
  }

  /**
   * Component health report: per-barrel component status
   */
  async getComponentReport(tenantId: string) {
    const cycles = await this.prisma.componentCycle.findMany({
      where: { barrel: { tenantId, deletedAt: null } },
      include: {
        barrel: {
          select: { internalCode: true, chassisNumber: true, status: true },
        },
        componentConfig: {
          select: { name: true, maxCycles: true, criticality: true },
        },
      },
      orderBy: [{ healthScore: 'asc' }, { cyclesSinceLastService: 'desc' }],
    });

    return cycles.map((c) => ({
      barrelCode: c.barrel.internalCode,
      chassisNumber: c.barrel.chassisNumber,
      barrelStatus: c.barrel.status,
      componentName: c.componentConfig.name,
      criticality: c.componentConfig.criticality,
      healthScore: c.healthScore,
      cyclesSinceLastService: c.cyclesSinceLastService,
      maxCycles: c.componentConfig.maxCycles,
      remainingCycles: Math.max(
        0,
        c.componentConfig.maxCycles - c.cyclesSinceLastService,
      ),
      lastServiceDate: c.lastServiceDate,
    }));
  }

  /**
   * Anomaly report: barrels in unusual states or with alerts
   */
  async getAnomalyReport(tenantId: string) {
    const [unresolvedAlerts, blockedBarrels, longIdleBarrels] =
      await Promise.all([
        this.prisma.alert.findMany({
          where: { tenantId, resolvedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            alertType: true,
            priority: true,
            title: true,
            description: true,
            barrelId: true,
            createdAt: true,
          },
        }),
        this.prisma.barrel.findMany({
          where: { tenantId, status: BarrelStatus.BLOCKED, deletedAt: null },
          select: {
            id: true,
            internalCode: true,
            chassisNumber: true,
            lastEventAt: true,
          },
        }),
        // Barrels idle (AT_CLIENT) for more than 30 days
        this.prisma.barrel.findMany({
          where: {
            tenantId,
            status: BarrelStatus.AT_CLIENT,
            deletedAt: null,
            lastEventAt: {
              lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          select: {
            id: true,
            internalCode: true,
            chassisNumber: true,
            lastEventAt: true,
            lastClientId: true,
          },
          take: 100,
        }),
      ]);

    return {
      unresolvedAlerts,
      blockedBarrels,
      longIdleBarrels,
    };
  }

  /**
   * Export any report data as CSV string
   */
  exportToCsv(data: Record<string, unknown>[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str =
            val instanceof Date
              ? val.toISOString()
              : typeof val === 'object'
                ? JSON.stringify(val)
                : String(val as string | number | boolean);
          // Escape CSV: wrap in quotes if contains comma, newline, or quote
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Dashboard big numbers — expanded metrics
   */
  async getBigNumbers(tenantId: string) {
    const [
      totalBarrels,
      activeBarrels,
      inMaintenanceCount,
      disposedCount,
      pendingDisposals,
      openMaintenanceOrders,
      unresolvedAlerts,
      totalCyclesResult,
      redComponents,
    ] = await Promise.all([
      this.prisma.barrel.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.barrel.count({
        where: { tenantId, status: BarrelStatus.ACTIVE, deletedAt: null },
      }),
      this.prisma.barrel.count({
        where: {
          tenantId,
          status: BarrelStatus.IN_MAINTENANCE,
          deletedAt: null,
        },
      }),
      this.prisma.barrel.count({
        where: { tenantId, status: BarrelStatus.DISPOSED, deletedAt: null },
      }),
      this.prisma.disposal.count({
        where: { tenantId, status: DisposalStatus.PENDING_APPROVAL },
      }),
      this.prisma.maintenanceOrder.count({
        where: {
          tenantId,
          deletedAt: null,
          status: {
            in: [
              MaintenanceOrderStatus.PENDING,
              MaintenanceOrderStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      this.prisma.alert.count({ where: { tenantId, resolvedAt: null } }),
      this.prisma.$queryRaw<[{ total: string }]>`
        SELECT COALESCE(SUM("totalCycles"), 0)::text AS total
        FROM barrels
        WHERE "tenantId" = ${tenantId}::uuid AND "deletedAt" IS NULL
      `,
      this.prisma.componentCycle.count({
        where: {
          healthScore: HealthScore.RED,
          barrel: { tenantId, deletedAt: null },
        },
      }),
    ]);

    return {
      totalBarrels,
      activeBarrels,
      inMaintenanceCount,
      disposedCount,
      pendingDisposals,
      openMaintenanceOrders,
      unresolvedAlerts,
      totalCycles: Number(totalCyclesResult[0]?.total || 0),
      redComponents,
    };
  }
}
