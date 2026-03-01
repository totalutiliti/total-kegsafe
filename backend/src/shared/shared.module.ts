import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { GlobalExceptionFilter } from './filters/http-exception.filter.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';
import { StructuredLogger } from './services/logger.service.js';

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
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },

        {
            provide: APP_INTERCEPTOR,
            useClass: AuditInterceptor,
        },
    ],
    exports: [StructuredLogger],
})
export class SharedModule { }
