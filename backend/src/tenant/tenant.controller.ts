import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role } from '@prisma/client';

@Controller('api/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    @Get('current')
    async getCurrent(@TenantId() tenantId: string) {
        return this.tenantService.findById(tenantId);
    }

    @Patch('current')
    @Roles(Role.ADMIN)
    async updateCurrent(@TenantId() tenantId: string, @Body() data: any) {
        return this.tenantService.update(tenantId, data);
    }
}
