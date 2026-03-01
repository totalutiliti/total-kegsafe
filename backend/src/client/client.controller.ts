import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ClientService } from './client.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { CreateClientDto } from './dto/create-client.dto.js';

@Controller('api/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientController {
    constructor(private readonly clientService: ClientService) { }

    @Get()
    @Roles(Role.ADMIN, Role.MANAGER)
    async findAll(@TenantId() tenantId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
        return this.clientService.findAll(tenantId, { page, limit });
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.MANAGER)
    async findById(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.clientService.findById(tenantId, id);
    }

    @Post()
    @Roles(Role.ADMIN, Role.MANAGER)
    async create(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Body() dto: CreateClientDto) {
        return this.clientService.create(tenantId, dto, userId);
    }

    @Patch(':id')
    @Roles(Role.ADMIN, Role.MANAGER)
    async update(@TenantId() tenantId: string, @CurrentUser('id') userId: string, @Param('id') id: string, @Body() data: any) {
        return this.clientService.update(tenantId, id, data, userId);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    async delete(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.clientService.delete(tenantId, id);
    }
}
