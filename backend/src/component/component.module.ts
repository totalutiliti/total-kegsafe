import { Module } from '@nestjs/common';
import { ComponentService } from './component.service.js';
import { ComponentController } from './component.controller.js';

@Module({
  providers: [ComponentService],
  controllers: [ComponentController],
  exports: [ComponentService],
})
export class ComponentModule {}
