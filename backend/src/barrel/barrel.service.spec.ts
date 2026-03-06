import { Test, TestingModule } from '@nestjs/testing';
import { BarrelService } from './barrel.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelService } from '../shared/services/excel.service';
import { CreateBarrelDto } from './dto/create-barrel.dto';
import { QuickRegisterDto } from './dto/quick-register.dto';
import {
  BarrelNotFoundException,
  BarrelQrCodeExistsException,
} from '../shared/exceptions/barrel.exceptions';
import {
  ImportNotFoundException,
  ImportInProgressException,
} from '../shared/exceptions/import.exceptions';

// =============================================
// Typed mock interfaces
// =============================================

interface MockBarrelDelegate {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  createMany: jest.Mock;
}

interface MockComponentCycleDelegate {
  createMany: jest.Mock;
}

interface MockComponentConfigDelegate {
  findMany: jest.Mock;
}

interface MockLogisticsEventDelegate {
  findMany: jest.Mock;
}

interface MockTx {
  barrel: MockBarrelDelegate;
  componentCycle: MockComponentCycleDelegate;
}

interface MockPrisma {
  barrel: MockBarrelDelegate;
  componentCycle: MockComponentCycleDelegate;
  componentConfig: MockComponentConfigDelegate;
  logisticsEvent: MockLogisticsEventDelegate;
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
}

interface MockExcelService {
  parseFile: jest.Mock;
  generateTemplate: jest.Mock;
  generateFromData: jest.Mock;
}

describe('BarrelService', () => {
  let service: BarrelService;
  let prisma: MockPrisma;
  let excelService: MockExcelService;

  /** Mock do objeto `tx` passado ao callback de $transaction */
  let txMock: MockTx;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    txMock = {
      barrel: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      componentCycle: {
        createMany: jest.fn(),
      },
    };

    prisma = {
      barrel: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
      componentCycle: {
        createMany: jest.fn(),
      },
      componentConfig: {
        findMany: jest.fn(),
      },
      logisticsEvent: {
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn((cb: any) => {
        // Support both callback-style and array-style transactions
        if (typeof cb === 'function')
          return (cb as (tx: MockTx) => unknown)(txMock);
        // For array-style $transaction (batchLinkQr uses this)
        return Promise.all(
          (cb as Promise<unknown>[]).map((p: Promise<unknown>) => p),
        );
      }),
    };

    excelService = {
      parseFile: jest.fn(),
      generateTemplate: jest.fn(),
      generateFromData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BarrelService,
        { provide: PrismaService, useValue: prisma },
        { provide: ExcelService, useValue: excelService },
      ],
    }).compile();

    service = module.get<BarrelService>(BarrelService);
  });

  describe('findAll - sem busca', () => {
    it('deve listar barris com paginação e include de componentes', async () => {
      const mockBarrels = [
        { id: '1', internalCode: 'KS-BAR-000000001', componentCycles: [] },
      ];

      prisma.barrel.findMany.mockResolvedValue(mockBarrels);
      prisma.barrel.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(result.items).toEqual(mockBarrels);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);

      // Deve usar findMany do Prisma (sem raw query) quando não há search
      expect(prisma.barrel.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('findAll - com busca (trigram)', () => {
    it('deve usar $queryRaw com ILIKE para busca por texto', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: '1' }, { id: '2' }]) // IDs
        .mockResolvedValueOnce([{ count: 2n }]); // count

      prisma.barrel.findMany.mockResolvedValue([
        { id: '1', internalCode: 'KS-BAR-000000001', componentCycles: [] },
        { id: '2', internalCode: 'KS-BAR-000000002', componentCycles: [] },
      ]);

      const result = await service.findAll(TENANT_ID, {
        search: 'KS-BAR',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);

      // Deve usar $queryRaw (para ILIKE com trigram) + findMany (hydrate com IN)
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
      expect(prisma.barrel.findMany).toHaveBeenCalledTimes(1);
    });

    it('deve retornar vazio quando busca não encontra resultados', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([]) // IDs vazios
        .mockResolvedValueOnce([{ count: 0n }]); // count

      const result = await service.findAll(TENANT_ID, {
        search: 'INEXISTENTE',
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('create - batch insert de ComponentCycles', () => {
    it('deve usar createMany para inserir componentCycles em batch', async () => {
      // generateInternalCode: txMock retorna null (sem barril anterior)
      txMock.barrel.findFirst.mockResolvedValue(null);

      prisma.barrel.findFirst
        .mockResolvedValueOnce(null) // unicidade QR (não existe)
        .mockResolvedValueOnce({
          id: 'new',
          internalCode: 'KS-BAR-000000001',
          componentCycles: [],
        }); // findById

      prisma.barrel.create.mockResolvedValue({
        id: 'new',
        internalCode: 'KS-BAR-000000001',
      });

      prisma.componentConfig.findMany.mockResolvedValue([
        { id: 'cfg-1', name: 'Sifão' },
        { id: 'cfg-2', name: 'O-Ring' },
        { id: 'cfg-3', name: 'Válvula' },
      ]);

      prisma.componentCycle.createMany.mockResolvedValue({ count: 3 });

      await service.create(TENANT_ID, {
        qrCode: 'QR-TEST-001',
        capacityLiters: 50,
      } as CreateBarrelDto);

      // Deve usar $transaction para gerar internalCode
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      // Deve usar createMany (1 query batch) em vez de 3 create individuais
      expect(prisma.componentCycle.createMany).toHaveBeenCalledTimes(1);
      const callArgs = (
        prisma.componentCycle.createMany.mock.calls[0] as [
          { data: unknown[]; skipDuplicates: boolean },
        ]
      )[0];

      expect(callArgs.data).toHaveLength(3);
      expect(callArgs.skipDuplicates).toBe(true);
    });

    it('deve lançar erro se QR Code já existe', async () => {
      prisma.barrel.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create(TENANT_ID, { qrCode: 'QR-EXISTS' } as CreateBarrelDto),
      ).rejects.toThrow(BarrelQrCodeExistsException);
    });

    it('deve permitir criar barril sem qrCode (null)', async () => {
      txMock.barrel.findFirst.mockResolvedValue(null);

      prisma.barrel.create.mockResolvedValue({
        id: 'new',
        internalCode: 'KS-BAR-000000001',
      });

      prisma.barrel.findFirst.mockResolvedValueOnce({
        id: 'new',
        internalCode: 'KS-BAR-000000001',
        qrCode: null,
        componentCycles: [],
      });

      prisma.componentConfig.findMany.mockResolvedValue([]);

      await service.create(TENANT_ID, {
        capacityLiters: 50,
      } as CreateBarrelDto);

      // Não deve verificar unicidade do qrCode quando é undefined
      expect(prisma.barrel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ qrCode: null }) as Record<
            string,
            unknown
          >,
        }),
      );
    });
  });

  describe('generateInternalCode', () => {
    it('deve gerar KS-BAR-000000001 quando não há barril anterior', async () => {
      txMock.barrel.findFirst.mockResolvedValue(null);

      const code = await service.generateInternalCode(TENANT_ID);

      expect(code).toBe('KS-BAR-000000001');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('deve incrementar a partir do último internalCode existente', async () => {
      txMock.barrel.findFirst.mockResolvedValue({
        internalCode: 'KS-BAR-000000053',
      });

      const code = await service.generateInternalCode(TENANT_ID);

      expect(code).toBe('KS-BAR-000000054');
    });

    it('deve usar fallback de count quando internalCode está corrompido (NaN)', async () => {
      txMock.barrel.findFirst.mockResolvedValue({
        internalCode: 'KS-BAR-CORRUPTED',
      });
      txMock.barrel.count.mockResolvedValue(10);

      const code = await service.generateInternalCode(TENANT_ID);

      expect(code).toBe('KS-BAR-000000011');
      expect(txMock.barrel.count).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
      });
    });

    it('deve fazer retry em erro de serialização (P2034)', async () => {
      const serializationError: Error & { code?: string } = new Error(
        'serialization failure',
      );
      serializationError.code = 'P2034';

      // Primeira chamada falha, segunda sucede
      prisma.$transaction
        .mockRejectedValueOnce(serializationError)
        .mockImplementationOnce((cb: any) =>
          (cb as (tx: MockTx) => unknown)(txMock),
        );
      txMock.barrel.findFirst.mockResolvedValue(null);

      const code = await service.generateInternalCode(TENANT_ID);

      expect(code).toBe('KS-BAR-000000001');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('deve fazer retry em erro de unique constraint (P2002)', async () => {
      const uniqueError: Error & { code?: string } = new Error(
        'unique constraint',
      );
      uniqueError.code = 'P2002';

      prisma.$transaction
        .mockRejectedValueOnce(uniqueError)
        .mockImplementationOnce((cb: any) =>
          (cb as (tx: MockTx) => unknown)(txMock),
        );
      txMock.barrel.findFirst.mockResolvedValue({
        internalCode: 'KS-BAR-000000001',
      });

      const code = await service.generateInternalCode(TENANT_ID);

      expect(code).toBe('KS-BAR-000000002');
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('deve lançar erro após esgotar MAX_RETRIES', async () => {
      const serializationError: Error & { code?: string } = new Error(
        'serialization failure',
      );
      serializationError.code = 'P2034';

      prisma.$transaction
        .mockRejectedValueOnce(serializationError)
        .mockRejectedValueOnce(serializationError)
        .mockRejectedValueOnce(serializationError);

      await expect(service.generateInternalCode(TENANT_ID)).rejects.toThrow(
        'serialization failure',
      );
    });

    it('deve lançar imediatamente em erro não-retryable', async () => {
      const genericError = new Error('connection lost');

      prisma.$transaction.mockRejectedValueOnce(genericError);

      await expect(service.generateInternalCode(TENANT_ID)).rejects.toThrow(
        'connection lost',
      );
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateInternalCodes (batch)', () => {
    it('deve gerar N códigos sequenciais', async () => {
      txMock.barrel.findFirst.mockResolvedValue({
        internalCode: 'KS-BAR-000000010',
      });

      const codes = await service.generateInternalCodes(TENANT_ID, 3);

      expect(codes).toEqual([
        'KS-BAR-000000011',
        'KS-BAR-000000012',
        'KS-BAR-000000013',
      ]);
    });

    it('deve começar do 1 quando não há barril anterior', async () => {
      txMock.barrel.findFirst.mockResolvedValue(null);

      const codes = await service.generateInternalCodes(TENANT_ID, 2);

      expect(codes).toEqual(['KS-BAR-000000001', 'KS-BAR-000000002']);
    });

    it('deve fazer retry em erro P2034', async () => {
      const serializationError: Error & { code?: string } = new Error(
        'serialization failure',
      );
      serializationError.code = 'P2034';

      prisma.$transaction
        .mockRejectedValueOnce(serializationError)
        .mockImplementationOnce((cb: any) =>
          (cb as (tx: MockTx) => unknown)(txMock),
        );
      txMock.barrel.findFirst.mockResolvedValue(null);

      const codes = await service.generateInternalCodes(TENANT_ID, 1);

      expect(codes).toEqual(['KS-BAR-000000001']);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('deve usar fallback de count quando internalCode está corrompido', async () => {
      txMock.barrel.findFirst.mockResolvedValue({
        internalCode: 'KS-BAR-INVALID',
      });
      txMock.barrel.count.mockResolvedValue(5);

      const codes = await service.generateInternalCodes(TENANT_ID, 2);

      expect(codes).toEqual(['KS-BAR-000000006', 'KS-BAR-000000007']);
    });
  });

  describe('quickRegister', () => {
    it('deve delegar para create()', async () => {
      const dto: QuickRegisterDto = {
        qrCode: 'QR-QUICK-001',
        capacityLiters: 50,
      };

      // Mock para create flow
      txMock.barrel.findFirst.mockResolvedValue(null);
      prisma.barrel.findFirst
        .mockResolvedValueOnce(null) // unicidade QR
        .mockResolvedValueOnce({
          id: 'new',
          internalCode: 'KS-BAR-000000001',
          qrCode: 'QR-QUICK-001',
          componentCycles: [],
        }); // findById

      prisma.barrel.create.mockResolvedValue({
        id: 'new',
        internalCode: 'KS-BAR-000000001',
      });
      prisma.componentConfig.findMany.mockResolvedValue([]);

      const result = await service.quickRegister(TENANT_ID, dto);

      expect(result.qrCode).toBe('QR-QUICK-001');
    });
  });

  describe('findById', () => {
    it('deve lançar BarrelNotFoundException quando não encontra', async () => {
      prisma.barrel.findFirst.mockResolvedValue(null);

      await expect(service.findById(TENANT_ID, 'non-existent')).rejects.toThrow(
        BarrelNotFoundException,
      );
    });
  });

  describe('validateStatusTransition', () => {
    it('deve permitir ACTIVE → IN_TRANSIT', () => {
      expect(() =>
        service.validateStatusTransition('ACTIVE', 'IN_TRANSIT'),
      ).not.toThrow();
    });

    it('deve rejeitar DISPOSED → qualquer', () => {
      expect(() =>
        service.validateStatusTransition('DISPOSED', 'ACTIVE'),
      ).toThrow();
    });
  });

  // =============================================
  // Feature 2: Importação via Planilha
  // =============================================

  describe('generateImportTemplate', () => {
    it('deve chamar excelService.generateTemplate com colunas corretas', async () => {
      excelService.generateTemplate.mockResolvedValue(Buffer.from('mock'));

      const result = await service.generateImportTemplate();

      expect(excelService.generateTemplate).toHaveBeenCalledTimes(1);
      const [columns, examples, instructions] = excelService.generateTemplate
        .mock.calls[0] as [{ header: string }[], unknown[], unknown[]];
      expect(columns.map((c: { header: string }) => c.header)).toContain(
        'qrCode',
      );
      expect(columns.map((c: { header: string }) => c.header)).toContain(
        'capacidade',
      );
      expect(examples).toHaveLength(2);
      expect(instructions.length).toBeGreaterThan(0);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('validateImport', () => {
    it('deve validar arquivo com dados corretos', async () => {
      excelService.parseFile.mockResolvedValue([
        {
          qrCode: 'QR-001',
          fabricante: 'Franke',
          capacidade: 50,
          modeloValvula: 'TYPE_S',
          material: 'INOX_304',
        },
        {
          qrCode: 'QR-002',
          fabricante: 'Portinox',
          capacidade: 30,
        },
      ]);

      // Nenhum qrCode existente no DB
      prisma.barrel.findMany.mockResolvedValue([]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.duplicateRows).toBe(0);
      expect(result.uploadId).toBeDefined();
      expect(result.preview).toHaveLength(2);
    });

    it('deve reportar erro para qrCode ausente', async () => {
      excelService.parseFile.mockResolvedValue([
        { fabricante: 'Franke', capacidade: 50 }, // sem qrCode
      ]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].field).toBe('qrCode');
    });

    it('deve reportar erro para capacidade inválida (fora do range 5-100)', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 200 }, // fora do range
        { qrCode: 'QR-002', capacidade: 2 }, // abaixo do mínimo
      ]);

      prisma.barrel.findMany.mockResolvedValue([]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.errorRows).toBe(2);
      expect(result.errors[0].field).toBe('capacidade');
    });

    it('deve detectar duplicatas internas no arquivo', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-DUP', capacidade: 50 },
        { qrCode: 'QR-DUP', capacidade: 30 }, // duplicata
      ]);

      prisma.barrel.findMany.mockResolvedValue([]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.validRows).toBe(1);
      expect(result.duplicateRows).toBe(1);
    });

    it('deve detectar qrCodes já existentes no banco', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-EXISTS', capacidade: 50 },
        { qrCode: 'QR-NEW', capacidade: 30 },
      ]);

      prisma.barrel.findMany.mockResolvedValue([{ qrCode: 'QR-EXISTS' }]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.validRows).toBe(1);
      expect(result.duplicateRows).toBe(1);
    });

    it('deve reportar erro para modeloValvula inválido', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50, modeloValvula: 'INVALID_TYPE' },
      ]);

      prisma.barrel.findMany.mockResolvedValue([]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].field).toBe('modeloValvula');
    });

    it('deve reportar erro para material inválido', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50, material: 'WOOD' },
      ]);

      prisma.barrel.findMany.mockResolvedValue([]);

      const result = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.errorRows).toBe(1);
      expect(result.errors[0].field).toBe('material');
    });
  });

  describe('executeImport', () => {
    it('deve lançar ImportNotFoundException para uploadId inexistente', () => {
      expect(() =>
        service.executeImport(TENANT_ID, 'non-existent-upload-id'),
      ).toThrow(ImportNotFoundException);
    });

    it('deve lançar ImportInProgressException se já em andamento', async () => {
      // Primeiro validar para criar a sessão
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50 },
      ]);
      prisma.barrel.findMany.mockResolvedValue([]);

      const validation = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      // Executar primeira vez
      prisma.componentConfig.findMany.mockResolvedValue([]);
      txMock.barrel.findFirst.mockResolvedValue(null);
      txMock.barrel.createMany.mockResolvedValue({ count: 1 });
      txMock.barrel.findMany.mockResolvedValue([{ id: 'barrel-1' }]);

      service.executeImport(TENANT_ID, validation.uploadId);

      // Tentar executar novamente (já está in_progress)
      expect(() =>
        service.executeImport(TENANT_ID, validation.uploadId),
      ).toThrow(ImportInProgressException);
    });

    it('deve retornar status in_progress imediatamente', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50 },
      ]);
      prisma.barrel.findMany.mockResolvedValue([]);

      const validation = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      prisma.componentConfig.findMany.mockResolvedValue([]);
      txMock.barrel.findFirst.mockResolvedValue(null);
      txMock.barrel.createMany.mockResolvedValue({ count: 1 });
      txMock.barrel.findMany.mockResolvedValue([{ id: 'barrel-1' }]);

      const result = service.executeImport(TENANT_ID, validation.uploadId);

      expect(result.status).toBe('in_progress');
      expect(result.total).toBe(1);
    });

    it('deve rejeitar sessão de outro tenant', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50 },
      ]);
      prisma.barrel.findMany.mockResolvedValue([]);

      const validation = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      const otherTenant = '00000000-0000-0000-0000-000000000099';
      expect(() =>
        service.executeImport(otherTenant, validation.uploadId),
      ).toThrow(ImportNotFoundException);
    });
  });

  describe('getImportProgress', () => {
    it('deve retornar progresso da importação', async () => {
      excelService.parseFile.mockResolvedValue([
        { qrCode: 'QR-001', capacidade: 50 },
      ]);
      prisma.barrel.findMany.mockResolvedValue([]);

      const validation = await service.validateImport(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      const progress = service.getImportProgress(
        TENANT_ID,
        validation.uploadId,
      );

      expect(progress.status).toBe('validated');
      expect(progress.total).toBe(1);
      expect(progress.processed).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    it('deve lançar ImportNotFoundException para uploadId inexistente', () => {
      expect(() =>
        service.getImportProgress(TENANT_ID, 'non-existent'),
      ).toThrow(ImportNotFoundException);
    });
  });

  // =============================================
  // Feature 3: Vinculação de QR Codes
  // =============================================

  describe('findUnlinked', () => {
    it('deve retornar apenas barris com qrCode null', async () => {
      const mockUnlinked = [
        {
          id: '1',
          internalCode: 'KS-BAR-000000001',
          qrCode: null,
          componentCycles: [],
        },
      ];

      prisma.barrel.findMany.mockResolvedValue(mockUnlinked);
      prisma.barrel.count.mockResolvedValue(1);

      const result = await service.findUnlinked(TENANT_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual(mockUnlinked);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);

      // Verificar que o where inclui qrCode: null
      const whereArg = (
        prisma.barrel.findMany.mock.calls[0] as [
          { where: { qrCode: null; deletedAt: null } },
        ]
      )[0];
      expect(whereArg.where.qrCode).toBeNull();
      expect(whereArg.where.deletedAt).toBeNull();
    });

    it('deve respeitar paginação', async () => {
      prisma.barrel.findMany.mockResolvedValue([]);
      prisma.barrel.count.mockResolvedValue(50);

      const result = await service.findUnlinked(TENANT_ID, {
        page: 3,
        limit: 10,
      });

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);

      const callArgs = (
        prisma.barrel.findMany.mock.calls[0] as [{ skip: number; take: number }]
      )[0];
      expect(callArgs.skip).toBe(20); // (3-1) * 10
      expect(callArgs.take).toBe(10);
    });
  });

  describe('linkQr', () => {
    it('deve vincular QR code a um barril sem QR', async () => {
      const barrel = {
        id: 'barrel-1',
        internalCode: 'KS-BAR-000000001',
        qrCode: null,
        tenantId: TENANT_ID,
        componentCycles: [],
      };

      prisma.barrel.findFirst
        .mockResolvedValueOnce(barrel) // findById
        .mockResolvedValueOnce(null); // verificar QR não em uso

      prisma.barrel.update.mockResolvedValue({
        ...barrel,
        qrCode: 'QR-NEW-001',
      });

      const result = await service.linkQr(TENANT_ID, 'barrel-1', {
        qrCode: 'QR-NEW-001',
      });

      expect(result.qrCode).toBe('QR-NEW-001');
      expect(prisma.barrel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'barrel-1' },
          data: { qrCode: 'QR-NEW-001' },
        }),
      );
    });

    it('deve lançar erro se barril já possui QR code', async () => {
      const barrel = {
        id: 'barrel-1',
        internalCode: 'KS-BAR-000000001',
        qrCode: 'QR-EXISTING',
        tenantId: TENANT_ID,
        componentCycles: [],
      };

      prisma.barrel.findFirst.mockResolvedValueOnce(barrel);

      await expect(
        service.linkQr(TENANT_ID, 'barrel-1', { qrCode: 'QR-NEW' }),
      ).rejects.toThrow(BarrelQrCodeExistsException);
    });

    it('deve lançar erro se QR code já está em uso', async () => {
      const barrel = {
        id: 'barrel-1',
        internalCode: 'KS-BAR-000000001',
        qrCode: null,
        tenantId: TENANT_ID,
        componentCycles: [],
      };

      prisma.barrel.findFirst
        .mockResolvedValueOnce(barrel) // findById
        .mockResolvedValueOnce({ id: 'other-barrel' }); // QR já em uso

      await expect(
        service.linkQr(TENANT_ID, 'barrel-1', { qrCode: 'QR-IN-USE' }),
      ).rejects.toThrow(BarrelQrCodeExistsException);
    });

    it('deve lançar BarrelNotFoundException se barril não existe', async () => {
      prisma.barrel.findFirst.mockResolvedValue(null);

      await expect(
        service.linkQr(TENANT_ID, 'non-existent', { qrCode: 'QR-001' }),
      ).rejects.toThrow(BarrelNotFoundException);
    });
  });

  describe('batchLinkQr', () => {
    it('deve vincular múltiplos barris com sucesso', async () => {
      // Mock barrels lookup
      prisma.barrel.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            internalCode: 'KS-BAR-000000001',
            qrCode: null,
          },
          {
            id: 'b2',
            internalCode: 'KS-BAR-000000002',
            qrCode: null,
          },
        ]) // barrels by internalCode
        .mockResolvedValueOnce([]); // no existing QR codes

      prisma.barrel.update.mockResolvedValue({});

      const result = await service.batchLinkQr(TENANT_ID, [
        { internalCode: 'KS-BAR-000000001', qrCode: 'QR-001' },
        { internalCode: 'KS-BAR-000000002', qrCode: 'QR-002' },
      ]);

      expect(result.linked).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('deve reportar erro quando barril não é encontrado', async () => {
      prisma.barrel.findMany
        .mockResolvedValueOnce([]) // nenhum barril encontrado
        .mockResolvedValueOnce([]); // no existing QR codes

      const result = await service.batchLinkQr(TENANT_ID, [
        { internalCode: 'KS-BAR-INEXISTENTE', qrCode: 'QR-001' },
      ]);

      expect(result.linked).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('não encontrado');
    });

    it('deve reportar erro quando barril já tem QR code', async () => {
      prisma.barrel.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            internalCode: 'KS-BAR-000000001',
            qrCode: 'QR-EXISTING',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.batchLinkQr(TENANT_ID, [
        { internalCode: 'KS-BAR-000000001', qrCode: 'QR-NEW' },
      ]);

      expect(result.linked).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('já possui QR code');
    });

    it('deve reportar erro quando QR code já está em uso', async () => {
      prisma.barrel.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            internalCode: 'KS-BAR-000000001',
            qrCode: null,
          },
        ])
        .mockResolvedValueOnce([{ qrCode: 'QR-IN-USE' }]);

      const result = await service.batchLinkQr(TENANT_ID, [
        { internalCode: 'KS-BAR-000000001', qrCode: 'QR-IN-USE' },
      ]);

      expect(result.linked).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('já em uso');
    });

    it('deve detectar QR codes duplicados no batch', async () => {
      prisma.barrel.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            internalCode: 'KS-BAR-000000001',
            qrCode: null,
          },
          {
            id: 'b2',
            internalCode: 'KS-BAR-000000002',
            qrCode: null,
          },
        ])
        .mockResolvedValueOnce([]);

      prisma.barrel.update.mockResolvedValue({});

      const result = await service.batchLinkQr(TENANT_ID, [
        { internalCode: 'KS-BAR-000000001', qrCode: 'QR-SAME' },
        { internalCode: 'KS-BAR-000000002', qrCode: 'QR-SAME' }, // duplicata
      ]);

      expect(result.linked).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('duplicado no batch');
    });
  });

  describe('batchLinkQrFromFile', () => {
    it('deve parsear arquivo e delegar para batchLinkQr', async () => {
      excelService.parseFile.mockResolvedValue([
        { internalCode: 'KS-BAR-000000001', qrCode: 'QR-001' },
      ]);

      prisma.barrel.findMany
        .mockResolvedValueOnce([
          {
            id: 'b1',
            internalCode: 'KS-BAR-000000001',
            qrCode: null,
          },
        ])
        .mockResolvedValueOnce([]);

      prisma.barrel.update.mockResolvedValue({});

      const result = await service.batchLinkQrFromFile(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.linked).toBe(1);
      expect(excelService.parseFile).toHaveBeenCalledTimes(1);
    });

    it('deve retornar erro quando nenhum par encontrado no arquivo', async () => {
      excelService.parseFile.mockResolvedValue([
        { coluna_errada: 'valor' }, // sem internalCode nem qrCode
      ]);

      const result = await service.batchLinkQrFromFile(
        TENANT_ID,
        Buffer.from('mock'),
        'test.xlsx',
      );

      expect(result.linked).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('exportUnlinked', () => {
    it('deve exportar barris sem QR como Excel', async () => {
      prisma.barrel.findMany.mockResolvedValue([
        {
          internalCode: 'KS-BAR-000000001',
          manufacturer: 'Franke',
          capacityLiters: 50,
          valveModel: 'TYPE_S',
          material: 'INOX_304',
        },
      ]);

      excelService.generateFromData.mockResolvedValue(Buffer.from('xlsx-data'));

      const result = await service.exportUnlinked(TENANT_ID);

      expect(result).toBeInstanceOf(Buffer);
      expect(excelService.generateFromData).toHaveBeenCalledTimes(1);

      // Verificar que buscou apenas barris com qrCode null
      const whereArg = (
        prisma.barrel.findMany.mock.calls[0] as [
          { where: { qrCode: null; deletedAt: null } },
        ]
      )[0];
      expect(whereArg.where.qrCode).toBeNull();
      expect(whereArg.where.deletedAt).toBeNull();
    });
  });
});
