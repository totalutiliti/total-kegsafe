import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from './report.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('assets')
  async getAssetReport(@TenantId() tenantId: string) {
    return this.reportService.getAssetReport(tenantId);
  }

  @Get('assets/csv')
  async getAssetReportCsv(@TenantId() tenantId: string, @Res() res: Response) {
    const data = await this.reportService.getAssetReport(tenantId);
    const flat = data.map(({ components, ...rest }) => ({
      ...rest,
      componentCount: components.length,
      redComponents: components.filter((c) => c.healthScore === 'RED').length,
    }));
    const csv = this.reportService.exportToCsv(flat);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=assets-report.csv',
    );
    res.send(csv);
  }

  @Get('maintenance')
  async getMaintenanceReport(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportService.getMaintenanceReport(tenantId, { from, to });
  }

  @Get('maintenance/csv')
  async getMaintenanceReportCsv(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const data = await this.reportService.getMaintenanceReport(tenantId, {
      from,
      to,
    });
    const csv = this.reportService.exportToCsv(data);
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader(
      'Content-Disposition',
      'attachment; filename=maintenance-report.csv',
    );
    res!.send(csv);
  }

  @Get('disposals')
  async getDisposalReport(@TenantId() tenantId: string) {
    return this.reportService.getDisposalReport(tenantId);
  }

  @Get('disposals/csv')
  async getDisposalReportCsv(
    @TenantId() tenantId: string,
    @Res() res: Response,
  ) {
    const data = await this.reportService.getDisposalReport(tenantId);
    const csv = this.reportService.exportToCsv(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=disposals-report.csv',
    );
    res.send(csv);
  }

  @Get('components')
  async getComponentReport(@TenantId() tenantId: string) {
    return this.reportService.getComponentReport(tenantId);
  }

  @Get('components/csv')
  async getComponentReportCsv(
    @TenantId() tenantId: string,
    @Res() res: Response,
  ) {
    const data = await this.reportService.getComponentReport(tenantId);
    const csv = this.reportService.exportToCsv(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=components-report.csv',
    );
    res.send(csv);
  }

  @Get('loss-analysis')
  async getLossAnalysis(@TenantId() tenantId: string) {
    return this.reportService.getLossAnalysis(tenantId);
  }

  @Get('anomalies')
  async getAnomalyReport(@TenantId() tenantId: string) {
    return this.reportService.getAnomalyReport(tenantId);
  }

  @Get('big-numbers')
  async getBigNumbers(@TenantId() tenantId: string) {
    return this.reportService.getBigNumbers(tenantId);
  }
}
