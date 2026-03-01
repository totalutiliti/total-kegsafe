import { Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service.js';
import { GeofenceController } from './geofence.controller.js';

@Module({
    providers: [GeofenceService],
    controllers: [GeofenceController],
    exports: [GeofenceService],
})
export class GeofenceModule { }
