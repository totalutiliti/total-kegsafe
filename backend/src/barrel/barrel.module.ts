import { Module } from '@nestjs/common';
import { BarrelService } from './barrel.service.js';
import { BarrelController } from './barrel.controller.js';

/** Injection token for IBarrelService — use with @Inject(BARREL_SERVICE) */
export const BARREL_SERVICE = 'BARREL_SERVICE';

@Module({
  providers: [
    BarrelService,
    { provide: BARREL_SERVICE, useClass: BarrelService },
  ],
  controllers: [BarrelController],
  exports: [BarrelService, BARREL_SERVICE],
})
export class BarrelModule {}
