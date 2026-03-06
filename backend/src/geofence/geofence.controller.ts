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
import { GeofenceService } from './geofence.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { CreateGeofenceDto } from './dto/create-geofence.dto.js';
import { UpdateGeofenceDto } from './dto/update-geofence.dto.js';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto.js';

@Controller('geofences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS)
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.geofenceService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.geofenceService.findById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateGeofenceDto,
  ) {
    return this.geofenceService.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGeofenceDto,
  ) {
    return this.geofenceService.update(tenantId, id, dto, userId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.geofenceService.delete(tenantId, id);
  }
}
