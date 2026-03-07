import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { HashingService } from '../shared/services/hashing.service.js';
import {
  ResourceNotFoundException,
  ResourceAlreadyExistsException,
} from '../shared/exceptions/resource.exceptions.js';
import { BusinessException } from '../shared/exceptions/business.exception.js';
import { Role, BarrelStatus, Prisma } from '@prisma/client';
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

  // ── Barrel Batches ─────────────────────────────────────────

  async listBatches(query: {
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: Prisma.BarrelBatchWhereInput = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    const [items, total] = await Promise.all([
      this.prisma.barrelBatch.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true } },
          prints: {
            orderBy: { printedAt: 'desc' },
            select: {
              id: true,
              printedById: true,
              printedAt: true,
              reason: true,
            },
          },
        },
      }),
      this.prisma.barrelBatch.count({ where }),
    ]);

    // Buscar nomes dos usuários referenciados
    const userIds = new Set<string>();
    for (const batch of items) {
      userIds.add(batch.createdById);
      for (const print of batch.prints) {
        userIds.add(print.printedById);
      }
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return {
      items: items.map((b) => ({
        id: b.id,
        codeStart: b.codeStart,
        codeEnd: b.codeEnd,
        quantity: b.quantity,
        tenant: b.tenant,
        printCount: b.printCount,
        createdBy: userMap.get(b.createdById) ?? b.createdById,
        createdAt: b.createdAt,
        prints: b.prints.map((p) => ({
          id: p.id,
          printedBy: userMap.get(p.printedById) ?? p.printedById,
          printedAt: p.printedAt,
          reason: p.reason,
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async printBatch(
    batchId: string,
    actorId: string,
    reason?: string,
    ip?: string,
    ua?: string,
  ) {
    const batch = await this.prisma.barrelBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new ResourceNotFoundException('BarrelBatch', batchId);
    }

    // Registrar impressão e incrementar contador
    const [updatedBatch] = await this.prisma.$transaction([
      this.prisma.barrelBatch.update({
        where: { id: batchId },
        data: { printCount: { increment: 1 } },
      }),
      this.prisma.barrelBatchPrint.create({
        data: {
          batchId,
          printedById: actorId,
          reason:
            reason ||
            (batch.printCount === 0 ? 'Primeira impressão' : undefined),
        },
      }),
    ]);

    await this.logAction(
      actorId,
      batch.printCount >= 1 ? 'BATCH_REPRINTED' : 'BATCH_PRINTED',
      'BarrelBatch',
      batchId,
      batch.tenantId,
      { printCount: updatedBatch.printCount, reason },
      ip,
      ua,
    );

    return {
      printCount: updatedBatch.printCount,
      warning:
        updatedBatch.printCount > 1
          ? 'ATENÇÃO: Este lote já foi impresso anteriormente.'
          : undefined,
    };
  }

  async exportBatch(
    batchId: string,
    actorId: string,
    ip?: string,
    ua?: string,
  ): Promise<{
    csv: string;
    printResult: { printCount: number; warning?: string };
  }> {
    const batch = await this.prisma.barrelBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new ResourceNotFoundException('BarrelBatch', batchId);
    }

    // Gerar CSV dos códigos do lote
    const startNum = parseInt(batch.codeStart.replace('KS-BAR-', ''), 10);
    const codes: string[] = [];
    for (let i = 0; i < batch.quantity; i++) {
      codes.push(`KS-BAR-${String(startNum + i).padStart(9, '0')}`);
    }
    const csv = ['code', ...codes].join('\n');

    // Registrar como impressão automaticamente
    const printResult = await this.printBatch(
      batchId,
      actorId,
      'Export CSV para gravação a laser',
      ip,
      ua,
    );

    return { csv, printResult };
  }

  async getBatchStats() {
    const [totalBarrels, preRegisteredCount, activeCount, pendingBatches] =
      await Promise.all([
        // Total de barris gerados (todos os lotes)
        this.prisma.barrel.count({
          where: { deletedAt: null },
        }),
        // Total PRE_REGISTERED
        this.prisma.barrel.count({
          where: { status: BarrelStatus.PRE_REGISTERED, deletedAt: null },
        }),
        // Total ACTIVE
        this.prisma.barrel.count({
          where: { status: BarrelStatus.ACTIVE, deletedAt: null },
        }),
        // Lotes com printCount = 0
        this.prisma.barrelBatch.count({
          where: { printCount: 0 },
        }),
      ]);

    return {
      totalBarrels,
      preRegisteredCount,
      activeCount,
      pendingBatches,
    };
  }

  // ── Barrel Transfers ──────────────────────────────────────

  async getOwnershipHistory(barrelId: string) {
    const history = await this.prisma.ownershipHistory.findMany({
      where: { barrelId },
      orderBy: { transferredAt: 'desc' },
      include: {
        fromTenant: { select: { id: true, name: true } },
        toTenant: { select: { id: true, name: true } },
      },
    });

    return { data: history };
  }

  async transferBatch(
    barrelIds: string[],
    toTenantId: string,
    actorId: string,
    notes?: string,
    ip?: string,
    ua?: string,
  ) {
    // Verificar tenant destino
    const targetTenant = await this.prisma.tenant.findUnique({
      where: { id: toTenantId },
    });
    if (!targetTenant) {
      throw new ResourceNotFoundException('Tenant', toTenantId);
    }

    // Buscar barris
    const barrels = await this.prisma.barrel.findMany({
      where: { id: { in: barrelIds }, deletedAt: null },
      select: { id: true, tenantId: true, internalCode: true },
    });

    if (barrels.length !== barrelIds.length) {
      throw new BusinessException(
        'BARRELS_NOT_FOUND',
        `Apenas ${barrels.length} de ${barrelIds.length} barris foram encontrados`,
        400,
      );
    }

    // Verificar que nenhum barril já pertence ao destino
    const alreadyOwned = barrels.filter((b) => b.tenantId === toTenantId);
    if (alreadyOwned.length > 0) {
      throw new BusinessException(
        'BARRELS_ALREADY_OWNED',
        `${alreadyOwned.length} barris já pertencem ao tenant destino`,
        400,
      );
    }

    // Transferir todos em uma transação
    await this.prisma.$transaction([
      // Atualizar tenantId de todos
      this.prisma.barrel.updateMany({
        where: { id: { in: barrelIds } },
        data: { tenantId: toTenantId },
      }),
      // Criar registros de ownership history
      this.prisma.ownershipHistory.createMany({
        data: barrels.map((b) => ({
          id: randomUUID(),
          barrelId: b.id,
          fromTenantId: b.tenantId,
          toTenantId,
          notes,
        })),
      }),
    ]);

    await this.logAction(
      actorId,
      'BARRELS_TRANSFERRED',
      'Barrel',
      barrelIds.join(','),
      toTenantId,
      {
        count: barrelIds.length,
        toTenantId,
        toTenantName: targetTenant.name,
        notes,
      },
      ip,
      ua,
    );

    return {
      transferred: barrelIds.length,
      toTenant: { id: targetTenant.id, name: targetTenant.name },
    };
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
