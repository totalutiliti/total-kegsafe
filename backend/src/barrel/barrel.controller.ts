import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BarrelService } from './barrel.service.js';
import { CreateBarrelDto } from './dto/create-barrel.dto.js';
import { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role, BarrelStatus } from '@prisma/client';

@Controller('api/barrels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarrelController {
    constructor(private readonly barrelService: BarrelService) { }

    @Get()
    async findAll(
        @TenantId() tenantId: string,
        @Query('status') status?: BarrelStatus,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('search') search?: string,
    ) {
        return this.barrelService.findAll(tenantId, { status, page, limit, search });
    }

    @Get(':id')
    async findById(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.barrelService.findById(tenantId, id);
    }

    @Get('qr/:qrCode')
    async findByQrCode(@TenantId() tenantId: string, @Param('qrCode') qrCode: string) {
        return this.barrelService.findByQrCode(tenantId, qrCode);
    }

    @Get(':id/timeline')
    async getTimeline(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.barrelService.getTimeline(tenantId, id);
    }

    @Post()
    @Roles(Role.ADMIN, Role.MANAGER)
    async create(@TenantId() tenantId: string, @Body() dto: CreateBarrelDto) {
        return this.barrelService.create(tenantId, dto);
    }

    @Patch(':id')
    @Roles(Role.ADMIN, Role.MANAGER)
    async update(@TenantId() tenantId: string, @Param('id') id: string, @Body() dto: UpdateBarrelDto) {
        return this.barrelService.update(tenantId, id, dto);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async delete(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.barrelService.delete(tenantId, id);
    }
}
