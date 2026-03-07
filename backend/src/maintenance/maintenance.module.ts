import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service.js';
import { MaintenanceJobsService } from './maintenance-jobs.service.js';
import { MaintenanceController } from './maintenance.controller.js';
import { ComponentModule } from '../component/component.module.js';
import { MAINTENANCE_SERVICE } from './maintenance.constants.js';

@Module({
  imports: [ComponentModule],
  providers: [
    MaintenanceService,
    MaintenanceJobsService,
    { provide: MAINTENANCE_SERVICE, useExisting: MaintenanceService },
  ],
  controllers: [MaintenanceController],
  exports: [MaintenanceService, MAINTENANCE_SERVICE],
})
export class MaintenanceModule {}
