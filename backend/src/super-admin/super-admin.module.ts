import { Module } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service.js';
import { SuperAdminController } from './super-admin.controller.js';

@Module({
  providers: [SuperAdminService],
  controllers: [SuperAdminController],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
