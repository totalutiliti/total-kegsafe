import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service.js';

@Injectable()
export class MaintenanceJobsService {
  private readonly logger = new Logger(MaintenanceJobsService.name);

  constructor(private readonly maintenanceService: MaintenanceService) {}

  /**
   * Job: Activate scheduled maintenance orders
   * Runs daily at 05:00 — checks for OS with scheduledDate <= now
   * and moves their barrels to IN_MAINTENANCE status.
   */
  @Cron('0 5 * * *')
  async activateScheduledOrders() {
    const startTime = Date.now();
    this.logger.log('Starting scheduled maintenance activation...');

    try {
      const count = await this.maintenanceService.activateScheduledOrders();
      const duration = Date.now() - startTime;
      this.logger.log(
        `Scheduled maintenance activation completed: ${count} orders activated in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('Failed to activate scheduled orders', error);
    }
  }
}
