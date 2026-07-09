import type {
  BarrelStatus,
  Barrel,
  ComponentCycle,
  ComponentConfig,
} from '@prisma/client';
import type { CreateBarrelDto } from './dto/create-barrel.dto.js';
import type { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import type { QuickRegisterDto } from './dto/quick-register.dto.js';
import type { LinkQrDto } from './dto/link-qr.dto.js';
import type { ScanBarrelDto } from './dto/scan-barrel.dto.js';
import type { GenerateBatchDto } from './dto/generate-batch.dto.js';
import type { TransferBarrelDto } from './dto/transfer-barrel.dto.js';

/** Barrel with included componentCycles and their configs */
export type BarrelWithComponents = Barrel & {
  componentCycles: (ComponentCycle & {
    componentConfig: ComponentConfig;
  })[];
};

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

  findById(tenantId: string, id: string): Promise<BarrelWithComponents>;

  findByQrCode(tenantId: string, qrCode: string): Promise<BarrelWithComponents>;

  create(tenantId: string, dto: CreateBarrelDto): Promise<unknown>;

  update(tenantId: string, id: string, dto: UpdateBarrelDto): Promise<unknown>;

  delete(tenantId: string, id: string): Promise<unknown>;

  validateStatusTransition(currentStatus: string, targetStatus: string): void;

  quickRegister(tenantId: string, dto: QuickRegisterDto): Promise<unknown>;

  getTimeline(tenantId: string, barrelId: string): Promise<unknown>;

  findUnlinked(
    tenantId: string,
    query?: { page?: number; limit?: number },
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  exportUnlinked(tenantId: string): Promise<Buffer>;

  generateImportTemplate(): Promise<Buffer>;

  validateImport(
    tenantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<unknown>;

  executeImport(tenantId: string, uploadId: string): unknown;

  getImportProgress(tenantId: string, uploadId: string): unknown;

  linkQr(tenantId: string, barrelId: string, dto: LinkQrDto): Promise<unknown>;

  batchLinkQrFromFile(
    tenantId: string,
    buffer: Buffer,
    filename: string,
  ): Promise<unknown>;

  scanOrCreate(
    tenantId: string,
    dto: ScanBarrelDto,
  ): Promise<{ barrel: unknown; action: 'found' | 'activated' | 'created' }>;

  generateBatch(
    tenantId: string,
    dto: GenerateBatchDto,
    actorId?: string,
  ): Promise<{
    batchId: string;
    codes: string[];
    range: { start: string; end: string };
    quantity: number;
    tenant: string | null;
  }>;

  transferBarrel(
    tenantId: string,
    barrelId: string,
    dto: TransferBarrelDto,
  ): Promise<unknown>;

  batchUpdateStatus(
    tenantId: string,
    dto: { barrelIds: string[]; status: string; reason?: string },
    userId: string,
  ): Promise<{ updated: number }>;

  getOwnershipHistory(
    tenantId: string,
    barrelId: string,
  ): Promise<{ data: unknown[] }>;
}
