import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ClsService } from 'nestjs-cls';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly cls: ClsService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Prisma PG adapter requires this cast
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  getCurrentTenantId(): string | undefined {
    try {
      return this.cls.get('tenantId');
    } catch {
      return undefined;
    }
  }

  getCurrentUserId(): string | undefined {
    try {
      return this.cls.get('userId');
    } catch {
      return undefined;
    }
  }

  /**
   * Adds tenantId and deletedAt: null filter to queries.
   * All read queries on soft-delete models should use this.
   */
  withTenantFilter(where?: Record<string, any>): Record<string, any> {
    const tenantId = this.getCurrentTenantId();
    return {
      ...where,
      ...(tenantId ? { tenantId } : {}),
      deletedAt:
        where?.deletedAt !== undefined
          ? (where.deletedAt as Date | null)
          : null,
    };
  }

  withTenantCreate(data: Record<string, any>): Record<string, any> {
    const tenantId = this.getCurrentTenantId();
    return {
      ...data,
      ...(tenantId ? { tenantId } : {}),
    };
  }

  withAuditCreate(data: Record<string, any>): Record<string, any> {
    const userId = this.getCurrentUserId();
    return {
      ...data,
      ...(userId ? { createdById: userId, updatedById: userId } : {}),
    };
  }

  withAuditUpdate(data: Record<string, any>): Record<string, any> {
    const userId = this.getCurrentUserId();
    return {
      ...data,
      ...(userId ? { updatedById: userId } : {}),
    };
  }

  /**
   * Soft delete data payload — sets deletedAt to current timestamp.
   * Usage: prisma.barrel.update({ where: { id }, data: prisma.softDeleteData() })
   */
  softDeleteData(): { deletedAt: Date } {
    return { deletedAt: new Date() };
  }
}
