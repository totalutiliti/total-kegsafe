import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SupplierService } from './supplier.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role } from '@prisma/client';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
    constructor(private readonly supplierService: SupplierService) { }

    // Suppliers
    @Get('suppliers')
    async findAllSuppliers(@TenantId() tenantId: string) {
        return this.supplierService.findAllSuppliers(tenantId);
    }

    @Get('suppliers/:id')
    async findSupplierById(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.supplierService.findSupplierById(tenantId, id);
    }

    @Post('suppliers')
    @Roles(Role.ADMIN)
    async createSupplier(@TenantId() tenantId: string, @Body() data: any) {
        return this.supplierService.createSupplier(tenantId, data);
    }

    @Patch('suppliers/:id')
    @Roles(Role.ADMIN)
    async updateSupplier(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
        return this.supplierService.updateSupplier(tenantId, id, data);
    }

    @Delete('suppliers/:id')
    @Roles(Role.ADMIN)
    async deleteSupplier(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.supplierService.deleteSupplier(tenantId, id);
    }

    // Service Providers
    @Get('service-providers')
    async findAllProviders(@TenantId() tenantId: string) {
        return this.supplierService.findAllProviders(tenantId);
    }

    @Get('service-providers/:id')
    async findProviderById(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.supplierService.findProviderById(tenantId, id);
    }

    @Post('service-providers')
    @Roles(Role.ADMIN)
    async createProvider(@TenantId() tenantId: string, @Body() data: any) {
        return this.supplierService.createProvider(tenantId, data);
    }

    @Patch('service-providers/:id')
    @Roles(Role.ADMIN)
    async updateProvider(@TenantId() tenantId: string, @Param('id') id: string, @Body() data: any) {
        return this.supplierService.updateProvider(tenantId, id, data);
    }

    @Delete('service-providers/:id')
    @Roles(Role.ADMIN)
    async deleteProvider(@TenantId() tenantId: string, @Param('id') id: string) {
        return this.supplierService.deleteProvider(tenantId, id);
    }
}
