/**
 * Soft Delete support for Prisma 7.
 *
 * Prisma 7 removed `$use` middleware and `$extends`. Soft delete is handled via:
 * - Auto-filtering: PrismaService.withTenantFilter() adds `deletedAt: null` to all queries
 * - Soft delete ops: PrismaService.softDelete() / softDeleteMany() convert delete to update
 *
 * Models that support soft delete via `deletedAt` field.
 * Must be kept in sync with schema.prisma.
 */
export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set([
  'Tenant',
  'User',
  'Barrel',
  'ComponentConfig',
  'MaintenanceOrder',
  'Geofence',
  'Client',
  'Supplier',
  'ServiceProvider',
]);

/**
 * Checks if a model supports soft delete.
 */
export function isSoftDeleteModel(model: string): boolean {
  return SOFT_DELETE_MODELS.has(model);
}
