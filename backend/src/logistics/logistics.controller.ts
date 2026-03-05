import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { LogisticsService } from './logistics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';
import { ExpeditionDto } from './dto/expedition.dto.js';
import { DeliveryDto } from './dto/delivery.dto.js';
import { CollectionDto } from './dto/collection.dto.js';
import { ReceptionDto } from './dto/reception.dto.js';

@Controller('logistics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('expedition')
  @Roles(Role.LOGISTICS, Role.ADMIN)
  async expedition(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ExpeditionDto,
  ) {
    return this.logisticsService.expedition(tenantId, userId, dto);
  }

  @Post('delivery')
  @Roles(Role.LOGISTICS, Role.ADMIN)
  async delivery(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DeliveryDto,
  ) {
    return this.logisticsService.delivery(tenantId, userId, dto);
  }

  @Post('collection')
  @Roles(Role.LOGISTICS, Role.ADMIN)
  async collection(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CollectionDto,
  ) {
    return this.logisticsService.collection(tenantId, userId, dto);
  }

  @Post('reception')
  @Roles(Role.LOGISTICS, Role.ADMIN)
  async reception(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReceptionDto,
  ) {
    return this.logisticsService.reception(tenantId, userId, dto);
  }
}
