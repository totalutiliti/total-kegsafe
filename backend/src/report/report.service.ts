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
  async getAssetReport(tenantId: string, query?: { from?: string; to?: string }) {
    const dateFilter: any = {};
    if (query?.from) dateFilter.gte = new Date(query.from);
    if (query?.to) dateFilter.lte = new Date(query.to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const barrels = await this.prisma.barrel.findMany({
      where: { tenantId, deletedAt: null, ...dateWhere },
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
  async getDisposalReport(tenantId: string, query?: { from?: string; to?: string }) {
    const dateFilter: any = {};
    if (query?.from) dateFilter.gte = new Date(query.from);
    if (query?.to) dateFilter.lte = new Date(query.to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const disposals = await this.prisma.disposal.findMany({
      where: { tenantId, ...dateWhere },
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
      disposalReason: d.disposalReason,
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
  async getComponentReport(tenantId: string, query?: { from?: string; to?: string }) {
    const dateFilter: any = {};
    if (query?.from) dateFilter.gte = new Date(query.from);
    if (query?.to) dateFilter.lte = new Date(query.to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const cycles = await this.prisma.componentCycle.findMany({
      where: { barrel: { tenantId, deletedAt: null }, ...dateWhere },
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
   * Loss analysis: why are we losing barrels?
   * Groups disposals by reason, client, month, and calculates costs.
   */
  async getLossAnalysis(tenantId: string, query?: { from?: string; to?: string }) {
    const dateFilter: any = {};
    if (query?.from) dateFilter.gte = new Date(query.from);
    if (query?.to) dateFilter.lte = new Date(query.to);
    const dateWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const disposals = await this.prisma.disposal.findMany({
      where: { tenantId, status: DisposalStatus.COMPLETED, ...dateWhere },
      include: {
        barrel: {
          select: {
            id: true,
            internalCode: true,
            chassisNumber: true,
            lastClientId: true,
            manufactureDate: true,
            totalCycles: true,
            acquisitionCost: true,
            totalMaintenanceCost: true,
          },
        },
        requestedBy: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Get tenant settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const expectedLifeYears =
      (settings.expectedBarrelLifeYears as number) || 20;

    // Collect unique client IDs
    const clientIds = [
      ...new Set(
        disposals
          .map((d) => d.barrel.lastClientId)
          .filter((id): id is string => !!id),
      ),
    ];
    const clients =
      clientIds.length > 0
        ? await this.prisma.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true },
          })
        : [];
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));

    // Calculate per-disposal metrics
    const items = disposals.map((d) => {
      const tco = Number(d.tcoAccumulated);
      const replacement = Number(d.replacementCost);
      const scrap = d.scrapValue ? Number(d.scrapValue) : 0;
      const netLoss = tco + replacement - scrap;

      const ageYears = d.barrel.manufactureDate
        ? ((d.completedAt ?? new Date()).getTime() -
            d.barrel.manufactureDate.getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
        : null;
      const isPremature =
        ageYears !== null && ageYears / expectedLifeYears < 0.7;

      return {
        id: d.id,
        barrelCode: d.barrel.internalCode,
        disposalReason: d.disposalReason || 'OTHER',
        reason: d.reason,
        clientId: d.barrel.lastClientId,
        clientName: d.barrel.lastClientId
          ? clientMap.get(d.barrel.lastClientId) || 'Desconhecido'
          : 'Sem cliente',
        tco,
        replacement,
        scrap,
        netLoss,
        ageYears: ageYears !== null ? Number(ageYears.toFixed(1)) : null,
        isPremature,
        totalCycles: d.barrel.totalCycles,
        completedAt: d.completedAt,
        month: d.completedAt ? d.completedAt.toISOString().slice(0, 7) : null,
      };
    });

    // ── By Reason ──
    const byReason: Record<string, { count: number; totalLoss: number }> = {};
    for (const item of items) {
      const key = item.disposalReason;
      if (!byReason[key]) byReason[key] = { count: 0, totalLoss: 0 };
      byReason[key].count++;
      byReason[key].totalLoss += item.netLoss;
    }

    // ── By Client ──
    const byClient: Record<
      string,
      { clientName: string; count: number; totalLoss: number }
    > = {};
    for (const item of items) {
      const key = item.clientId || 'none';
      if (!byClient[key])
        byClient[key] = {
          clientName: item.clientName,
          count: 0,
          totalLoss: 0,
        };
      byClient[key].count++;
      byClient[key].totalLoss += item.netLoss;
    }

    // ── By Month ──
    const byMonth: Record<string, { count: number; totalLoss: number }> = {};
    for (const item of items) {
      if (!item.month) continue;
      if (!byMonth[item.month])
        byMonth[item.month] = { count: 0, totalLoss: 0 };
      byMonth[item.month].count++;
      byMonth[item.month].totalLoss += item.netLoss;
    }

    // ── Summary ──
    const totalLoss = items.reduce((s, i) => s + i.netLoss, 0);
    const totalScrapRecovered = items.reduce((s, i) => s + i.scrap, 0);
    const prematureCount = items.filter((i) => i.isPremature).length;

    return {
      summary: {
        totalDisposals: items.length,
        totalLoss: Number(totalLoss.toFixed(2)),
        totalScrapRecovered: Number(totalScrapRecovered.toFixed(2)),
        prematureCount,
        prematurePercentage:
          items.length > 0
            ? Number(((prematureCount / items.length) * 100).toFixed(1))
            : 0,
        avgLossPerDisposal:
          items.length > 0 ? Number((totalLoss / items.length).toFixed(2)) : 0,
      },
      byReason: Object.entries(byReason)
        .map(([reason, data]) => ({
          reason,
          ...data,
          totalLoss: Number(data.totalLoss.toFixed(2)),
        }))
        .sort((a, b) => b.count - a.count),
      byClient: Object.entries(byClient)
        .map(([, data]) => ({
          ...data,
          totalLoss: Number(data.totalLoss.toFixed(2)),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      byMonth: Object.entries(byMonth)
        .map(([month, data]) => ({
          month,
          ...data,
          totalLoss: Number(data.totalLoss.toFixed(2)),
        }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      items: items.slice(0, 100),
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
