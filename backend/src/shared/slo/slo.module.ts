import { Global, Module } from '@nestjs/common';
import { SloService } from './slo.service.js';
import { SloInterceptor } from './slo.interceptor.js';
import { SloController } from './slo.controller.js';

@Global()
@Module({
  controllers: [SloController],
  providers: [SloService, SloInterceptor],
  exports: [SloService, SloInterceptor],
})
export class SloModule {}
