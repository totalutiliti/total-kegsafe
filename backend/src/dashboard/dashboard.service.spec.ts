import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    prisma = {
      barrel: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      componentCycle: {
        groupBy: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getFleetHealth', () => {
    it('deve retornar contagens por status usando groupBy (2 queries, não 11)', async () => {
      prisma.barrel.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: { _all: 50 } },
        { status: 'IN_TRANSIT', _count: { _all: 10 } },
        { status: 'AT_CLIENT', _count: { _all: 30 } },
        { status: 'BLOCKED', _count: { _all: 5 } },
      ]);

      prisma.componentCycle.groupBy.mockResolvedValue([
        { healthScore: 'GREEN', _count: { _all: 200 } },
        { healthScore: 'YELLOW', _count: { _all: 50 } },
        { healthScore: 'RED', _count: { _all: 10 } },
      ]);

      const result = await service.getFleetHealth(TENANT_ID);

      expect(result.barrels.total).toBe(95);
      expect(result.barrels.active).toBe(50);
      expect(result.barrels.inTransit).toBe(10);
      expect(result.barrels.atClient).toBe(30);
      expect(result.barrels.blocked).toBe(5);
      expect(result.barrels.inMaintenance).toBe(0);
      expect(result.barrels.disposed).toBe(0);
      expect(result.barrels.lost).toBe(0);
      expect(result.componentHealth.green).toBe(200);
      expect(result.componentHealth.yellow).toBe(50);
      expect(result.componentHealth.red).toBe(10);

      // Deve usar groupBy (2 queries) em vez de 11 count individuais
      expect(prisma.barrel.groupBy).toHaveBeenCalledTimes(1);
      expect(prisma.componentCycle.groupBy).toHaveBeenCalledTimes(1);
    });

    it('deve retornar zeros quando não há barris', async () => {
      prisma.barrel.groupBy.mockResolvedValue([]);
      prisma.componentCycle.groupBy.mockResolvedValue([]);

      const result = await service.getFleetHealth(TENANT_ID);

      expect(result.barrels.total).toBe(0);
      expect(result.barrels.active).toBe(0);
      expect(result.componentHealth.green).toBe(0);
    });
  });

  describe('getCostPerLiter', () => {
    it('deve calcular custo por litro via SQL agregado (sem loop em memória)', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          totalCost: '15000',
          totalLiters: '5000',
          barrelsAnalyzed: 100n,
        },
      ]);

      const result = await service.getCostPerLiter(TENANT_ID);

      expect(result.costPerLiter).toBe(3);
      expect(result.totalCost).toBe(15000);
      expect(result.totalLiters).toBe(5000);
      expect(result.barrelsAnalyzed).toBe(100);

      // Deve usar $queryRaw (1 query) em vez de findMany + loop
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.barrel.findMany).not.toHaveBeenCalled();
    });

    it('deve retornar 0 quando não há litros transportados', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          totalCost: '0',
          totalLiters: '0',
          barrelsAnalyzed: 0n,
        },
      ]);

      const result = await service.getCostPerLiter(TENANT_ID);

      expect(result.costPerLiter).toBe(0);
      expect(result.totalLiters).toBe(0);
    });
  });

  describe('getAssetTurnover', () => {
    it('deve calcular giro de ativos via SQL agregado', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          totalBarrels: 50n,
          totalCycles: '250',
        },
      ]);

      const result = await service.getAssetTurnover(TENANT_ID);

      expect(result.totalBarrels).toBe(50);
      expect(result.totalCycles).toBe(250);
      expect(result.avgCyclesPerBarrel).toBe(5);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.barrel.findMany).not.toHaveBeenCalled();
    });

    it('deve retornar 0 quando não há barris', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          totalBarrels: 0n,
          totalCycles: '0',
        },
      ]);

      const result = await service.getAssetTurnover(TENANT_ID);

      expect(result.avgCyclesPerBarrel).toBe(0);
    });
  });

  describe('getLossReport', () => {
    it('deve retornar relatório de perdas com valor estimado via SQL', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          count: 3n,
          estimatedValue: '7500.00',
        },
      ]);

      prisma.barrel.findMany.mockResolvedValue([
        {
          id: '1',
          internalCode: 'KS-BAR-000000001',
          acquisitionCost: 2500,
          lastEventAt: new Date(),
        },
        {
          id: '2',
          internalCode: 'KS-BAR-000000002',
          acquisitionCost: 2500,
          lastEventAt: new Date(),
        },
        {
          id: '3',
          internalCode: 'KS-BAR-000000003',
          acquisitionCost: 2500,
          lastEventAt: new Date(),
        },
      ]);

      prisma.barrel.count
        .mockResolvedValueOnce(5) // blocked
        .mockResolvedValueOnce(2); // disposed

      const result = await service.getLossReport(TENANT_ID);

      expect(result.lost.count).toBe(3);
      expect(result.lost.estimatedValue).toBe(7500);
      expect(result.lost.barrels).toHaveLength(3);
      expect(result.blocked).toBe(5);
      expect(result.disposed).toBe(2);
    });
  });
});
