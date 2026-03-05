import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { GlobalExceptionFilter } from './filters/http-exception.filter.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor.js';
import { StructuredLogger } from './services/logger.service.js';
import { HashingService } from './services/hashing.service.js';
import { ExcelService } from './services/excel.service.js';
import { FeatureFlagService } from './services/feature-flag.service.js';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
  ],
  providers: [
    StructuredLogger,
    HashingService,
    ExcelService,
    FeatureFlagService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [StructuredLogger, HashingService, ExcelService, FeatureFlagService],
})
export class SharedModule {}
