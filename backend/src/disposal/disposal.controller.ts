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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DisposalService } from './disposal.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role, DisposalStatus } from '@prisma/client';
import { CreateDisposalDto } from './dto/create-disposal.dto.js';
import { UpdateDisposalDto } from './dto/update-disposal.dto.js';
import { CompleteDisposalDto } from './dto/complete-disposal.dto.js';
import { PaginationQueryDto } from '../shared/dto/pagination-query.dto.js';

@Controller('disposals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisposalController {
  constructor(private readonly disposalService: DisposalService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: DisposalStatus,
    @Query('barrelId') barrelId?: string,
    @Query('search') search?: string,
  ) {
    return this.disposalService.findAll(tenantId, {
      ...query,
      status,
      barrelId,
      search,
    });
  }

  @Get('suggestions')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getSuggestions(@TenantId() tenantId: string) {
    return this.disposalService.getSuggestions(tenantId);
  }

  @Get('analytics')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getAnalytics(@TenantId() tenantId: string) {
    return this.disposalService.getAnalytics(tenantId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.disposalService.findById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDisposalDto,
  ) {
    return this.disposalService.create(tenantId, userId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDisposalDto,
  ) {
    return this.disposalService.update(tenantId, id, dto);
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

  @Delete(':id/revert')
  @Roles(Role.ADMIN)
  async revert(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.disposalService.revert(tenantId, id);
  }

  @Post(':id/photo')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadPhoto(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.disposalService.uploadPhoto(tenantId, id, file);
  }
}
