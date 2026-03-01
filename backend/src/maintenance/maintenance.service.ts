import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ComponentService } from '../component/component.service.js';
import { MaintenanceOrderStatus, BarrelStatus, TriageResult, ComponentAction } from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class MaintenanceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly componentService: ComponentService,
    ) { }

    async findAllOrders(tenantId: string, query?: { status?: MaintenanceOrderStatus; page?: number; limit?: number }) {
        const page = query?.page || 1;
        const limit = query?.limit || 20;
        const where: any = {
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
            include: { barrel: true, provider: true, maintenanceLog: { include: { items: true } } },
        });
        if (!order) throw new ResourceNotFoundException('MaintenanceOrder', id);
        return order;
    }

    async createOrder(tenantId: string, data: any) {
        const orderNumber = `OS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

        // Mudar status do barril para IN_MAINTENANCE
        await this.prisma.barrel.update({
            where: { id: data.barrelId },
            data: { status: BarrelStatus.IN_MAINTENANCE },
        });

        return this.prisma.maintenanceOrder.create({
            data: { tenantId, orderNumber, ...data },
            include: { barrel: true },
        });
    }

    /**
     * Registrar checklist de manutenção
     * Reseta ciclos dos componentes mantidos e recalcula saúde
     */
    async registerChecklist(tenantId: string, userId: string, data: {
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
    }) {
        const log = await this.prisma.maintenanceLog.create({
            data: {
                tenantId,
                barrelId: data.barrelId,
                userId,
                maintenanceOrderId: data.maintenanceOrderId,
                maintenanceType: data.maintenanceType as any,
                pressureTestOk: data.pressureTestOk,
                pressureTestValue: data.pressureTestValue,
                washCompleted: data.washCompleted,
                generalNotes: data.generalNotes,
                totalCost: data.totalCost,
                items: {
                    create: data.items.map(item => ({
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
                alertType: { in: ['COMPONENT_END_OF_LIFE', 'MANDATORY_INSPECTION', 'DISPOSAL_SUGGESTED'] as any },
            },
            data: { resolvedAt: new Date(), resolvedById: userId },
        });

        return log;
    }

    /**
     * Triagem rápida de barril
     */
    async registerTriage(tenantId: string, userId: string, data: {
        barrelId: string;
        intact: boolean;
        damageType?: string;
        damageNotes?: string;
        photoUrl?: string;
    }) {
        let result: TriageResult;

        if (data.intact) {
            result = TriageResult.CLEARED_FOR_FILLING;
            // Voltar para ACTIVE
            await this.prisma.barrel.update({
                where: { id: data.barrelId },
                data: { status: BarrelStatus.ACTIVE },
            });
        } else {
            result = data.damageType === 'STRUCTURAL'
                ? TriageResult.BLOCKED
                : TriageResult.SENT_TO_MAINTENANCE;

            const status = result === TriageResult.BLOCKED
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
                    orderType: 'CORRECTIVE',
                    priority: 'HIGH',
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
                damageType: data.damageType as any,
                damageNotes: data.damageNotes,
                photoUrl: data.photoUrl,
                result,
            },
        });
    }
}
