import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role } from '@prisma/client';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER, Role.ADMIN)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('fleet-health')
  async getFleetHealth(@TenantId() tenantId: string) {
    return this.dashboardService.getFleetHealth(tenantId);
  }

  @Get('cost-per-liter')
  async getCostPerLiter(@TenantId() tenantId: string) {
    return this.dashboardService.getCostPerLiter(tenantId);
  }

  @Get('asset-turnover')
  async getAssetTurnover(@TenantId() tenantId: string) {
    return this.dashboardService.getAssetTurnover(tenantId);
  }

  @Get('loss-report')
  async getLossReport(@TenantId() tenantId: string) {
    return this.dashboardService.getLossReport(tenantId);
  }
}
