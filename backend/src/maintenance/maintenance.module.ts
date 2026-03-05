import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service.js';
import { MaintenanceController } from './maintenance.controller.js';
import { ComponentModule } from '../component/component.module.js';

/** Injection token for IMaintenanceService — use with @Inject(MAINTENANCE_SERVICE) */
export const MAINTENANCE_SERVICE = 'MAINTENANCE_SERVICE';

@Module({
  imports: [ComponentModule],
  providers: [
    MaintenanceService,
    { provide: MAINTENANCE_SERVICE, useClass: MaintenanceService },
  ],
  controllers: [MaintenanceController],
  exports: [MaintenanceService, MAINTENANCE_SERVICE],
})
export class MaintenanceModule {}
