import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertService } from './alert.service.js';
import { ComponentService } from '../component/component.service.js';
import { BarrelStatus, AlertType, AlertPriority } from '@prisma/client';

/** Limite de concorrência para processamento paralelo de tenants */
const TENANT_CONCURRENCY = 10;

@Injectable()
export class AlertJobsService {
  private readonly logger = new Logger(AlertJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertService: AlertService,
    private readonly componentService: ComponentService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Processa tenants em lotes paralelos com concorrência limitada
   */
  private async processTenantsInParallel(
    tenants: { id: string; settings: any }[],
    handler: (tenant: { id: string; settings: any }) => Promise<void>,
  ) {
    for (let i = 0; i < tenants.length; i += TENANT_CONCURRENCY) {
      const batch = tenants.slice(i, i + TENANT_CONCURRENCY);
      await Promise.all(batch.map(handler));
    }
  }

  /**
   * Obtém lista de tenants ativos
   */
  private async getActiveTenants() {
    return this.prisma.tenant.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, settings: true },
    });
  }

  /**
   * Job 1: COMPONENT_HEALTH_YELLOW - Daily 06:00
   * Verifica componentes que atingiram 80%+ do limite
   * Otimizado: paraleliza por tenant + batch insert de alertas
   */
  @Cron('0 6 * * *')
  async checkComponentHealth() {
    const startTime = Date.now();
    this.logger.log('Running checkComponentHealth...');

    try {
      const tenants = await this.getActiveTenants();
      this.logger.log(
        `checkComponentHealth: ${tenants.length} tenants to process`,
      );

      await this.processTenantsInParallel(tenants, async (tenant) => {
        try {
          const cyclesNeedingAlert = await this.prisma.$queryRaw<
            {
              id: string;
              barrelId: string;
              healthPercentage: number;
              componentName: string;
              criticality: string;
              barrelInternalCode: string;
            }[]
          >`
            SELECT
              cc."id",
              cc."barrelId",
              COALESCE(cc."healthPercentage", 0) AS "healthPercentage",
              cfg."name" AS "componentName",
              cfg."criticality",
              b."internalCode" AS "barrelInternalCode"
            FROM component_cycles cc
            JOIN barrels b ON b."id" = cc."barrelId"
            JOIN component_configs cfg ON cfg."id" = cc."componentConfigId"
            LEFT JOIN alerts a ON a."tenantId" = ${tenant.id}::uuid
              AND a."barrelId" = cc."barrelId"
              AND a."alertType" = 'COMPONENT_END_OF_LIFE'::"AlertType"
              AND a."status" != 'RESOLVED'::"AlertStatus"
            WHERE cc."healthScore" = 'YELLOW'::"HealthScore"
              AND b."tenantId" = ${tenant.id}::uuid
              AND b."status" = 'ACTIVE'::"BarrelStatus"
              AND b."deletedAt" IS NULL
              AND a."id" IS NULL
          `;

          if (cyclesNeedingAlert.length === 0) return;

          await this.prisma.alert.createMany({
            data: cyclesNeedingAlert.map((cycle) => ({
              tenantId: tenant.id,
              barrelId: cycle.barrelId,
              alertType: AlertType.COMPONENT_END_OF_LIFE,
              priority:
                cycle.criticality === 'CRITICAL'
                  ? AlertPriority.HIGH
                  : AlertPriority.MEDIUM,
              title: `Component ${cycle.componentName} nearing limit`,
              description: `Component at ${cycle.healthPercentage}% of limit on barrel ${cycle.barrelInternalCode}`,
              metadata: {
                componentName: cycle.componentName,
                healthPercentage: cycle.healthPercentage,
              },
            })),
            skipDuplicates: true,
          });

          this.logger.log(
            `Tenant ${tenant.id}: ${cyclesNeedingAlert.length} component alerts created`,
          );
        } catch (error) {
          this.logger.error(
            `Error processing component health for tenant ${tenant.id}`,
            (error as Error).stack,
          );
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(`checkComponentHealth completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `checkComponentHealth FAILED after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Job 2: BARREL_IDLE_AT_CLIENT - Daily 08:00
   * Barris parados no cliente por mais de N dias (padrão: 15)
   * Otimizado: query SQL com LEFT JOIN para excluir alertas existentes + batch insert
   */
  @Cron('0 8 * * *')
  async checkIdleBarrels() {
    const startTime = Date.now();
    this.logger.log('Running checkIdleBarrels...');

    try {
      const tenants = await this.getActiveTenants();
      this.logger.log(`checkIdleBarrels: ${tenants.length} tenants to process`);

      await this.processTenantsInParallel(tenants, async (tenant) => {
        try {
          const thresholdDays = tenant.settings?.idleThresholdDays || 15;
          const threshold = new Date(
            Date.now() - thresholdDays * 24 * 60 * 60 * 1000,
          );

          const idleBarrels = await this.prisma.$queryRaw<
            {
              id: string;
              internalCode: string;
            }[]
          >`
            SELECT b."id", b."internalCode"
            FROM barrels b
            LEFT JOIN alerts a ON a."tenantId" = ${tenant.id}::uuid
              AND a."barrelId" = b."id"
              AND a."alertType" = 'IDLE_AT_CLIENT'::"AlertType"
              AND a."status" != 'RESOLVED'::"AlertStatus"
            WHERE b."tenantId" = ${tenant.id}::uuid
              AND b."status" = 'AT_CLIENT'::"BarrelStatus"
              AND b."lastEventAt" < ${threshold}
              AND b."deletedAt" IS NULL
              AND a."id" IS NULL
          `;

          if (idleBarrels.length === 0) return;

          await this.prisma.alert.createMany({
            data: idleBarrels.map((barrel) => ({
              tenantId: tenant.id,
              barrelId: barrel.id,
              alertType: AlertType.IDLE_AT_CLIENT,
              priority: AlertPriority.MEDIUM,
              title: `Barrel ${barrel.internalCode} idle at client`,
              description: `No activity for ${thresholdDays}+ days`,
            })),
            skipDuplicates: true,
          });

          this.logger.log(
            `Tenant ${tenant.id}: ${idleBarrels.length} idle barrel alerts created`,
          );
        } catch (error) {
          this.logger.error(
            `Error processing idle barrels for tenant ${tenant.id}`,
            (error as Error).stack,
          );
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(`checkIdleBarrels completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `checkIdleBarrels FAILED after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Job 3: MAINTENANCE_OVERDUE - Daily 07:00
   * Ordens de manutenção pendentes há mais de 7 dias
   * Otimizado: LEFT JOIN para excluir alertas existentes + batch insert
   */
  @Cron('0 7 * * *')
  async checkMaintenanceOverdue() {
    const startTime = Date.now();
    this.logger.log('Running checkMaintenanceOverdue...');

    try {
      const tenants = await this.getActiveTenants();
      this.logger.log(
        `checkMaintenanceOverdue: ${tenants.length} tenants to process`,
      );

      await this.processTenantsInParallel(tenants, async (tenant) => {
        try {
          const overdueThreshold = new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000,
          );

          const overdueOrders = await this.prisma.$queryRaw<
            {
              id: string;
              barrelId: string;
              orderNumber: string;
            }[]
          >`
            SELECT mo."id", mo."barrelId", mo."orderNumber"
            FROM maintenance_orders mo
            LEFT JOIN alerts a ON a."tenantId" = ${tenant.id}::uuid
              AND a."barrelId" = mo."barrelId"
              AND a."alertType" = 'MANDATORY_INSPECTION'::"AlertType"
              AND a."status" != 'RESOLVED'::"AlertStatus"
            WHERE mo."tenantId" = ${tenant.id}::uuid
              AND mo."status" = 'PENDING'::"MaintenanceOrderStatus"
              AND mo."createdAt" < ${overdueThreshold}
              AND mo."deletedAt" IS NULL
              AND a."id" IS NULL
          `;

          if (overdueOrders.length === 0) return;

          await this.prisma.alert.createMany({
            data: overdueOrders.map((order) => ({
              tenantId: tenant.id,
              barrelId: order.barrelId,
              alertType: AlertType.MANDATORY_INSPECTION,
              priority: AlertPriority.HIGH,
              title: `Maintenance order ${order.orderNumber} overdue`,
              description: `Pending for 7+ days`,
            })),
            skipDuplicates: true,
          });

          this.logger.log(
            `Tenant ${tenant.id}: ${overdueOrders.length} maintenance overdue alerts created`,
          );
        } catch (error) {
          this.logger.error(
            `Error processing maintenance overdue for tenant ${tenant.id}`,
            (error as Error).stack,
          );
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(`checkMaintenanceOverdue completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `checkMaintenanceOverdue FAILED after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Job 4: BARREL_LOST - Daily 09:00
   * Barris sem atividade por 60+ dias → marcar como LOST
   * Otimizado: batch update de status + batch insert de alertas
   */
  @Cron('0 9 * * *')
  async checkLostBarrels() {
    const startTime = Date.now();
    this.logger.log('Running checkLostBarrels...');

    try {
      const threshold = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      const tenants = await this.getActiveTenants();
      this.logger.log(`checkLostBarrels: ${tenants.length} tenants to process`);

      await this.processTenantsInParallel(tenants, async (tenant) => {
        try {
          const lostBarrels = await this.prisma.$queryRaw<
            {
              id: string;
              internalCode: string;
            }[]
          >`
            SELECT b."id", b."internalCode"
            FROM barrels b
            WHERE b."tenantId" = ${tenant.id}::uuid
              AND b."status" IN ('AT_CLIENT'::"BarrelStatus", 'IN_TRANSIT'::"BarrelStatus")
              AND b."lastEventAt" < ${threshold}
              AND b."deletedAt" IS NULL
          `;

          if (lostBarrels.length === 0) return;

          const lostIds = lostBarrels.map((b) => b.id);

          await this.prisma.barrel.updateMany({
            where: { id: { in: lostIds } },
            data: { status: BarrelStatus.LOST },
          });

          await this.prisma.alert.createMany({
            data: lostBarrels.map((barrel) => ({
              tenantId: tenant.id,
              barrelId: barrel.id,
              alertType: AlertType.DISPOSAL_SUGGESTED,
              priority: AlertPriority.CRITICAL,
              title: `Barrel ${barrel.internalCode} marked as lost`,
              description: `No activity for 60+ days`,
            })),
            skipDuplicates: true,
          });

          this.logger.log(
            `Tenant ${tenant.id}: ${lostBarrels.length} barrels marked as lost`,
          );
        } catch (error) {
          this.logger.error(
            `Error processing lost barrels for tenant ${tenant.id}`,
            (error as Error).stack,
          );
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(`checkLostBarrels completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `checkLostBarrels FAILED after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Job 5: GEOFENCE_VIOLATION - Hourly
   * Verifica se entregas recentes estão fora do geofence do cliente
   * Otimizado: batch query de geofences + processamento em memória (dataset pequeno por hora)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkGeofenceViolations() {
    const startTime = Date.now();
    this.logger.log('Running checkGeofenceViolations...');

    try {
      const tenants = await this.getActiveTenants();
      this.logger.log(
        `checkGeofenceViolations: ${tenants.length} tenants to process`,
      );

      await this.processTenantsInParallel(tenants, async (tenant) => {
        try {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

          const recentDeliveries = await this.prisma.logisticsEvent.findMany({
            where: {
              tenantId: tenant.id,
              actionType: 'DELIVERY',
              timestamp: { gt: oneHourAgo },
              clientId: { not: null },
            },
            include: {
              barrel: { select: { internalCode: true } },
            },
          });

          if (recentDeliveries.length === 0) return;

          const clientIds = [
            ...new Set(recentDeliveries.map((e) => e.clientId!)),
          ];
          const geofences = await this.prisma.geofence.findMany({
            where: { clientId: { in: clientIds }, deletedAt: null },
          });
          const geofenceByClient = new Map(
            geofences.map((g) => [g.clientId, g]),
          );

          const alertsToCreate: Array<{
            tenantId: string;
            barrelId: string;
            alertType: AlertType;
            priority: AlertPriority;
            title: string;
            description: string;
            metadata: any;
          }> = [];

          for (const event of recentDeliveries) {
            const geofence = geofenceByClient.get(event.clientId);
            if (!geofence) continue;

            const distance = this.haversineDistance(
              Number(event.latitude),
              Number(event.longitude),
              Number(geofence.latitude),
              Number(geofence.longitude),
            );

            if (distance > geofence.radiusMeters) {
              alertsToCreate.push({
                tenantId: tenant.id,
                barrelId: event.barrelId,
                alertType: AlertType.GEOFENCE_VIOLATION,
                priority: AlertPriority.HIGH,
                title: `Barrel ${event.barrel.internalCode} delivered outside geofence`,
                description: `${Math.round(distance)}m from ${geofence.name} (limit: ${geofence.radiusMeters}m)`,
                metadata: { distance, geofenceName: geofence.name },
              });
            }
          }

          if (alertsToCreate.length > 0) {
            await this.prisma.alert.createMany({
              data: alertsToCreate,
              skipDuplicates: true,
            });
            this.logger.log(
              `Tenant ${tenant.id}: ${alertsToCreate.length} geofence violations detected`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error processing geofence violations for tenant ${tenant.id}`,
            (error as Error).stack,
          );
        }
      });

      const duration = Date.now() - startTime;
      this.logger.log(`checkGeofenceViolations completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `checkGeofenceViolations FAILED after ${duration}ms: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Job 6: GPS_OFFLINE - Every 6 hours
   * Phase 2: Will check GPS device battery/signal on barrels with IoT hardware
   */
  @Cron('0 */6 * * *')
  checkGpsOffline() {
    if (!this.config.get<boolean>('ENABLE_PHASE2_CRONS', false)) {
      this.logger.log(
        'GPS offline check skipped — GPS/IoT integration pending (Phase 2)',
      );
      return;
    }
    this.logger.log('Running GPS offline check...');
  }

  /**
   * Job 7: CACHE_REFRESH - Every 5 min (Phase 2: Redis cache for dashboard metrics)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  refreshCache() {
    if (!this.config.get<boolean>('ENABLE_PHASE2_CRONS', false)) {
      this.logger.log(
        'Cache refresh skipped — Redis integration pending (Phase 2)',
      );
      return;
    }
    this.logger.log('Running dashboard cache refresh...');
  }

  /**
   * Helper: Haversine distance in meters
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
