import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertService } from './alert.service.js';
import { ComponentService } from '../component/component.service.js';
import { HealthScore, BarrelStatus, Criticality } from '@prisma/client';

@Injectable()
export class AlertJobsService {
    private readonly logger = new Logger(AlertJobsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly alertService: AlertService,
        private readonly componentService: ComponentService,
        private readonly config: ConfigService,
    ) { }

    /**
     * Job 1: COMPONENT_HEALTH_YELLOW - Daily 06:00
     * Verifica componentes que atingiram 80%+ do limite
     */
    @Cron('0 6 * * *')
    async checkComponentHealth() {
        this.logger.log('Running component health check...');
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true, deletedAt: null } });

        for (const tenant of tenants) {
            const yellowCycles = await this.prisma.componentCycle.findMany({
                where: {
                    healthScore: HealthScore.YELLOW,
                    barrel: { tenantId: tenant.id, status: BarrelStatus.ACTIVE, deletedAt: null },
                },
                include: { barrel: true, componentConfig: true },
            });

            for (const cycle of yellowCycles) {
                await this.alertService.createAlert({
                    tenantId: tenant.id,
                    barrelId: cycle.barrelId,
                    type: 'COMPONENT_HEALTH_YELLOW',
                    priority: cycle.componentConfig.criticality === Criticality.CRITICAL ? 'HIGH' : 'MEDIUM',
                    title: `Component ${cycle.componentConfig.name} nearing limit`,
                    description: `Component at ${cycle.healthPercentage}% of limit on barrel ${cycle.barrel.internalCode}`,
                    metadata: { componentName: cycle.componentConfig.name, healthPercentage: cycle.healthPercentage },
                });
            }
        }
    }

    /**
     * Job 2: BARREL_IDLE_AT_CLIENT - Daily 08:00
     * Barris parados no cliente por mais de 15 dias
     */
    @Cron('0 8 * * *')
    async checkIdleBarrels() {
        this.logger.log('Running idle barrel check...');
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true, deletedAt: null } });

        for (const tenant of tenants) {
            const thresholdDays = (tenant.settings as any)?.idleThresholdDays || 15;
            const threshold = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

            const idleBarrels = await this.prisma.barrel.findMany({
                where: {
                    tenantId: tenant.id,
                    status: BarrelStatus.AT_CLIENT,
                    lastEventAt: { lt: threshold },
                    deletedAt: null,
                },
            });

            for (const barrel of idleBarrels) {
                await this.alertService.createAlert({
                    tenantId: tenant.id,
                    barrelId: barrel.id,
                    type: 'BARREL_IDLE_AT_CLIENT',
                    priority: 'MEDIUM',
                    title: `Barrel ${barrel.internalCode} idle at client`,
                    description: `No activity for ${thresholdDays}+ days`,
                });
            }
        }
    }

    /**
     * Job 3: MAINTENANCE_OVERDUE - Daily 07:00
     */
    @Cron('0 7 * * *')
    async checkMaintenanceOverdue() {
        this.logger.log('Running maintenance overdue check...');
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true, deletedAt: null } });

        for (const tenant of tenants) {
            const overdue = await this.prisma.maintenanceOrder.findMany({
                where: {
                    tenantId: tenant.id,
                    status: 'PENDING',
                    createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    deletedAt: null,
                },
                include: { barrel: true },
            });

            for (const order of overdue) {
                await this.alertService.createAlert({
                    tenantId: tenant.id,
                    barrelId: order.barrelId,
                    type: 'MAINTENANCE_OVERDUE',
                    priority: 'HIGH',
                    title: `Maintenance order ${order.orderNumber} overdue`,
                    description: `Pending for 7+ days`,
                });
            }
        }
    }

    /**
     * Job 4: BARREL_LOST - Daily 09:00
     * Barris sem atividade por 60+ dias
     */
    @Cron('0 9 * * *')
    async checkLostBarrels() {
        this.logger.log('Running lost barrel check...');
        const threshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true, deletedAt: null } });

        for (const tenant of tenants) {
            const lostBarrels = await this.prisma.barrel.findMany({
                where: {
                    tenantId: tenant.id,
                    status: { in: [BarrelStatus.AT_CLIENT, BarrelStatus.IN_TRANSIT] },
                    lastEventAt: { lt: threshold },
                    deletedAt: null,
                },
            });

            for (const barrel of lostBarrels) {
                await this.prisma.barrel.update({
                    where: { id: barrel.id },
                    data: { status: BarrelStatus.LOST },
                });

                await this.alertService.createAlert({
                    tenantId: tenant.id,
                    barrelId: barrel.id,
                    type: 'BARREL_LOST',
                    priority: 'CRITICAL',
                    title: `Barrel ${barrel.internalCode} marked as lost`,
                    description: `No activity for 60+ days`,
                });
            }
        }
    }

    /**
     * Job 5: GEOFENCE_VIOLATION - Hourly
     * Checks last logistics event GPS against client geofence
     */
    @Cron(CronExpression.EVERY_HOUR)
    async checkGeofenceViolations() {
        this.logger.log('Running geofence violation check...');
        const tenants = await this.prisma.tenant.findMany({ where: { isActive: true, deletedAt: null } });

        for (const tenant of tenants) {
            const recentDeliveries = await (this.prisma as any).logisticsEvent.findMany({
                where: {
                    tenantId: tenant.id,
                    actionType: 'DELIVERY',
                    createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
                },
                include: { barrel: true },
            });

            for (const event of recentDeliveries) {
                if (!event.latitude || !event.longitude || !event.clientId) continue;

                const clientGeofences = await this.prisma.geofence.findMany({
                    where: { clientId: event.clientId, deletedAt: null },
                });
                if (!clientGeofences.length) continue;
                const geofence = clientGeofences[0];

                const distance = this.haversineDistance(
                    Number(event.latitude), Number(event.longitude),
                    Number(geofence.latitude), Number(geofence.longitude),
                );

                if (distance > geofence.radiusMeters) {
                    await this.alertService.createAlert({
                        tenantId: tenant.id,
                        barrelId: event.barrelId,
                        type: 'GEOFENCE_VIOLATION',
                        priority: 'HIGH',
                        title: `Barrel ${event.barrel.internalCode} delivered outside geofence`,
                        description: `${Math.round(distance)}m from ${geofence.name} (limit: ${geofence.radiusMeters}m)`,
                        metadata: { distance, geofenceName: geofence.name },
                    });
                }
            }
        }
    }

    /**
     * Job 6: GPS_OFFLINE - Every 6 hours
     * Phase 2: Will check GPS device battery/signal on barrels with IoT hardware
     */
    @Cron('0 */6 * * *')
    async checkGpsOffline() {
        if (!this.config.get<boolean>('ENABLE_PHASE2_CRONS', false)) {
            this.logger.log('GPS offline check skipped — GPS/IoT integration pending (Phase 2)');
            return;
        }
        this.logger.log('Running GPS offline check...');
    }

    /**
     * Job 7: CACHE_REFRESH - Every 5 min (Phase 2: Redis cache for dashboard metrics)
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async refreshCache() {
        if (!this.config.get<boolean>('ENABLE_PHASE2_CRONS', false)) {
            this.logger.log('Cache refresh skipped — Redis integration pending (Phase 2)');
            return;
        }
        this.logger.log('Running dashboard cache refresh...');
    }

    /**
     * Helper: Haversine distance in meters
     */
    private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private deg2rad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}
