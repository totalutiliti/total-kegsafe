import { Module } from '@nestjs/common';
import { AlertService } from './alert.service.js';
import { AlertController } from './alert.controller.js';
import { AlertJobsService } from './alert-jobs.service.js';
import { ComponentModule } from '../component/component.module.js';
import { GeofenceModule } from '../geofence/geofence.module.js';

@Module({
    imports: [ComponentModule, GeofenceModule],
    providers: [AlertService, AlertJobsService],
    controllers: [AlertController],
    exports: [AlertService],
})
export class AlertModule { }
