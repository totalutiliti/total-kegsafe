import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DisposalService } from './disposal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { CreateDisposalDto } from './dto/create-disposal.dto.js';
import { CompleteDisposalDto } from './dto/complete-disposal.dto.js';

@Controller('disposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisposalController {
  constructor(private readonly disposalService: DisposalService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findAll(@TenantId() tenantId: string) {
    return this.disposalService.findAll(tenantId);
  }

  @Get('suggestions')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async getSuggestions(@TenantId() tenantId: string) {
    return this.disposalService.getSuggestions(tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.disposalService.findById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisposalDto,
  ) {
    return this.disposalService.create(tenantId, userId, dto);
  }

  @Post(':id/approve')
  @Roles(Role.MANAGER, Role.ADMIN)
  async approve(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.disposalService.approve(tenantId, id, userId);
  }

  @Post(':id/complete')
  @Roles(Role.ADMIN)
  async complete(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CompleteDisposalDto,
  ) {
    return this.disposalService.complete(tenantId, id, dto);
  }
}
