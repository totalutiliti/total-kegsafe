import type {
  MaintenanceOrderStatus,
  MaintenanceType,
  AlertPriority,
} from '@prisma/client';

/**
 * Interface for the MaintenanceService.
 *
 * Defines the public contract for maintenance operations.
 * Consumers should depend on this interface (via the MAINTENANCE_SERVICE token)
 * rather than on the concrete MaintenanceService class.
 */
export interface IMaintenanceService {
  findAllOrders(
    tenantId: string,
    query?: {
      status?: MaintenanceOrderStatus;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  findOrderById(tenantId: string, id: string): Promise<unknown>;

  createOrder(
    tenantId: string,
    data: {
      barrelId: string;
      orderType: MaintenanceType;
      priority?: AlertPriority;
      description?: string;
      assignedToId?: string;
      providerId?: string;
    },
  ): Promise<unknown>;

  registerChecklist(
    tenantId: string,
    userId: string,
    data: {
      maintenanceOrderId?: string;
      barrelId: string;
      maintenanceType: string;
      pressureTestOk?: boolean;
      pressureTestValue?: number;
      washCompleted?: boolean;
      generalNotes?: string;
      totalCost?: number;
      items: Array<{
        componentConfigId: string;
        action: string;
        cost?: number;
        notes?: string;
      }>;
    },
  ): Promise<unknown>;

  registerTriage(
    tenantId: string,
    userId: string,
    data: {
      barrelId: string;
      intact: boolean;
      damageType?: string;
      damageNotes?: string;
      photoUrl?: string;
    },
  ): Promise<unknown>;

  getCalendar(
    tenantId: string,
    query?: { from?: string; to?: string },
  ): Promise<Record<string, unknown[]>>;

  checkMaintenanceDueOnReturn(
    tenantId: string,
    barrelId: string,
  ): Promise<{
    maintenanceRequired: boolean;
    autoOrderCreated: boolean;
  } | null>;
}
