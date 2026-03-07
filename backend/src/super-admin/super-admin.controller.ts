import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SuperAdminService } from './super-admin.service.js';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto.js';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto.js';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto.js';
import type { JwtUser } from '../shared/types/authenticated-request.js';

@ApiTags('SuperAdmin')
@Controller('super-admin')
@UseGuards(SuperAdminGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  // ── Tenants ──────────────────────────────────────────────

  @Post('tenants')
  async createTenant(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.createTenant(
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('tenants')
  async listTenants(@Query() query: ListTenantsQueryDto) {
    return this.superAdminService.listTenants(query);
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    return this.superAdminService.getTenantDetail(id);
  }

  @Patch('tenants/:id/status')
  async updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.updateTenantStatus(
      id,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ── Users (cross-tenant) ────────────────────────────────

  @Post('tenants/:tenantId/users')
  async createTenantAdmin(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantAdminDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.createTenantAdmin(
      tenantId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('tenants/:tenantId/users')
  async listTenantUsers(
    @Param('tenantId') tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.superAdminService.listTenantUsers(tenantId, query);
  }

  @Post('users/:userId/reset-password')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async resetPassword(
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.resetUserPassword(
      userId,
      dto,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('users/:userId/unlock')
  async unlockUser(
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.unlockUser(
      userId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ── Barrel Batches ──────────────────────────────────────

  @Get('batches')
  async listBatches(
    @Query() query: PaginationQueryDto & { tenantId?: string },
  ) {
    return this.superAdminService.listBatches(query);
  }

  @Get('batches/stats')
  async getBatchStats() {
    return this.superAdminService.getBatchStats();
  }

  @Post('batches/:batchId/print')
  async printBatch(
    @Param('batchId') batchId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.printBatch(
      batchId,
      user.id,
      body.reason,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('batches/:batchId/export')
  async exportBatch(
    @Param('batchId') batchId: string,
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { csv, printResult } = await this.superAdminService.exportBatch(
      batchId,
      user.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=lote-${batchId}.csv`,
    );
    res.setHeader('X-Print-Count', String(printResult.printCount));
    if (printResult.warning) {
      res.setHeader('X-Print-Warning', printResult.warning);
    }
    res.send(csv);
  }

  // ── Barrel Transfers ──────────────────────────────────────

  @Get('barrels/:barrelId/ownership-history')
  async getOwnershipHistory(@Param('barrelId') barrelId: string) {
    return this.superAdminService.getOwnershipHistory(barrelId);
  }

  @Post('barrels/transfer-batch')
  async transferBatch(
    @Body() body: { barrelIds: string[]; toTenantId: string; notes?: string },
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
  ) {
    return this.superAdminService.transferBatch(
      body.barrelIds,
      body.toTenantId,
      user.id,
      body.notes,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ── Audit Log ───────────────────────────────────────────

  @Get('audit-logs')
  async getAuditLogs(@Query() query: PaginationQueryDto) {
    return this.superAdminService.getAuditLogs(query);
  }
}
