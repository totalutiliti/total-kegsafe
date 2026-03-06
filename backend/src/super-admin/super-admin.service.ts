import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HashingService } from '../shared/services/hashing.service.js';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';
import { BusinessException } from '../shared/exceptions/business.exception.js';
import { Role, Prisma } from '@prisma/client';
import type { CreateTenantDto } from './dto/create-tenant.dto.js';
import type { CreateTenantAdminDto } from './dto/create-tenant-admin.dto.js';
import type { UpdateTenantStatusDto } from './dto/update-tenant-status.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { ListTenantsQueryDto } from './dto/list-tenants-query.dto.js';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
  ) {}

  // ── Tenants ──────────────────────────────────────────────

  async createTenant(
    dto: CreateTenantDto,
    actorId: string,
    ip?: string,
    ua?: string,
  ) {
    // Verificar unicidade de CNPJ e slug
    const existingCnpj = await this.prisma.tenant.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existingCnpj) {
      throw new ResourceAlreadyExistsException('Tenant', 'cnpj', dto.cnpj);
    }

    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ResourceAlreadyExistsException('Tenant', 'slug', dto.slug);
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        cnpj: dto.cnpj,
        logoUrl: dto.logoUrl,
        settings: (dto.settings as Prisma.InputJsonValue) || {},
      },
    });

    await this.logAction(
      actorId,
      'TENANT_CREATED',
      'Tenant',
      tenant.id,
      tenant.id,
      { name: dto.name, slug: dto.slug },
      ip,
      ua,
    );

    return tenant;
  }

  async listTenants(query: ListTenantsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: Prisma.TenantWhereInput = { deletedAt: null };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { cnpj: { contains: query.search } },
      ];
    }

    // Excluir o tenant sistema da listagem
    where.slug = { not: 'kegsafe-system' };

    const [items, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              barrels: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        cnpj: t.cnpj,
        isActive: t.isActive,
        createdAt: t.createdAt,
        userCount: t._count.users,
        barrelCount: t._count.barrels,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTenantDetail(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            barrels: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', id);
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      cnpj: tenant.cnpj,
      logoUrl: tenant.logoUrl,
      isActive: tenant.isActive,
      settings: tenant.settings,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      userCount: tenant._count.users,
      barrelCount: tenant._count.barrels,
    };
  }

  async updateTenantStatus(
    id: string,
    dto: UpdateTenantStatusDto,
    actorId: string,
    ip?: string,
    ua?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', id);
    }

    // Impedir desativação do tenant sistema
    if (tenant.slug === 'kegsafe-system' && !dto.isActive) {
      throw new BusinessException(
        'CANNOT_DEACTIVATE_SYSTEM_TENANT',
        'Cannot deactivate the system tenant',
        400,
      );
    }

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: { isActive: dto.isActive },
    });

    const action = dto.isActive ? 'TENANT_ACTIVATED' : 'TENANT_SUSPENDED';
    await this.logAction(
      actorId,
      action,
      'Tenant',
      id,
      id,
      { isActive: dto.isActive },
      ip,
      ua,
    );

    return updated;
  }

  // ── Users (cross-tenant) ─────────────────────────────────

  async createTenantAdmin(
    tenantId: string,
    dto: CreateTenantAdminDto,
    actorId: string,
    ip?: string,
    ua?: string,
  ) {
    // Verificar se tenant existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', tenantId);
    }

    // Verificar unicidade global do email
    const existingEmail = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });
    if (existingEmail) {
      throw new ResourceAlreadyExistsException('User', 'email', dto.email);
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: Role.ADMIN,
        phone: dto.phone,
        mustChangePassword: true,
      },
    });

    await this.logAction(
      actorId,
      'TENANT_ADMIN_CREATED',
      'User',
      user.id,
      tenantId,
      { email: dto.email, tenantId },
      ip,
      ua,
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async listTenantUsers(
    tenantId: string,
    query: { page?: number; limit?: number },
  ) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where = { tenantId, deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
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
          mustChangePassword: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async resetUserPassword(
    userId: string,
    dto: ResetPasswordDto,
    actorId: string,
    ip?: string,
    ua?: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    // Impedir reset da própria senha por este endpoint
    if (user.id === actorId) {
      throw new BusinessException(
        'USE_CHANGE_PASSWORD',
        'Use the change-password endpoint to change your own password',
        400,
      );
    }

    // Impedir reset de senha de outro SUPER_ADMIN
    if (user.role === Role.SUPER_ADMIN) {
      throw new BusinessException(
        'CANNOT_RESET_SUPER_ADMIN',
        'Cannot reset another super admin password. Use change-password instead.',
        400,
      );
    }

    const passwordHash = await this.hashingService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.logAction(
      actorId,
      'USER_PASSWORD_RESET',
      'User',
      userId,
      user.tenantId,
      { email: user.email },
      ip,
      ua,
    );

    return { message: 'Password reset successfully' };
  }

  async unlockUser(userId: string, actorId: string, ip?: string, ua?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) {
      throw new ResourceNotFoundException('User', userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.logAction(
      actorId,
      'USER_UNLOCKED',
      'User',
      userId,
      user.tenantId,
      { email: user.email },
      ip,
      ua,
    );

    return { message: 'Account unlocked successfully' };
  }

  // ── Audit Log ────────────────────────────────────────────

  async getAuditLogs(query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const [items, total] = await Promise.all([
      this.prisma.superAdminAuditLog.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.superAdminAuditLog.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Private ──────────────────────────────────────────────

  private async logAction(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    targetTenantId: string | null,
    details: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.superAdminAuditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        targetTenantId,
        details: details as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
      },
    });
  }
}
