import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AlertService } from './alert.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';

@Controller('api/alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertController {
    constructor(private readonly alertService: AlertService) { }

    @Get()
    @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
    async findAll(
        @TenantId() tenantId: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('type') type?: string,
        @Query('resolved') resolved?: boolean,
    ) {
        return this.alertService.findAll(tenantId, { page, limit, type, resolved });
    }

    @Get('counts')
    @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
    async getCounts(@TenantId() tenantId: string) {
        return this.alertService.getAlertCounts(tenantId);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
    async findById(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.alertService.findById(tenantId, id);
    }

    @Post(':id/acknowledge')
    @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
    async acknowledge(
        @TenantId() tenantId: string,
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.alertService.acknowledge(tenantId, id, userId);
    }

    @Post(':id/resolve')
    @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
    async resolve(
        @TenantId() tenantId: string,
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body('resolution') resolution?: string,
    ) {
        return this.alertService.resolve(tenantId, id, userId, resolution);
    }
}
