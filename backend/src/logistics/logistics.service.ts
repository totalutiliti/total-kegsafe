import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { BarrelService } from '../barrel/barrel.service.js';
import { ComponentService } from '../component/component.service.js';
import { GeofenceService } from '../geofence/geofence.service.js';
import { BarrelStatus, LogisticsAction, Criticality, HealthScore } from '@prisma/client';
import {
    BarrelNotReadyForExpeditionException,
    BarrelNotInTransitException,
    BarrelNotAtClientException,
    BarrelBlockedCriticalComponentException,
    BarrelBlockedException,
    BarrelDisposedException,
} from '../shared/exceptions/barrel.exceptions.js';

@Injectable()
export class LogisticsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly barrelService: BarrelService,
        private readonly componentService: ComponentService,
        private readonly geofenceService: GeofenceService,
    ) { }

    /**
     * Input 1: Expedição - ACTIVE → IN_TRANSIT
     * REGRA CRÍTICA: Bloqueia expedição se componente CRITICAL tem HealthScore RED
     */
    async expedition(tenantId: string, userId: string, data: {
        barrelId: string;
        latitude: number;
        longitude: number;
        gpsAccuracy?: number;
        notes?: string;
        batchId?: string;
    }) {
        const barrel = await this.barrelService.findById(tenantId, data.barrelId);

        // Verificar status
        if (barrel.status === BarrelStatus.DISPOSED) throw new BarrelDisposedException();
        if (barrel.status === BarrelStatus.BLOCKED) throw new BarrelBlockedException();
        if (barrel.status !== BarrelStatus.ACTIVE) {
            throw new BarrelNotReadyForExpeditionException(barrel.status);
        }

        // VALIDAÇÃO CRÍTICA: Verificar componentes críticos
        const criticalComponents = barrel.componentCycles
            .filter(c =>
                c.componentConfig.criticality === Criticality.CRITICAL &&
                c.healthScore === HealthScore.RED
            )
            .map(c => c.componentConfig.name);

        if (criticalComponents.length > 0) {
            throw new BarrelBlockedCriticalComponentException(barrel.id, criticalComponents);
        }

        // Criar evento logístico
        const event = await this.prisma.logisticsEvent.create({
            data: {
                tenantId,
                barrelId: data.barrelId,
                userId,
                actionType: LogisticsAction.EXPEDITION,
                latitude: data.latitude,
                longitude: data.longitude,
                gpsAccuracy: data.gpsAccuracy,
                notes: data.notes,
                batchId: data.batchId,
                previousStatus: barrel.status,
                inferredZone: 'FACTORY',
            },
        });

        // Atualizar barril
        await this.prisma.barrel.update({
            where: { id: data.barrelId },
            data: {
                status: BarrelStatus.IN_TRANSIT,
                currentLatitude: data.latitude,
                currentLongitude: data.longitude,
                lastEventAt: new Date(),
            },
        });

        return event;
    }

    /**
     * Input 2: Entrega - IN_TRANSIT → AT_CLIENT
     */
    async delivery(tenantId: string, userId: string, data: {
        barrelId: string;
        latitude: number;
        longitude: number;
        clientId?: string;
        gpsAccuracy?: number;
        notes?: string;
        batchId?: string;
    }) {
        const barrel = await this.barrelService.findById(tenantId, data.barrelId);

        if (barrel.status !== BarrelStatus.IN_TRANSIT) {
            throw new BarrelNotInTransitException(barrel.status);
        }

        // Inferir cliente pelo geofence se não especificado
        let clientId = data.clientId;
        if (!clientId) {
            const nearest = await this.geofenceService.findNearestClient(
                tenantId, data.latitude, data.longitude,
            );
            if (nearest) clientId = nearest.clientId || undefined;
        }

        const event = await this.prisma.logisticsEvent.create({
            data: {
                tenantId,
                barrelId: data.barrelId,
                userId,
                actionType: LogisticsAction.DELIVERY,
                latitude: data.latitude,
                longitude: data.longitude,
                gpsAccuracy: data.gpsAccuracy,
                clientId,
                notes: data.notes,
                batchId: data.batchId,
                previousStatus: barrel.status,
                inferredZone: 'CLIENT',
            },
        });

        await this.prisma.barrel.update({
            where: { id: data.barrelId },
            data: {
                status: BarrelStatus.AT_CLIENT,
                currentLatitude: data.latitude,
                currentLongitude: data.longitude,
                lastEventAt: new Date(),
                lastClientId: clientId || null,
            },
        });

        return event;
    }

    /**
     * Input 3: Coleta - AT_CLIENT → IN_TRANSIT
     */
    async collection(tenantId: string, userId: string, data: {
        barrelId: string;
        latitude: number;
        longitude: number;
        gpsAccuracy?: number;
        notes?: string;
        batchId?: string;
    }) {
        const barrel = await this.barrelService.findById(tenantId, data.barrelId);

        if (barrel.status !== BarrelStatus.AT_CLIENT) {
            throw new BarrelNotAtClientException(barrel.status);
        }

        const event = await this.prisma.logisticsEvent.create({
            data: {
                tenantId,
                barrelId: data.barrelId,
                userId,
                actionType: LogisticsAction.COLLECTION,
                latitude: data.latitude,
                longitude: data.longitude,
                gpsAccuracy: data.gpsAccuracy,
                clientId: barrel.lastClientId,
                notes: data.notes,
                batchId: data.batchId,
                previousStatus: barrel.status,
                inferredZone: 'CLIENT',
            },
        });

        await this.prisma.barrel.update({
            where: { id: data.barrelId },
            data: {
                status: BarrelStatus.IN_TRANSIT,
                currentLatitude: data.latitude,
                currentLongitude: data.longitude,
                lastEventAt: new Date(),
            },
        });

        return event;
    }

    /**
     * Input 4: Recebimento - IN_TRANSIT → ACTIVE
     * Incrementa ciclo e recalcula saúde dos componentes
     */
    async reception(tenantId: string, userId: string, data: {
        barrelId: string;
        latitude: number;
        longitude: number;
        gpsAccuracy?: number;
        notes?: string;
        batchId?: string;
    }) {
        const barrel = await this.barrelService.findById(tenantId, data.barrelId);

        if (barrel.status !== BarrelStatus.IN_TRANSIT) {
            throw new BarrelNotInTransitException(barrel.status);
        }

        const event = await this.prisma.logisticsEvent.create({
            data: {
                tenantId,
                barrelId: data.barrelId,
                userId,
                actionType: LogisticsAction.RECEPTION,
                latitude: data.latitude,
                longitude: data.longitude,
                gpsAccuracy: data.gpsAccuracy,
                notes: data.notes,
                batchId: data.batchId,
                previousStatus: barrel.status,
                inferredZone: 'FACTORY',
            },
        });

        // Incrementar ciclo total + ciclos de componentes
        await this.prisma.barrel.update({
            where: { id: data.barrelId },
            data: {
                status: BarrelStatus.ACTIVE,
                totalCycles: { increment: 1 },
                currentLatitude: data.latitude,
                currentLongitude: data.longitude,
                lastEventAt: new Date(),
            },
        });

        // Incrementar ciclos de cada componente
        await this.prisma.componentCycle.updateMany({
            where: { barrelId: data.barrelId },
            data: { cyclesSinceLastService: { increment: 1 } },
        });

        // Recalcular health scores
        await this.componentService.recalculateBarrelHealth(data.barrelId);

        return event;
    }
}

