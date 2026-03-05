import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
} from '@nestjs/common';
import type { IMaintenanceService } from './maintenance.service.interface.js';
import { MAINTENANCE_SERVICE } from './maintenance.constants.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role, MaintenanceOrderStatus } from '@prisma/client';
import { CreateMaintenanceOrderDto } from './dto/create-maintenance-order.dto.js';
import { CreateChecklistDto } from './dto/create-checklist.dto.js';
import { CreateTriageDto } from './dto/create-triage.dto.js';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(
    @Inject(MAINTENANCE_SERVICE)
    private readonly maintenanceService: IMaintenanceService,
  ) {}

  @Get('orders')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findAllOrders(
    @TenantId() tenantId: string,
    @Query('status') status?: MaintenanceOrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.maintenanceService.findAllOrders(tenantId, {
      status,
      page,
      limit,
    });
  }

  @Get('orders/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findOrderById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.maintenanceService.findOrderById(tenantId, id);
  }

  @Post('orders')
  @Roles(Role.MAINTENANCE, Role.ADMIN)
  async createOrder(
    @TenantId() tenantId: string,
    @Body() dto: CreateMaintenanceOrderDto,
  ) {
    return this.maintenanceService.createOrder(tenantId, dto);
  }

  @Post('checklist')
  @Roles(Role.MAINTENANCE, Role.ADMIN)
  async registerChecklist(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChecklistDto,
  ) {
    return this.maintenanceService.registerChecklist(tenantId, userId, dto);
  }

  @Post('triage')
  @Roles(Role.MAINTENANCE, Role.ADMIN)
  async registerTriage(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTriageDto,
  ) {
    return this.maintenanceService.registerTriage(tenantId, userId, dto);
  }
}
