import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarrelStatus } from '@prisma/client';
import { CreateBarrelDto } from './dto/create-barrel.dto.js';
import { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import {
    BarrelNotFoundException,
    BarrelQrCodeExistsException,
    BarrelInvalidStatusTransitionException,
} from '../shared/exceptions/barrel.exceptions.js';

// Transições de status válidas conforme RULES.md
const VALID_TRANSITIONS: Record<string, string[]> = {
    ACTIVE: ['IN_TRANSIT', 'IN_MAINTENANCE', 'BLOCKED', 'DISPOSED'],
    IN_TRANSIT: ['AT_CLIENT', 'ACTIVE'],
    AT_CLIENT: ['IN_TRANSIT', 'BLOCKED'],
    IN_MAINTENANCE: ['ACTIVE', 'BLOCKED', 'DISPOSED'],
    BLOCKED: ['IN_MAINTENANCE', 'DISPOSED', 'ACTIVE'],
    DISPOSED: [],
    LOST: ['ACTIVE', 'BLOCKED'],
};

@Injectable()
export class BarrelService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string, query?: {
        status?: BarrelStatus;
        page?: number;
        limit?: number;
        search?: string;
    }) {
        const page = query?.page || 1;
        const limit = query?.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {
            tenantId,
            deletedAt: null,
            ...(query?.status ? { status: query.status } : {}),
            ...(query?.search ? {
                OR: [
                    { internalCode: { contains: query.search, mode: 'insensitive' } },
                    { qrCode: { contains: query.search, mode: 'insensitive' } },
                ],
            } : {}),
        };

        const [items, total] = await Promise.all([
            this.prisma.barrel.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    componentCycles: {
                        include: { componentConfig: true },
                    },
                },
            }),
            this.prisma.barrel.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(tenantId: string, id: string) {
        const barrel = await this.prisma.barrel.findFirst({
            where: { id, tenantId, deletedAt: null },
            include: {
                componentCycles: {
                    include: { componentConfig: true },
                },
            },
        });
        if (!barrel) {
            throw new BarrelNotFoundException(id);
        }
        return barrel;
    }

    async findByQrCode(tenantId: string, qrCode: string) {
        const barrel = await this.prisma.barrel.findFirst({
            where: { qrCode, tenantId, deletedAt: null },
            include: {
                componentCycles: {
                    include: { componentConfig: true },
                },
            },
        });
        if (!barrel) {
            throw new BarrelNotFoundException(qrCode);
        }
        return barrel;
    }

    async create(tenantId: string, dto: CreateBarrelDto) {
        // Verificar unicidade do QR Code
        const existing = await this.prisma.barrel.findFirst({
            where: { qrCode: dto.qrCode, tenantId },
        });
        if (existing) {
            throw new BarrelQrCodeExistsException(dto.qrCode);
        }

        // Gerar código interno
        const lastBarrel = await this.prisma.barrel.findFirst({
            where: { tenantId },
            orderBy: { internalCode: 'desc' },
        });
        const nextNumber = lastBarrel
            ? parseInt(lastBarrel.internalCode.replace('KS-BAR-', '')) + 1
            : 1;
        const internalCode = `KS-BAR-${String(nextNumber).padStart(5, '0')}`;

        // Criar barril
        const barrel = await this.prisma.barrel.create({
            data: {
                tenantId,
                internalCode,
                qrCode: dto.qrCode,
                barcode: dto.barcode,
                manufacturer: dto.manufacturer,
                valveModel: dto.valveModel,
                capacityLiters: dto.capacityLiters,
                tareWeightKg: dto.tareWeightKg,
                material: dto.material,
                purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
                acquisitionCost: dto.acquisitionCost,
                status: BarrelStatus.ACTIVE,
            },
        });

        // Criar ComponentCycles para cada componente configurado
        const componentConfigs = await this.prisma.componentConfig.findMany({
            where: { tenantId, isActive: true, deletedAt: null },
        });

        for (const config of componentConfigs) {
            await this.prisma.componentCycle.create({
                data: {
                    barrelId: barrel.id,
                    componentConfigId: config.id,
                    cyclesSinceLastService: 0,
                    lastServiceDate: new Date(),
                    healthScore: 'GREEN',
                    healthPercentage: 0,
                },
            });
        }

        return this.findById(tenantId, barrel.id);
    }

    async update(tenantId: string, id: string, dto: UpdateBarrelDto) {
        await this.findById(tenantId, id);
        return this.prisma.barrel.update({
            where: { id },
            data: {
                manufacturer: dto.manufacturer,
                valveModel: dto.valveModel,
                capacityLiters: dto.capacityLiters,
                tareWeightKg: dto.tareWeightKg,
                material: dto.material,
                acquisitionCost: dto.acquisitionCost,
            },
            include: {
                componentCycles: {
                    include: { componentConfig: true },
                },
            },
        });
    }

    async delete(tenantId: string, id: string) {
        await this.findById(tenantId, id);
        return this.prisma.barrel.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    /**
     * Valida se a transição de status é permitida
     */
    validateStatusTransition(currentStatus: string, targetStatus: string): void {
        const allowed = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(targetStatus)) {
            throw new BarrelInvalidStatusTransitionException(
                currentStatus,
                targetStatus,
                allowed,
            );
        }
    }

    /**
     * Timeline do barril (últimos eventos)
     */
    async getTimeline(tenantId: string, barrelId: string) {
        await this.findById(tenantId, barrelId);
        const events = await this.prisma.logisticsEvent.findMany({
            where: { tenantId, barrelId },
            orderBy: { timestamp: 'desc' },
            take: 50,
            include: { user: { select: { name: true } } },
        });
        return events;
    }
}
