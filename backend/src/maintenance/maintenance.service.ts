import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ComponentService } from '../component/component.service.js';
import {
  MaintenanceOrderStatus,
  MaintenanceType,
  AlertPriority,
  BarrelStatus,
  TriageResult,
  ComponentAction,
  DamageType,
  AlertType,
  HealthScore,
  Prisma,
} from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly componentService: ComponentService,
  ) {}

  async findAllOrders(
    tenantId: string,
    query?: { status?: MaintenanceOrderStatus; page?: number; limit?: number },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const where: Prisma.MaintenanceOrderWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query?.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.maintenanceOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { barrel: true, provider: true },
      }),
      this.prisma.maintenanceOrder.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOrderById(tenantId: string, id: string) {
    const order = await this.prisma.maintenanceOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        barrel: true,
        provider: true,
        maintenanceLog: { include: { items: true } },
      },
    });
    if (!order) throw new ResourceNotFoundException('MaintenanceOrder', id);
    return order;
  }

  async createOrder(
    tenantId: string,
    data: {
      barrelId: string;
      orderType: MaintenanceType;
      priority?: AlertPriority;
      description?: string;
      assignedToId?: string;
      providerId?: string;
      scheduledDate?: string;
    },
  ) {
    const orderNumber = `OS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

    const scheduled = data.scheduledDate ? new Date(data.scheduledDate) : null;
    const isFutureSchedule =
      scheduled && scheduled.getTime() > Date.now() + 60 * 60 * 1000; // >1h no futuro

    // Se agendada para o futuro, NÃO mudar status do barril agora
    // Caso contrário, mudar imediatamente para IN_MAINTENANCE
    if (!isFutureSchedule) {
      await this.prisma.barrel.update({
        where: { id: data.barrelId },
        data: { status: BarrelStatus.IN_MAINTENANCE },
      });
    }

    return this.prisma.maintenanceOrder.create({
      data: {
        tenantId,
        orderNumber,
        barrelId: data.barrelId,
        orderType: data.orderType,
        priority: data.priority,
        description: data.description ?? '',
        assignedToId: data.assignedToId,
        providerId: data.providerId,
        scheduledDate: scheduled,
        // OS agendadas iniciam como PENDING; status muda pelo cron
        status: isFutureSchedule
          ? MaintenanceOrderStatus.PENDING
          : MaintenanceOrderStatus.PENDING,
      },
      include: { barrel: true },
    });
  }

  /**
   * Registrar checklist de manutenção
   * Reseta ciclos dos componentes mantidos e recalcula saúde
   */
  async registerChecklist(
    tenantId: string,
    userId: string,
    data: {
      maintenanceOrderId?: string;
      barrelId: string;
      maintenanceType: string;
      pressureTestOk?: boolean;
      pressureTestValue?: number;
      washCompleted?: boolean;
      generalNotes?: string;
      totalCost?: number;
      items: Array<{
        componentConfigId: string;
        action: string;
        cost?: number;
        notes?: string;
      }>;
    },
  ) {
    const log = await this.prisma.maintenanceLog.create({
      data: {
        tenantId,
        barrelId: data.barrelId,
        userId,
        maintenanceOrderId: data.maintenanceOrderId,
        maintenanceType: data.maintenanceType as MaintenanceType,
        pressureTestOk: data.pressureTestOk,
        pressureTestValue: data.pressureTestValue,
        washCompleted: data.washCompleted,
        generalNotes: data.generalNotes,
        totalCost: data.totalCost,
        items: {
          create: data.items.map((item) => ({
            componentConfigId: item.componentConfigId,
            action: item.action as ComponentAction,
            cost: item.cost,
            notes: item.notes,
          })),
        },
      },
      include: { items: true },
    });

    // Resetar ciclos dos componentes REPLACED ou REPAIRED
    for (const item of data.items) {
      if (item.action === 'REPLACED' || item.action === 'REPAIRED') {
        await this.prisma.componentCycle.updateMany({
          where: {
            barrelId: data.barrelId,
            componentConfigId: item.componentConfigId,
          },
          data: {
            cyclesSinceLastService: 0,
            lastServiceDate: new Date(),
          },
        });
      }
    }

    // Recalcular saúde
    await this.componentService.recalculateBarrelHealth(data.barrelId);

    // Atualizar custo de manutenção do barril
    if (data.totalCost) {
      await this.prisma.barrel.update({
        where: { id: data.barrelId },
        data: { totalMaintenanceCost: { increment: data.totalCost } },
      });
    }

    // Completar OS se vinculada
    if (data.maintenanceOrderId) {
      await this.prisma.maintenanceOrder.update({
        where: { id: data.maintenanceOrderId },
        data: {
          status: MaintenanceOrderStatus.COMPLETED,
          actualCost: data.totalCost,
          completedAt: new Date(),
        },
      });
    }

    // Resolver alertas relacionados
    await this.prisma.alert.updateMany({
      where: {
        tenantId,
        barrelId: data.barrelId,
        resolvedAt: null,
        alertType: {
          in: [
            AlertType.COMPONENT_END_OF_LIFE,
            AlertType.MANDATORY_INSPECTION,
            AlertType.DISPOSAL_SUGGESTED,
          ],
        },
      },
      data: { resolvedAt: new Date(), resolvedById: userId },
    });

    return log;
  }

  /**
   * Triagem rápida de barril
   */
  async registerTriage(
    tenantId: string,
    userId: string,
    data: {
      barrelId: string;
      intact: boolean;
      damageType?: string;
      damageNotes?: string;
      photoUrl?: string;
    },
  ) {
    let result: TriageResult;

    if (data.intact) {
      result = TriageResult.CLEARED_FOR_FILLING;
      // Voltar para ACTIVE
      await this.prisma.barrel.update({
        where: { id: data.barrelId },
        data: { status: BarrelStatus.ACTIVE },
      });
    } else {
      result =
        data.damageType === 'STRUCTURAL'
          ? TriageResult.BLOCKED
          : TriageResult.SENT_TO_MAINTENANCE;

      const status =
        result === TriageResult.BLOCKED
          ? BarrelStatus.BLOCKED
          : BarrelStatus.IN_MAINTENANCE;

      await this.prisma.barrel.update({
        where: { id: data.barrelId },
        data: { status },
      });

      // Auto-criar OS se enviado para manutenção
      if (result === TriageResult.SENT_TO_MAINTENANCE) {
        await this.createOrder(tenantId, {
          barrelId: data.barrelId,
          orderType: MaintenanceType.CORRECTIVE,
          priority: AlertPriority.HIGH,
          description: `Triagem: ${data.damageNotes || 'Avaria detectada'}`,
        });
      }
    }

    return this.prisma.triage.create({
      data: {
        tenantId,
        barrelId: data.barrelId,
        userId,
        intact: data.intact,
        damageType: data.damageType as DamageType,
        damageNotes: data.damageNotes,
        photoUrl: data.photoUrl,
        result,
      },
    });
  }

  /**
   * Calendário de manutenções — ordens agrupadas por data
   * Usa scheduledDate quando disponível, senão createdAt
   */
  async getCalendar(tenantId: string, query?: { from?: string; to?: string }) {
    const from = query?.from
      ? new Date(query.from)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const to = query?.to
      ? new Date(query.to)
      : new Date(new Date().setDate(new Date().getDate() + 60));

    const orders = await this.prisma.maintenanceOrder.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { scheduledDate: { gte: from, lte: to } },
          { scheduledDate: null, createdAt: { gte: from, lte: to } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        barrel: {
          select: { id: true, internalCode: true, chassisNumber: true },
        },
        provider: { select: { id: true, name: true } },
      },
    });

    // Group by scheduledDate (preferred) or createdAt
    const calendar: Record<string, typeof orders> = {};
    for (const order of orders) {
      const refDate = order.scheduledDate ?? order.createdAt;
      const dateKey = refDate.toISOString().slice(0, 10);
      if (!calendar[dateKey]) calendar[dateKey] = [];
      calendar[dateKey].push(order);
    }

    return calendar;
  }

  /**
   * Ativa OS agendadas cuja data chegou.
   * Muda o barril para IN_MAINTENANCE.
   * Chamado pelo cron job diário.
   */
  async activateScheduledOrders(): Promise<number> {
    const now = new Date();

    // Buscar OS pendentes com scheduledDate <= agora
    const orders = await this.prisma.maintenanceOrder.findMany({
      where: {
        scheduledDate: { lte: now },
        status: MaintenanceOrderStatus.PENDING,
        deletedAt: null,
      },
      select: { id: true, barrelId: true },
    });

    for (const order of orders) {
      await this.prisma.barrel.update({
        where: { id: order.barrelId },
        data: { status: BarrelStatus.IN_MAINTENANCE },
      });
    }

    return orders.length;
  }

  /**
   * Check if a barrel needs maintenance on reception.
   * Creates MAINTENANCE_DUE_ON_RETURN alert if any component has YELLOW/RED health.
   * If maintenanceBlockMode is MANDATORY, auto-creates a maintenance order.
   */
  async checkMaintenanceDueOnReturn(tenantId: string, barrelId: string) {
    // Fetch components with health issues
    const components = await this.prisma.componentCycle.findMany({
      where: {
        barrelId,
        healthScore: { in: [HealthScore.YELLOW, HealthScore.RED] },
      },
      include: { componentConfig: true },
    });

    if (components.length === 0) return null;

    // Get tenant settings for maintenanceBlockMode
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const blockMode = (settings.maintenanceBlockMode as string) || 'ADVISORY';

    const componentNames = components.map((c) => c.componentConfig.name);
    const hasRed = components.some((c) => c.healthScore === HealthScore.RED);

    // Create alert
    await this.prisma.alert.create({
      data: {
        tenantId,
        barrelId,
        alertType: AlertType.MAINTENANCE_DUE_ON_RETURN,
        priority: hasRed ? AlertPriority.HIGH : AlertPriority.MEDIUM,
        title: `Manutenção necessária ao retornar barril`,
        description: `Componentes com atenção: ${componentNames.join(', ')}`,
        metadata: {
          components: components.map((c) => ({
            name: c.componentConfig.name,
            healthScore: c.healthScore,
            cyclesSinceLastService: c.cyclesSinceLastService,
            maxCycles: c.componentConfig.maxCycles,
          })),
          blockMode,
        },
      },
    });

    // If MANDATORY and any RED component, auto-create maintenance order
    if (blockMode === 'MANDATORY' && hasRed) {
      await this.createOrder(tenantId, {
        barrelId,
        orderType: MaintenanceType.PREVENTIVE,
        priority: AlertPriority.HIGH,
        description: `Manutenção obrigatória: componentes em estado crítico (${componentNames.join(', ')})`,
      });

      return { maintenanceRequired: true, autoOrderCreated: true };
    }

    return { maintenanceRequired: true, autoOrderCreated: false };
  }
}
