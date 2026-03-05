import { Module } from '@nestjs/common';
import { BarrelService } from './barrel.service.js';
import { BarrelController } from './barrel.controller.js';
import { BARREL_SERVICE } from './barrel.constants.js';

@Module({
  providers: [
    BarrelService,
    { provide: BARREL_SERVICE, useExisting: BarrelService },
  ],
  controllers: [BarrelController],
  exports: [BarrelService, BARREL_SERVICE],
})
export class BarrelModule {}
