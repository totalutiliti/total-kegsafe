import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { HashingService } from '../shared/services/hashing.service.js';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';
import { BusinessException } from '../shared/exceptions/business.exception.js';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
  ) {}

  async findAll(tenantId: string, page?: number, limit?: number) {
    const where = { tenantId, deletedAt: null };
    const select = {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    };

    // If no pagination params, return paginated response with defaults
    const p = page && page > 0 ? page : 1;
    const l = limit && limit > 0 ? Math.min(limit, 100) : 20;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select,
        skip: (p - 1) * l,
        take: l,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    };
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }
    return user;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existing) {
      throw new ResourceAlreadyExistsException('User', 'email', dto.email);
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    return this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        phone: dto.phone,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    const user = await this.findById(tenantId, id);

    // Protect last admin from role change
    if (dto.role && dto.role !== 'ADMIN' && user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'ADMIN', isActive: true, deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new BusinessException(
          'CANNOT_CHANGE_LAST_ADMIN_ROLE',
          'Cannot change the role of the last admin user',
          400,
        );
      }
    }

    const { password, ...updateFields } = dto;
    const data: Record<string, unknown> = { ...updateFields };
    if (password) {
      data.passwordHash = await this.hashingService.hash(password);
    }
    return this.prisma.user.update({
      where: { id },
      data: data as Prisma.UserUpdateInput,
    });
  }

  async unlockAccount(tenantId: string, id: string) {
    const user = await this.findById(tenantId, id);

    if (!user.lockedUntil && user.failedLoginAttempts === 0) {
      throw new BusinessException(
        'ACCOUNT_NOT_LOCKED',
        'This account is not locked',
        400,
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return { message: 'Account unlocked successfully' };
  }

  async deactivate(tenantId: string, id: string) {
    const user = await this.findById(tenantId, id);

    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'ADMIN', isActive: true, deletedAt: null },
      });
      if (adminCount <= 1) {
        throw new BusinessException(
          'CANNOT_DEACTIVATE_LAST_ADMIN',
          'Não é possível inativar o último administrador',
          400,
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!user) throw new ResourceNotFoundException('User', id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async delete(tenantId: string, id: string) {
    const user = await this.findById(tenantId, id);

    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'ADMIN', isActive: true },
      });
      if (adminCount <= 1) {
        throw new BusinessException(
          'CANNOT_DELETE_LAST_ADMIN',
          'Cannot delete the last admin user',
          400,
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
