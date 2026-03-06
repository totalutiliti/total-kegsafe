import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertJobsService } from './alert-jobs.service';
import { AlertService } from './alert.service';
import { ComponentService } from '../component/component.service';
import { PrismaService } from '../prisma/prisma.service';

interface MockPrismaModel {
  findMany: jest.Mock;
  updateMany: jest.Mock;
  createMany: jest.Mock;
}

interface MockPrisma {
  tenant: Pick<MockPrismaModel, 'findMany'>;
  barrel: Pick<MockPrismaModel, 'updateMany'>;
  alert: Pick<MockPrismaModel, 'createMany'>;
  logisticsEvent: Pick<MockPrismaModel, 'findMany'>;
  geofence: Pick<MockPrismaModel, 'findMany'>;
  maintenanceOrder: Pick<MockPrismaModel, 'findMany'>;
  componentCycle: Pick<MockPrismaModel, 'findMany'>;
  $queryRaw: jest.Mock;
}

interface MockAlertService {
  createAlert: jest.Mock;
}

interface CreateManyArgs {
  data: Array<{ alertType: string; priority?: string }>;
  skipDuplicates: boolean;
}

function getCreateManyCall(mock: jest.Mock, index = 0): CreateManyArgs {
  return (mock.mock.calls as Array<[CreateManyArgs]>)[index][0];
}

describe('AlertJobsService', () => {
  let service: AlertJobsService;
  let prisma: MockPrisma;
  let alertService: MockAlertService;

  const TENANT_1 = { id: 't1', settings: { idleThresholdDays: 15 } };
  const TENANT_2 = { id: 't2', settings: { idleThresholdDays: 20 } };

  beforeEach(async () => {
    prisma = {
      tenant: { findMany: jest.fn() },
      barrel: { updateMany: jest.fn() },
      alert: { createMany: jest.fn() },
      logisticsEvent: { findMany: jest.fn() },
      geofence: { findMany: jest.fn() },
      maintenanceOrder: { findMany: jest.fn() },
      componentCycle: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };

    alertService = {
      createAlert: jest.fn(),
    };

    const componentService = {
      calculateHealthScore: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertJobsService,
        {
          provide: PrismaService,
          useValue: prisma as unknown as PrismaService,
        },
        {
          provide: AlertService,
          useValue: alertService as unknown as AlertService,
        },
        {
          provide: ComponentService,
          useValue: componentService as unknown as ComponentService,
        },
        { provide: ConfigService, useValue: { get: () => false } },
      ],
    }).compile();

    service = module.get<AlertJobsService>(AlertJobsService);
  });

  describe('checkComponentHealth', () => {
    it('deve processar múltiplos tenants em paralelo com batch insert', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1, TENANT_2]);

      // Tenant 1: 2 ciclos com alerta necessário
      // Tenant 2: 0 ciclos
      prisma.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'c1',
            barrelId: 'b1',
            healthPercentage: 85,
            componentName: 'Sifão',
            criticality: 'HIGH',
            barrelInternalCode: 'KS-BAR-000000001',
          },
          {
            id: 'c2',
            barrelId: 'b2',
            healthPercentage: 92,
            componentName: 'O-Ring',
            criticality: 'CRITICAL',
            barrelInternalCode: 'KS-BAR-000000002',
          },
        ])
        .mockResolvedValueOnce([]);

      prisma.alert.createMany.mockResolvedValue({ count: 2 });

      await service.checkComponentHealth();

      // Deve usar createMany com skipDuplicates (batch insert)
      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
      const call = getCreateManyCall(prisma.alert.createMany);
      expect(call.data).toHaveLength(2);
      expect(call.skipDuplicates).toBe(true);

      // NÃO deve usar createAlert individual
      expect(alertService.createAlert).not.toHaveBeenCalled();
    });

    it('não deve criar alertas quando não há ciclos YELLOW', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);
      prisma.$queryRaw.mockResolvedValue([]);

      await service.checkComponentHealth();

      expect(prisma.alert.createMany).not.toHaveBeenCalled();
    });
  });

  describe('checkIdleBarrels', () => {
    it('deve criar alertas em batch para barris idle', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'b1', internalCode: 'KS-BAR-000000001' },
        { id: 'b2', internalCode: 'KS-BAR-000000002' },
      ]);

      prisma.alert.createMany.mockResolvedValue({ count: 2 });

      await service.checkIdleBarrels();

      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
      const call = getCreateManyCall(prisma.alert.createMany);
      expect(call.data).toHaveLength(2);
      expect(call.data[0].alertType).toBe('IDLE_AT_CLIENT');
      expect(call.skipDuplicates).toBe(true);
    });
  });

  describe('checkMaintenanceOverdue', () => {
    it('deve criar alertas em batch para OS pendentes há 7+ dias', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'mo1', barrelId: 'b1', orderNumber: 'OS-001' },
      ]);

      prisma.alert.createMany.mockResolvedValue({ count: 1 });

      await service.checkMaintenanceOverdue();

      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
      const call = getCreateManyCall(prisma.alert.createMany);
      expect(call.data[0].alertType).toBe('MANDATORY_INSPECTION');
      expect(call.data[0].priority).toBe('HIGH');
    });
  });

  describe('checkLostBarrels', () => {
    it('deve marcar barris como LOST via updateMany e criar alertas em batch', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'b1', internalCode: 'KS-BAR-000000001' },
        { id: 'b2', internalCode: 'KS-BAR-000000002' },
      ]);

      prisma.barrel.updateMany.mockResolvedValue({ count: 2 });
      prisma.alert.createMany.mockResolvedValue({ count: 2 });

      await service.checkLostBarrels();

      // Deve usar updateMany (batch) em vez de N updates individuais
      expect(prisma.barrel.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.barrel.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] } },
        data: { status: 'LOST' },
      });

      // Deve criar alertas em batch
      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
      const call = getCreateManyCall(prisma.alert.createMany);
      expect(call.data).toHaveLength(2);
    });

    it('não deve fazer nada quando não há barris perdidos', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);
      prisma.$queryRaw.mockResolvedValue([]);

      await service.checkLostBarrels();

      expect(prisma.barrel.updateMany).not.toHaveBeenCalled();
      expect(prisma.alert.createMany).not.toHaveBeenCalled();
    });
  });

  describe('checkGeofenceViolations', () => {
    it('deve buscar geofences em batch e criar alertas para violações', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);

      prisma.logisticsEvent.findMany.mockResolvedValue([
        {
          id: 'e1',
          barrelId: 'b1',
          clientId: 'c1',
          latitude: -23.5505,
          longitude: -46.6333,
          barrel: { internalCode: 'KS-BAR-000000001' },
        },
      ]);

      // Geofence com raio de 100m mas barril está a 2000m+ de distância
      prisma.geofence.findMany.mockResolvedValue([
        {
          clientId: 'c1',
          name: 'Bar do Zé',
          latitude: -23.57,
          longitude: -46.65,
          radiusMeters: 100,
        },
      ]);

      prisma.alert.createMany.mockResolvedValue({ count: 1 });

      await service.checkGeofenceViolations();

      // Deve buscar geofences em batch (1 query para todos os clientes)
      expect(prisma.geofence.findMany).toHaveBeenCalledTimes(1);

      // Deve criar alertas em batch
      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
      const call = getCreateManyCall(prisma.alert.createMany);
      expect(call.data[0].alertType).toBe('GEOFENCE_VIOLATION');
    });

    it('não deve criar alerta quando barril está dentro do geofence', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1]);

      prisma.logisticsEvent.findMany.mockResolvedValue([
        {
          id: 'e1',
          barrelId: 'b1',
          clientId: 'c1',
          latitude: -23.5505,
          longitude: -46.6333,
          barrel: { internalCode: 'KS-BAR-000000001' },
        },
      ]);

      // Geofence com mesmo ponto e raio de 1000m
      prisma.geofence.findMany.mockResolvedValue([
        {
          clientId: 'c1',
          name: 'Bar do Zé',
          latitude: -23.5505,
          longitude: -46.6333,
          radiusMeters: 1000,
        },
      ]);

      await service.checkGeofenceViolations();

      expect(prisma.alert.createMany).not.toHaveBeenCalled();
    });
  });

  describe('processTenantsInParallel', () => {
    it('deve continuar processando mesmo se um tenant falhar', async () => {
      prisma.tenant.findMany.mockResolvedValue([TENANT_1, TENANT_2]);

      // Tenant 1 falha, Tenant 2 sucede
      prisma.$queryRaw
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce([
          {
            id: 'c1',
            barrelId: 'b1',
            healthPercentage: 85,
            componentName: 'Sifão',
            criticality: 'HIGH',
            barrelInternalCode: 'KS-BAR-000000001',
          },
        ]);

      prisma.alert.createMany.mockResolvedValue({ count: 1 });

      // Não deve lançar erro (resiliência)
      await expect(service.checkComponentHealth()).resolves.not.toThrow();

      // Tenant 2 deve ter sido processado
      expect(prisma.alert.createMany).toHaveBeenCalledTimes(1);
    });
  });
});
