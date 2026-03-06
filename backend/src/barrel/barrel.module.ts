import { Module } from '@nestjs/common';
import { BarrelService } from './barrel.service.js';
import { BarrelController } from './barrel.controller.js';
import { BARREL_SERVICE } from './barrel.constants.js';
import { AlertModule } from '../alert/alert.module.js';
import { ComponentModule } from '../component/component.module.js';

@Module({
  imports: [AlertModule, ComponentModule],
  providers: [
    BarrelService,
    { provide: BARREL_SERVICE, useExisting: BarrelService },
  ],
  controllers: [BarrelController],
  exports: [BarrelService, BARREL_SERVICE],
})
export class BarrelModule {}
