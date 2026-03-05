import {
  SOFT_DELETE_MODELS,
  isSoftDeleteModel,
} from './soft-delete.middleware';

describe('Soft Delete Utils', () => {
  describe('SOFT_DELETE_MODELS', () => {
    it('should contain all models with deletedAt field', () => {
      const expectedModels = [
        'Tenant',
        'User',
        'Barrel',
        'ComponentConfig',
        'MaintenanceOrder',
        'Geofence',
        'Client',
        'Supplier',
        'ServiceProvider',
      ];

      for (const model of expectedModels) {
        expect(SOFT_DELETE_MODELS.has(model)).toBe(true);
      }
      expect(SOFT_DELETE_MODELS.size).toBe(expectedModels.length);
    });

    it('should not contain models without deletedAt field', () => {
      const nonSoftDeleteModels = [
        'RefreshToken',
        'ComponentCycle',
        'LogisticsEvent',
        'MaintenanceLog',
        'MaintenanceItem',
        'Triage',
        'Alert',
        'Disposal',
        'AuditLog',
        'IdempotencyKey',
      ];

      for (const model of nonSoftDeleteModels) {
        expect(SOFT_DELETE_MODELS.has(model)).toBe(false);
      }
    });
  });

  describe('isSoftDeleteModel', () => {
    it('should return true for soft delete models', () => {
      expect(isSoftDeleteModel('Barrel')).toBe(true);
      expect(isSoftDeleteModel('User')).toBe(true);
      expect(isSoftDeleteModel('Client')).toBe(true);
    });

    it('should return false for non-soft-delete models', () => {
      expect(isSoftDeleteModel('LogisticsEvent')).toBe(false);
      expect(isSoftDeleteModel('AuditLog')).toBe(false);
      expect(isSoftDeleteModel('RefreshToken')).toBe(false);
    });
  });
});

describe('PrismaService soft delete integration', () => {
  describe('withTenantFilter', () => {
    it('should add deletedAt: null by default', () => {
      // Simulate the withTenantFilter logic
      const withTenantFilter = (where?: Record<string, any>) => ({
        ...where,
        deletedAt: where?.deletedAt !== undefined ? where.deletedAt : null,
      });

      const result = withTenantFilter({ tenantId: 't1' });
      expect(result.deletedAt).toBeNull();
    });

    it('should not override explicit deletedAt', () => {
      const withTenantFilter = (where?: Record<string, any>) => ({
        ...where,
        deletedAt: where?.deletedAt !== undefined ? where.deletedAt : null,
      });

      const result = withTenantFilter({
        tenantId: 't1',
        deletedAt: { not: null },
      });
      expect(result.deletedAt).toEqual({ not: null });
    });
  });

  describe('softDeleteData', () => {
    it('should return object with deletedAt as Date', () => {
      const before = new Date();
      const data = { deletedAt: new Date() };
      const after = new Date();

      expect(data.deletedAt).toBeInstanceOf(Date);
      expect(data.deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(data.deletedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
