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
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(Role.ADMIN)
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isActive') isActive?: string,
  ) {
    return this.userService.findAll(
      tenantId,
      page ? +page : undefined,
      limit ? +limit : undefined,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.findById(tenantId, id);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@TenantId() tenantId: string, @Body() dto: CreateUserDto) {
    return this.userService.create(tenantId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(tenantId, id, dto);
  }

  @Post(':id/unlock')
  @Roles(Role.ADMIN)
  async unlockAccount(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.unlockAccount(tenantId, id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  async deactivate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.deactivate(tenantId, id);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN)
  async activate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.activate(tenantId, id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.userService.delete(tenantId, id);
  }
}
