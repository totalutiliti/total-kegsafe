import { Module } from '@nestjs/common';
import { DisposalService } from './disposal.service.js';
import { DisposalController } from './disposal.controller.js';

@Module({
  providers: [DisposalService],
  controllers: [DisposalController],
  exports: [DisposalService],
})
export class DisposalModule {}
