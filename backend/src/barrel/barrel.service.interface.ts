import type { BarrelStatus } from '@prisma/client';
import type { CreateBarrelDto } from './dto/create-barrel.dto.js';
import type { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import type { QuickRegisterDto } from './dto/quick-register.dto.js';

/**
 * Interface for the BarrelService.
 *
 * Defines the public contract for barrel management operations.
 * Consumers should depend on this interface (via the BARREL_SERVICE token)
 * rather than on the concrete BarrelService class.
 */
export interface IBarrelService {
  findAll(
    tenantId: string,
    query?: {
      status?: BarrelStatus;
      page?: number;
      limit?: number;
      search?: string;
    },
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findById(tenantId: string, id: string): Promise<unknown>;

  create(tenantId: string, dto: CreateBarrelDto): Promise<unknown>;

  update(tenantId: string, id: string, dto: UpdateBarrelDto): Promise<unknown>;

  delete(tenantId: string, id: string): Promise<unknown>;

  validateStatusTransition(currentStatus: string, targetStatus: string): void;

  quickRegister(tenantId: string, dto: QuickRegisterDto): Promise<unknown>;
}
