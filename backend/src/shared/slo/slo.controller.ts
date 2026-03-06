import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { SloService } from './slo.service.js';
import type { EndpointReport, ErrorBudgetReport } from './slo.service.js';

@Controller('admin/slo')
@Roles(Role.ADMIN)
export class SloController {
  constructor(private readonly sloService: SloService) {}

  /**
   * GET /api/v1/admin/slo
   * Returns SLO metrics for all endpoints or a specific one.
   */
  @Get()
  getMetrics(@Query('endpoint') endpoint?: string): EndpointReport[] {
    return this.sloService.getMetrics(endpoint);
  }

  /**
   * GET /api/v1/admin/slo/budget
   * Returns current error budget status.
   */
  @Get('budget')
  getErrorBudget(): ErrorBudgetReport {
    return this.sloService.getErrorBudget();
  }
}
