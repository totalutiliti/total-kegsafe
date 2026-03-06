import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
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

  // ── Audit Log ───────────────────────────────────────────

  @Get('audit-logs')
  async getAuditLogs(@Query() query: PaginationQueryDto) {
    return this.superAdminService.getAuditLogs(query);
  }
}
