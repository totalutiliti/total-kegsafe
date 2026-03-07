import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ComponentService } from './component.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Criticality, Role } from '@prisma/client';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto.js';

@Controller('components')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComponentController {
  constructor(private readonly componentService: ComponentService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.componentService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.componentService.findById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(
    @TenantId() tenantId: string,
    @Body()
    data: {
      name: string;
      description?: string;
      maxCycles: number;
      maxDays: number;
      criticality: string;
      alertThreshold?: number;
      averageReplacementCost?: number;
    },
  ) {
    return this.componentService.create(tenantId, data);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      description?: string;
      maxCycles?: number;
      maxDays?: number;
      criticality?: Criticality;
      alertThreshold?: number;
      averageReplacementCost?: number;
      isActive?: boolean;
    },
  ) {
    return this.componentService.update(tenantId, id, data);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  async deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.componentService.deactivate(tenantId, id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.componentService.delete(tenantId, id);
  }
}
