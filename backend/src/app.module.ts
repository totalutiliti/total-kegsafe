import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { SharedModule } from './shared/shared.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TenantModule } from './tenant/tenant.module.js';
import { UserModule } from './user/user.module.js';
import { BarrelModule } from './barrel/barrel.module.js';
import { ComponentModule } from './component/component.module.js';
import { ClientModule } from './client/client.module.js';
import { SupplierModule } from './supplier/supplier.module.js';
import { LogisticsModule } from './logistics/logistics.module.js';
import { GeofenceModule } from './geofence/geofence.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { AlertModule } from './alert/alert.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DisposalModule } from './disposal/disposal.module.js';
import { HealthModule } from './health/health.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { RequestLoggerMiddleware } from './shared/middleware/request-logger.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    // Rate limiting — 100 requests per 60 seconds per IP (auth endpoints override with stricter limits)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    SharedModule,
    PrismaModule,
    AuthModule,
    TenantModule,
    UserModule,
    BarrelModule,
    ComponentModule,
    ClientModule,
    SupplierModule,
    LogisticsModule,
    GeofenceModule,
    MaintenanceModule,
    AlertModule,
    DashboardModule,
    DisposalModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
