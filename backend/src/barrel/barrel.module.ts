import { Module } from '@nestjs/common';
import { BarrelService } from './barrel.service.js';
import { BarrelController } from './barrel.controller.js';

@Module({
    providers: [BarrelService],
    controllers: [BarrelController],
    exports: [BarrelService],
})
export class BarrelModule { }
