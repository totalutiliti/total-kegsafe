import { Module } from '@nestjs/common';
import { LogisticsService } from './logistics.service.js';
import { LogisticsController } from './logistics.controller.js';
import { BarrelModule } from '../barrel/barrel.module.js';
import { ComponentModule } from '../component/component.module.js';
import { GeofenceModule } from '../geofence/geofence.module.js';

@Module({
  imports: [BarrelModule, ComponentModule, GeofenceModule],
  providers: [LogisticsService],
  controllers: [LogisticsController],
  exports: [LogisticsService],
})
export class LogisticsModule {}
