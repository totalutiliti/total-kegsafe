import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DegradationService } from './degradation.service.js';
import { setDegradationServiceRef } from './degradation.decorator.js';

@Global()
@Module({
  providers: [DegradationService],
  exports: [DegradationService],
})
export class DegradationModule implements OnModuleInit {
  constructor(private readonly degradation: DegradationService) {}

  onModuleInit(): void {
    // Wire the singleton reference so the @Degradable decorator can access the service
    setDegradationServiceRef(this.degradation);
  }
}
