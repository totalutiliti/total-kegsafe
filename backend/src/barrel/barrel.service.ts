import {
  Injectable,
  Logger,
  BadRequestException,
  UnprocessableEntityException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BarrelStatus,
  BarrelMaterial,
  BarrelCondition,
  ValveModel,
  AlertType,
  AlertPriority,
  Prisma,
} from '@prisma/client';
import { CreateBarrelDto } from './dto/create-barrel.dto.js';
import { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import { QuickRegisterDto } from './dto/quick-register.dto.js';
import { LinkQrDto } from './dto/link-qr.dto.js';
import { ScanBarrelDto } from './dto/scan-barrel.dto.js';
import { GenerateBatchDto } from './dto/generate-batch.dto.js';
import { TransferBarrelDto } from './dto/transfer-barrel.dto.js';
import { ExcelService } from '../shared/services/excel.service.js';
import { AlertService } from '../alert/alert.service.js';
import { ComponentService } from '../component/component.service.js';
import {
  BarrelNotFoundException,
  BarrelQrCodeExistsException,
  BarrelInvalidStatusTransitionException,
} from '../shared/exceptions/barrel.exceptions.js';
import {
  ImportNotFoundException,
  ImportInProgressException,
} from '../shared/exceptions/import.exceptions.js';
import { OptimisticLockException } from '../shared/exceptions/resource.exceptions.js';

// Transições de status válidas conforme RULES.md
const VALID_TRANSITIONS: Record<string, string[]> = {
  PRE_REGISTERED: ['ACTIVE'],
  ACTIVE: ['IN_TRANSIT', 'IN_MAINTENANCE', 'BLOCKED', 'DISPOSED'],
  IN_TRANSIT: ['AT_CLIENT', 'ACTIVE'],
  AT_CLIENT: ['IN_TRANSIT', 'BLOCKED'],
  IN_MAINTENANCE: ['ACTIVE', 'BLOCKED', 'DISPOSED'],
  BLOCKED: ['IN_MAINTENANCE', 'DISPOSED', 'ACTIVE'],
  DISPOSED: [],
  LOST: ['ACTIVE', 'BLOCKED'],
};

/** Include padrão de barril com componentes (1 query otimizada via Prisma) */
const BARREL_INCLUDE = {
  componentCycles: {
    include: { componentConfig: true },
  },
} satisfies Prisma.BarrelInclude;

/** Número máximo de tentativas para gerar internalCode em caso de conflito */
const MAX_RETRIES = 3;

/** Tamanho do chunk para operações de importação em massa */
const IMPORT_CHUNK_SIZE = 500;

/** Colunas do template de importação */
const IMPORT_COLUMNS = [
  { header: 'qrCode', key: 'qrCode', width: 20, example: 'QR-001' },
  {
    header: 'numeroChassi',
    key: 'numeroChassi',
    width: 20,
    example: 'CH-000001',
  },
  { header: 'fabricante', key: 'fabricante', width: 20, example: 'Franke' },
  {
    header: 'modeloValvula',
    key: 'modeloValvula',
    width: 15,
    example: 'TYPE_S',
  },
  { header: 'capacidade', key: 'capacidade', width: 12, example: '50' },
  { header: 'pesoTara', key: 'pesoTara', width: 12, example: '13.2' },
  {
    header: 'material',
    key: 'material',
    width: 15,
    example: 'INOX_304',
  },
  {
    header: 'custoAquisicao',
    key: 'custoAquisicao',
    width: 15,
    example: '800',
  },
  { header: 'condicao', key: 'condicao', width: 12, example: 'NOVO' },
  {
    header: 'dataFabricacao',
    key: 'dataFabricacao',
    width: 18,
    example: '2023-01-15',
  },
  {
    header: 'ciclosAproximados',
    key: 'ciclosAproximados',
    width: 18,
    example: '0',
  },
];

interface UpdateRow extends ValidatedRow {
  existingBarrelId: string;
  existingInternalCode: string;
}

interface ImportSession {
  tenantId: string;
  rows: ValidatedRow[];
  updateRows: UpdateRow[];
  validatedAt: Date;
  status: 'validated' | 'in_progress' | 'completed' | 'failed';
  progress: {
    processed: number;
    total: number;
    failed: number;
    errors: Array<{ chunkStart: number; message: string }>;
  };
}

export interface ValidatedRow {
  qrCode: string;
  chassisNumber?: string;
  manufacturer?: string;
  valveModel?: ValveModel;
  capacityLiters: number;
  tareWeightKg?: number;
  material?: BarrelMaterial;
  acquisitionCost?: number;
  condition?: BarrelCondition;
  manufactureDate?: Date;
  initialCycles?: number;
}

@Injectable()
export class BarrelService {
  private readonly logger = new Logger(BarrelService.name);

  /** Sessões de importação em memória (TTL gerenciado por limpeza periódica) */
  private importSessions = new Map<string, ImportSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
    private readonly alertService: AlertService,
    private readonly componentService: ComponentService,
  ) {}

  /**
   * Listagem de barris com busca via trigram (ILIKE + GIN index)
   * e paginação otimizada.
   */
  async findAll(
    tenantId: string,
    query?: {
      status?: BarrelStatus;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    // Se tem busca por texto, usar raw query com ILIKE (índice trigram GIN)
    if (query?.search) {
      return this.findAllWithSearch(
        tenantId,
        query.search,
        query.status,
        page,
        limit,
        skip,
      );
    }

    // Sem busca: usar Prisma normalmente (índice composto [tenantId, status])
    const where: Prisma.BarrelWhereInput = {
      tenantId,
      deletedAt: null,
      ...(query?.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.barrel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: BARREL_INCLUDE,
      }),
      this.prisma.barrel.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Busca por texto usando ILIKE com índice trigram GIN.
   * Resolve o problema de LIKE '%texto%' com full table scan.
   * Usa 2 queries batch (IDs + hydrate) para evitar N+1.
   */
  private async findAllWithSearch(
    tenantId: string,
    search: string,
    status: BarrelStatus | undefined,
    page: number,
    limit: number,
    skip: number,
  ) {
    const searchPattern = `%${search}%`;
    const statusFilter = status
      ? Prisma.sql`AND "status" = ${status}::"BarrelStatus"`
      : Prisma.empty;

    // Query 1: buscar IDs + total count com ILIKE (usa índice trigram)
    const [matchedIds, countResult] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
                SELECT "id" FROM barrels
                WHERE "tenantId" = ${tenantId}::uuid
                  AND "deletedAt" IS NULL
                  ${statusFilter}
                  AND (unaccent("internalCode") ILIKE unaccent(${searchPattern}) OR unaccent(COALESCE("qrCode",'')) ILIKE unaccent(${searchPattern}))
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${skip}
            `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(*)::bigint AS "count" FROM barrels
                WHERE "tenantId" = ${tenantId}::uuid
                  AND "deletedAt" IS NULL
                  ${statusFilter}
                  AND (unaccent("internalCode") ILIKE unaccent(${searchPattern}) OR unaccent(COALESCE("qrCode",'')) ILIKE unaccent(${searchPattern}))
            `,
    ]);

    const total = Number(countResult[0].count);
    if (matchedIds.length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    // Query 2: hydrate com include completo (1 query Prisma com IN)
    const ids = matchedIds.map((r) => r.id);
    const items = await this.prisma.barrel.findMany({
      where: { id: { in: ids } },
      include: BARREL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const barrel = await this.prisma.barrel.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: BARREL_INCLUDE,
    });
    if (!barrel) {
      throw new BarrelNotFoundException(id);
    }
    return barrel;
  }

  async findByQrCode(tenantId: string, qrCode: string) {
    const barrel = await this.prisma.barrel.findFirst({
      where: { qrCode, tenantId, deletedAt: null },
      include: BARREL_INCLUDE,
    });
    if (!barrel) {
      throw new BarrelNotFoundException(qrCode);
    }
    return barrel;
  }

  async create(tenantId: string, dto: CreateBarrelDto) {
    const condition = dto.condition ?? BarrelCondition.NEW;
    const isUsed = condition === BarrelCondition.USED;

    // Validação cruzada: barris usados exigem data de fabricação e ciclos
    if (isUsed) {
      if (!dto.manufactureDate) {
        throw new BadRequestException(
          'Data de fabricação é obrigatória para barris usados',
        );
      }
      if (dto.initialCycles === undefined || dto.initialCycles === null) {
        throw new BadRequestException(
          'Ciclos aproximados é obrigatório para barris usados',
        );
      }
    }

    const initialCycles = isUsed ? (dto.initialCycles ?? 0) : 0;

    // Verificar unicidade GLOBAL do QR Code (QR Codes são etiquetas físicas únicas)
    if (dto.qrCode) {
      const existing = await this.prisma.barrel.findFirst({
        where: { qrCode: dto.qrCode, deletedAt: null },
      });
      if (existing) {
        throw new BarrelQrCodeExistsException(dto.qrCode);
      }
    }

    // Verificar unicidade do Chassi (apenas quando fornecido)
    if (dto.chassisNumber) {
      const existing = await this.prisma.barrel.findFirst({
        where: { chassisNumber: dto.chassisNumber, tenantId },
      });
      if (existing) {
        throw new ConflictException(
          `Já existe um barril com o chassi ${dto.chassisNumber}`,
        );
      }
    }

    // Gerar código interno via sequência global (protege contra race condition)
    const internalCode = await this.generateInternalCode();

    // Criar barril
    const barrel = await this.prisma.barrel.create({
      data: {
        tenantId,
        internalCode,
        qrCode: dto.qrCode ?? null,
        chassisNumber: dto.chassisNumber ?? null,
        barcode: dto.barcode,
        manufacturer: dto.manufacturer,
        valveModel: dto.valveModel,
        capacityLiters: dto.capacityLiters,
        tareWeightKg: dto.tareWeightKg,
        material: dto.material,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        manufactureDate: dto.manufactureDate
          ? new Date(dto.manufactureDate)
          : null,
        condition,
        totalCycles: initialCycles,
        acquisitionCost: dto.acquisitionCost,
        status: BarrelStatus.ACTIVE,
      },
    });

    // Criar ComponentCycles em batch com cálculo de saúde
    const componentConfigs = await this.prisma.componentConfig.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    if (componentConfigs.length > 0) {
      const serviceDate = dto.manufactureDate
        ? new Date(dto.manufactureDate)
        : new Date();

      const cyclesData = componentConfigs.map((config) => {
        const { healthScore, healthPercentage } =
          this.componentService.calculateHealthScore(
            initialCycles,
            config.maxCycles,
            serviceDate,
            config.maxDays,
          );
        return {
          id: randomUUID(),
          barrelId: barrel.id,
          componentConfigId: config.id,
          cyclesSinceLastService: initialCycles,
          lastServiceDate: serviceDate,
          healthScore,
          healthPercentage,
        };
      });

      await this.prisma.componentCycle.createMany({
        data: cyclesData,
        skipDuplicates: true,
      });

      // Alertas imediatos para componentes já acima de 80% (barris usados)
      if (isUsed) {
        const criticalCycles = cyclesData.filter(
          (c) => c.healthPercentage >= 80,
        );
        for (const cycle of criticalCycles) {
          const config = componentConfigs.find(
            (cfg) => cfg.id === cycle.componentConfigId,
          )!;
          await this.alertService.createAlert({
            tenantId,
            barrelId: barrel.id,
            type: AlertType.COMPONENT_END_OF_LIFE,
            priority:
              config.criticality === 'CRITICAL'
                ? AlertPriority.HIGH
                : AlertPriority.MEDIUM,
            title: `Componente ${config.name} próximo do limite`,
            description: `Componente com ${cycle.healthPercentage.toFixed(0)}% de uso no barril ${internalCode} (cadastro de barril usado)`,
            metadata: {
              componentName: config.name,
              healthPercentage: cycle.healthPercentage,
              registeredAsUsed: true,
            },
          });
        }
      }
    }

    return this.findById(tenantId, barrel.id);
  }

  /**
   * Gera o próximo internalCode usando a sequência global BarrelSequence.
   * Garante unicidade global (cross-tenant) com transaction serializable + retry.
   */
  async generateInternalCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const seq = await tx.barrelSequence.upsert({
              where: { key: 'global' },
              create: { key: 'global', lastNumber: 1 },
              update: { lastNumber: { increment: 1 } },
            });
            return `KS-BAR-${String(seq.lastNumber).padStart(9, '0')}`;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        const prismaError = error as {
          code?: string;
          message?: string;
          stack?: string;
        };
        const isRetryable =
          prismaError.code === 'P2034' || prismaError.code === 'P2002';

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          this.logger.warn(
            `internalCode generation conflict (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`,
          );
          await new Promise((r) =>
            setTimeout(r, Math.random() * 100 * (attempt + 1)),
          );
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate internalCode after max retries');
  }

  /** Campos imutáveis — só podem ser alterados por ADMIN com flag IMMUTABLE_OVERRIDE */
  private static readonly IMMUTABLE_FIELDS = [
    'chassisNumber',
    'manufactureDate',
    'capacityLiters',
    'material',
    'tareWeightKg',
  ] as const;

  async update(tenantId: string, id: string, dto: UpdateBarrelDto) {
    await this.findById(tenantId, id);

    // Verificar campos imutáveis
    const { version, ...updateData } = dto;
    const attempted = Object.keys(updateData);
    const violatedFields = attempted.filter((field) =>
      (BarrelService.IMMUTABLE_FIELDS as readonly string[]).includes(field),
    );

    if (violatedFields.length > 0) {
      throw new UnprocessableEntityException(
        `Os campos [${violatedFields.join(', ')}] são imutáveis e não podem ser alterados. Apenas ADMIN pode solicitar uma exceção.`,
      );
    }

    try {
      return await this.prisma.barrel.update({
        where: { id, version },
        data: {
          ...updateData,
          version: { increment: 1 },
        },
        include: BARREL_INCLUDE,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new OptimisticLockException('Barrel');
      }
      throw error;
    }
  }

  async delete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    return this.prisma.barrel.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Valida se a transição de status é permitida
   */
  validateStatusTransition(currentStatus: string, targetStatus: string): void {
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BarrelInvalidStatusTransitionException(
        currentStatus,
        targetStatus,
        allowed,
      );
    }
  }

  /**
   * Timeline do barril (últimos eventos)
   */
  async getTimeline(tenantId: string, barrelId: string) {
    await this.findById(tenantId, barrelId);
    const events = await this.prisma.logisticsEvent.findMany({
      where: { tenantId, barrelId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } },
    });
    return events;
  }

  // =============================================
  // Feature 1: Cadastro Rápido (Quick Register)
  // =============================================

  /**
   * Cadastro rápido via scan de QR Code.
   * Delega para create() — endpoint separado para semântica do frontend.
   */
  async quickRegister(tenantId: string, dto: QuickRegisterDto) {
    return this.create(tenantId, dto as CreateBarrelDto);
  }

  // =============================================
  // Feature 2: Importação via Planilha
  // =============================================

  /**
   * Gera N internalCodes sequenciais usando a sequência global BarrelSequence.
   * Garante unicidade global (cross-tenant) com transaction serializable + retry.
   * Usado pela importação em massa para evitar N transactions individuais.
   */
  async generateInternalCodes(count: number): Promise<string[]> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const seq = await tx.barrelSequence.upsert({
              where: { key: 'global' },
              create: { key: 'global', lastNumber: count },
              update: { lastNumber: { increment: count } },
            });
            const startNumber = seq.lastNumber - count + 1;
            return Array.from(
              { length: count },
              (_, i) =>
                `KS-BAR-${String(startNumber + i).padStart(9, '0')}`,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: unknown) {
        const prismaError = error as {
          code?: string;
          message?: string;
          stack?: string;
        };
        const isRetryable =
          prismaError.code === 'P2034' || prismaError.code === 'P2002';
        if (isRetryable && attempt < MAX_RETRIES - 1) {
          this.logger.warn(
            `internalCodes batch generation conflict (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`,
          );
          await new Promise((r) =>
            setTimeout(r, Math.random() * 100 * (attempt + 1)),
          );
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate internalCodes after max retries');
  }

  /**
   * Gera o template Excel para importação de barris.
   */
  async generateImportTemplate(): Promise<Buffer> {
    return this.excelService.generateTemplate(
      IMPORT_COLUMNS,
      [
        {
          qrCode: 'QR-EXEMPLO-001',
          numeroChassi: 'CH-000001',
          fabricante: 'Franke',
          modeloValvula: 'TYPE_S',
          capacidade: 50,
          pesoTara: 13.2,
          material: 'INOX_304',
          custoAquisicao: 800,
          condicao: 'NOVO',
          dataFabricacao: '',
          ciclosAproximados: '',
        },
        {
          qrCode: 'QR-EXEMPLO-002',
          numeroChassi: '',
          fabricante: 'Portinox',
          modeloValvula: 'TYPE_D',
          capacidade: 30,
          pesoTara: 10.5,
          material: 'INOX_316',
          custoAquisicao: 950,
          condicao: 'USADO',
          dataFabricacao: '2023-06-15',
          ciclosAproximados: 200,
        },
      ],
      [
        'Preencha cada linha com os dados de um barril.',
        'O campo qrCode é obrigatório e deve ser único.',
        'numeroChassi: número do chassi do barril (opcional, deve ser único se informado)',
        'modeloValvula aceita: TYPE_S, TYPE_D, TYPE_A, TYPE_G, TYPE_M, OTHER',
        'material aceita: INOX_304, INOX_316, PET_SLIM',
        'capacidade aceita: valores entre 5 e 100 (litros)',
        'condicao aceita: NOVO, USADO (padrão: NOVO)',
        'dataFabricacao: obrigatória se condicao=USADO (formato: AAAA-MM-DD)',
        'ciclosAproximados: obrigatório se condicao=USADO (inteiro >= 0)',
      ],
    );
  }

  /**
   * Valida um arquivo de importação e armazena em sessão temporária.
   */
  async validateImport(tenantId: string, buffer: Buffer, filename: string) {
    const rawRows = await this.excelService.parseFile(buffer, filename);
    const errors: { row: number; field: string; message: string }[] = [];
    const validRows: ValidatedRow[] = [];
    const seenQrCodes = new Set<string>();
    let duplicateRows = 0;

    const validValveModels = new Set(Object.values(ValveModel));
    const validMaterials = new Set(Object.values(BarrelMaterial));
    const seenChassisNumbers = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // +2 porque header é linha 1

      // qrCode obrigatório
      const qrCode = String(row['qrCode'] ?? '').trim();
      if (!qrCode) {
        errors.push({
          row: rowNum,
          field: 'qrCode',
          message: 'QR Code é obrigatório',
        });
        continue;
      }

      // Duplicata interna de QR code
      if (seenQrCodes.has(qrCode)) {
        errors.push({
          row: rowNum,
          field: 'qrCode',
          message: `QR Code duplicado no arquivo: ${qrCode}`,
        });
        duplicateRows++;
        continue;
      }
      seenQrCodes.add(qrCode);

      // Parsear chassi (opcional)
      const chassisNumber = row['numeroChassi']
        ? String(row['numeroChassi']).trim()
        : undefined;
      if (chassisNumber) {
        if (seenChassisNumbers.has(chassisNumber)) {
          errors.push({
            row: rowNum,
            field: 'numeroChassi',
            message: `Número de chassi duplicado no arquivo: ${chassisNumber}`,
          });
          duplicateRows++;
          continue;
        }
        seenChassisNumbers.add(chassisNumber);
      }

      // capacidade obrigatória
      const capacityLiters = Number(row['capacidade']);
      if (!capacityLiters || capacityLiters < 5 || capacityLiters > 100) {
        errors.push({
          row: rowNum,
          field: 'capacidade',
          message: 'Capacidade deve ser um número entre 5 e 100',
        });
        continue;
      }

      // Validar enums opcionais
      const valveModel = row['modeloValvula']
        ? String(row['modeloValvula']).trim()
        : undefined;
      if (valveModel && !validValveModels.has(valveModel as ValveModel)) {
        errors.push({
          row: rowNum,
          field: 'modeloValvula',
          message: `Modelo de válvula inválido: ${valveModel}`,
        });
        continue;
      }

      const material = row['material']
        ? String(row['material']).trim()
        : undefined;
      if (material && !validMaterials.has(material as BarrelMaterial)) {
        errors.push({
          row: rowNum,
          field: 'material',
          message: `Material inválido: ${material}`,
        });
        continue;
      }

      // Parsear condição (NOVO/USADO)
      const condicaoRaw = row['condicao']
        ? String(row['condicao']).trim().toUpperCase()
        : '';
      let condition: BarrelCondition = BarrelCondition.NEW;
      if (condicaoRaw === 'USADO' || condicaoRaw === 'USED') {
        condition = BarrelCondition.USED;
      } else if (
        condicaoRaw !== '' &&
        condicaoRaw !== 'NOVO' &&
        condicaoRaw !== 'NEW'
      ) {
        errors.push({
          row: rowNum,
          field: 'condicao',
          message: `Condição inválida: ${condicaoRaw}. Use NOVO ou USADO`,
        });
        continue;
      }

      // Parsear data de fabricação
      let manufactureDate: Date | undefined;
      if (row['dataFabricacao']) {
        const d = new Date(String(row['dataFabricacao']));
        if (isNaN(d.getTime())) {
          errors.push({
            row: rowNum,
            field: 'dataFabricacao',
            message: 'Data de fabricação inválida',
          });
          continue;
        }
        manufactureDate = d;
      }
      if (condition === BarrelCondition.USED && !manufactureDate) {
        errors.push({
          row: rowNum,
          field: 'dataFabricacao',
          message: 'Data de fabricação é obrigatória para barris usados',
        });
        continue;
      }

      // Parsear ciclos aproximados
      let initialCycles: number | undefined;
      if (row['ciclosAproximados']) {
        initialCycles = parseInt(String(row['ciclosAproximados']), 10);
        if (isNaN(initialCycles) || initialCycles < 0) {
          errors.push({
            row: rowNum,
            field: 'ciclosAproximados',
            message: 'Ciclos aproximados deve ser um número inteiro >= 0',
          });
          continue;
        }
      }
      if (
        condition === BarrelCondition.USED &&
        (initialCycles === undefined || initialCycles === null)
      ) {
        errors.push({
          row: rowNum,
          field: 'ciclosAproximados',
          message: 'Ciclos aproximados é obrigatório para barris usados',
        });
        continue;
      }

      validRows.push({
        qrCode,
        chassisNumber,
        manufacturer: row['fabricante']
          ? String(row['fabricante']).trim()
          : undefined,
        valveModel: valveModel as ValveModel | undefined,
        capacityLiters,
        tareWeightKg: row['pesoTara'] ? Number(row['pesoTara']) : undefined,
        material: material as BarrelMaterial | undefined,
        acquisitionCost: row['custoAquisicao']
          ? Number(row['custoAquisicao'])
          : undefined,
        condition,
        manufactureDate,
        initialCycles: initialCycles ?? 0,
      });
    }

    // Verificar QR codes e chassis existentes no banco em batch
    // QR Code é verificado GLOBALMENTE (não per-tenant) — são etiquetas físicas únicas
    const updateRows: UpdateRow[] = [];

    if (validRows.length > 0) {
      const qrCodesToCheck = validRows.map((r) => r.qrCode);
      const chassisToCheck = validRows
        .filter((r) => r.chassisNumber)
        .map((r) => r.chassisNumber!);

      const [existingByQr, existingByChassis] = await Promise.all([
        // Busca GLOBAL por qrCode (sem filtro de tenantId)
        this.prisma.barrel.findMany({
          where: {
            qrCode: { in: qrCodesToCheck },
            deletedAt: null,
          },
          select: {
            id: true,
            qrCode: true,
            internalCode: true,
            status: true,
            tenantId: true,
          },
        }),
        chassisToCheck.length > 0
          ? this.prisma.barrel.findMany({
              where: {
                tenantId,
                chassisNumber: { in: chassisToCheck },
                deletedAt: null,
              },
              select: { chassisNumber: true, internalCode: true },
            })
          : ([] as { chassisNumber: string | null; internalCode: string }[]),
      ]);

      // Separar PRE_REGISTERED (rota de atualização) de duplicatas reais
      const preRegisteredByQr = new Map<
        string,
        { id: string; internalCode: string }
      >();
      const duplicateQrCodes = new Set<string>();

      for (const barrel of existingByQr) {
        if (
          barrel.status === BarrelStatus.PRE_REGISTERED &&
          barrel.tenantId === tenantId
        ) {
          // PRE_REGISTERED do MESMO tenant — rota de atualização
          preRegisteredByQr.set(barrel.qrCode!, {
            id: barrel.id,
            internalCode: barrel.internalCode,
          });
        } else {
          // Barril ativo OU PRE_REGISTERED de OUTRO tenant — duplicata
          duplicateQrCodes.add(barrel.qrCode!);
        }
      }

      const existingChassis = new Set(
        existingByChassis.map((b) => b.chassisNumber),
      );
      const remainingValid: ValidatedRow[] = [];

      for (const row of validRows) {
        if (duplicateQrCodes.has(row.qrCode)) {
          const existing = existingByQr.find(
            (b) => b.qrCode === row.qrCode,
          );
          const isOtherTenant =
            existing?.status === BarrelStatus.PRE_REGISTERED &&
            existing?.tenantId !== tenantId;
          errors.push({
            row: 0,
            field: 'qrCode',
            message: isOtherTenant
              ? `QR Code pertence a outro cliente: ${row.qrCode}`
              : `QR Code já em uso: ${row.qrCode} (barril ${existing?.internalCode ?? '?'})`,
          });
          duplicateRows++;
        } else if (preRegisteredByQr.has(row.qrCode)) {
          // PRE_REGISTERED — rota de atualização (não é erro)
          const existing = preRegisteredByQr.get(row.qrCode)!;
          updateRows.push({
            ...row,
            existingBarrelId: existing.id,
            existingInternalCode: existing.internalCode,
          });
        } else if (
          row.chassisNumber &&
          existingChassis.has(row.chassisNumber)
        ) {
          const existing = existingByChassis.find(
            (b) => b.chassisNumber === row.chassisNumber,
          );
          errors.push({
            row: 0,
            field: 'numeroChassi',
            message: `Chassi já existe no sistema: ${row.chassisNumber} (barril ${existing?.internalCode ?? '?'})`,
          });
          duplicateRows++;
        } else {
          remainingValid.push(row);
        }
      }

      validRows.length = 0;
      validRows.push(...remainingValid);
    }

    // Armazenar em sessão temporária
    const uploadId = randomUUID();
    this.importSessions.set(uploadId, {
      tenantId,
      rows: validRows,
      updateRows,
      validatedAt: new Date(),
      status: 'validated',
      progress: {
        processed: 0,
        total: validRows.length + updateRows.length,
        failed: 0,
        errors: [],
      },
    });

    // Limpar sessões antigas (>30 min)
    this.cleanExpiredSessions();

    return {
      uploadId,
      totalRows: rawRows.length,
      validRows: validRows.length,
      updateRows: updateRows.length,
      errorRows: errors.length,
      duplicateRows,
      errors,
      preview: validRows.slice(0, 100),
      updatePreview: updateRows.slice(0, 50),
    };
  }

  /**
   * Executa importação de barris validados, processando em chunks.
   * Retorna imediatamente e processa em background.
   */
  executeImport(tenantId: string, uploadId: string) {
    const session = this.importSessions.get(uploadId);
    if (!session || session.tenantId !== tenantId) {
      throw new ImportNotFoundException(uploadId);
    }
    if (session.status === 'in_progress') {
      throw new ImportInProgressException(uploadId);
    }

    session.status = 'in_progress';
    const totalRows = session.rows.length + session.updateRows.length;
    session.progress = {
      processed: 0,
      total: totalRows,
      failed: 0,
      errors: [],
    };

    // Processar em background (não bloquear a response)
    setImmediate(() => {
      void this.processImportChunks(tenantId, session);
    });

    return {
      uploadId,
      status: 'in_progress',
      total: totalRows,
    };
  }

  /**
   * Processa chunks de importação sequencialmente.
   * Parte 1: Cria barris novos (rows)
   * Parte 2: Atualiza barris PRE_REGISTERED com dados da planilha (updateRows)
   */
  private async processImportChunks(tenantId: string, session: ImportSession) {
    // Buscar componentConfigs uma vez (usado para todos os chunks)
    const componentConfigs = await this.prisma.componentConfig.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    // === Parte 1: Criar barris novos ===
    const createRows = session.rows;
    const createChunks: ValidatedRow[][] = [];
    for (let i = 0; i < createRows.length; i += IMPORT_CHUNK_SIZE) {
      createChunks.push(createRows.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    for (const chunk of createChunks) {
      try {
        // Gerar internalCodes em batch via sequência global (1 serializable tx)
        const codes = await this.generateInternalCodes(chunk.length);

        // Preparar dados de barris (id gerado explicitamente — createMany não usa @default(uuid()))
        const barrelData = chunk.map((row, i) => ({
          id: randomUUID(),
          tenantId,
          internalCode: codes[i],
          qrCode: row.qrCode,
          chassisNumber: row.chassisNumber ?? null,
          manufacturer: row.manufacturer ?? null,
          valveModel: row.valveModel ?? null,
          capacityLiters: row.capacityLiters,
          tareWeightKg: row.tareWeightKg ?? null,
          material: row.material ?? 'INOX_304',
          acquisitionCost: row.acquisitionCost ?? null,
          condition: row.condition ?? BarrelCondition.NEW,
          manufactureDate: row.manufactureDate ?? null,
          totalCycles: row.initialCycles ?? 0,
          status: BarrelStatus.ACTIVE,
        }));

        // Mapear qrCode → row para lookup de ciclos
        const rowByQr = new Map(chunk.map((r) => [r.qrCode, r]));

        await this.prisma.$transaction(
          async (tx) => {
            // Batch insert barris
            await tx.barrel.createMany({ data: barrelData });

            // Batch insert componentCycles com cálculo de saúde
            if (componentConfigs.length > 0 && barrelData.length > 0) {
              const cyclesData = barrelData.flatMap((barrel) => {
                const row = rowByQr.get(barrel.qrCode);
                const cycles = row?.initialCycles ?? 0;
                const serviceDate = row?.manufactureDate ?? new Date();
                return componentConfigs.map((config) => {
                  const { healthScore, healthPercentage } =
                    this.componentService.calculateHealthScore(
                      cycles,
                      config.maxCycles,
                      serviceDate,
                      config.maxDays,
                    );
                  return {
                    id: randomUUID(),
                    barrelId: barrel.id,
                    componentConfigId: config.id,
                    cyclesSinceLastService: cycles,
                    lastServiceDate: serviceDate,
                    healthScore,
                    healthPercentage,
                  };
                });
              });

              await tx.componentCycle.createMany({
                data: cyclesData,
                skipDuplicates: true,
              });

              // Alertas para componentes >= 80% (barris usados importados)
              const alertsData = cyclesData
                .filter((c) => c.healthPercentage >= 80)
                .map((c) => {
                  const config = componentConfigs.find(
                    (cfg) => cfg.id === c.componentConfigId,
                  )!;
                  return {
                    id: randomUUID(),
                    tenantId,
                    barrelId: c.barrelId,
                    alertType: AlertType.COMPONENT_END_OF_LIFE,
                    priority:
                      config.criticality === 'CRITICAL'
                        ? AlertPriority.HIGH
                        : AlertPriority.MEDIUM,
                    title: `Componente ${config.name} próximo do limite`,
                    description: `Componente com ${Math.round(c.healthPercentage)}% de uso (importação em massa)`,
                    metadata: {
                      componentName: config.name,
                      healthPercentage: c.healthPercentage,
                    } as Prisma.InputJsonValue,
                  };
                });

              if (alertsData.length > 0) {
                await tx.alert.createMany({
                  data: alertsData,
                  skipDuplicates: true,
                });
              }
            }
          },
          { timeout: 60000 },
        );

        session.progress.processed += chunk.length;
      } catch (error: unknown) {
        const errObj = error as { message?: string; stack?: string };
        const message = errObj.message ?? 'Unknown error';
        session.progress.failed += chunk.length;
        session.progress.errors.push({
          chunkStart: session.progress.processed,
          message,
        });
        this.logger.error(`Import create chunk failed: ${message}`, errObj.stack);
      }
    }

    // === Parte 2: Atualizar barris PRE_REGISTERED ===
    const updateChunks: UpdateRow[][] = [];
    for (let i = 0; i < session.updateRows.length; i += IMPORT_CHUNK_SIZE) {
      updateChunks.push(session.updateRows.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    for (const chunk of updateChunks) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            for (const row of chunk) {
              // Atualizar barril PRE_REGISTERED com dados da planilha
              await tx.barrel.update({
                where: { id: row.existingBarrelId },
                data: {
                  tenantId,
                  chassisNumber: row.chassisNumber ?? null,
                  manufacturer: row.manufacturer ?? null,
                  valveModel: row.valveModel ?? null,
                  capacityLiters: row.capacityLiters,
                  tareWeightKg: row.tareWeightKg ?? null,
                  material: row.material ?? 'INOX_304',
                  acquisitionCost: row.acquisitionCost ?? null,
                  condition: row.condition ?? BarrelCondition.NEW,
                  manufactureDate: row.manufactureDate ?? null,
                  totalCycles: row.initialCycles ?? 0,
                  status: BarrelStatus.ACTIVE,
                  version: { increment: 1 },
                },
              });

              // Criar ComponentCycles para o barril atualizado
              if (componentConfigs.length > 0) {
                const cycles = row.initialCycles ?? 0;
                const serviceDate = row.manufactureDate ?? new Date();
                const cyclesData = componentConfigs.map((config) => {
                  const { healthScore, healthPercentage } =
                    this.componentService.calculateHealthScore(
                      cycles,
                      config.maxCycles,
                      serviceDate,
                      config.maxDays,
                    );
                  return {
                    id: randomUUID(),
                    barrelId: row.existingBarrelId,
                    componentConfigId: config.id,
                    cyclesSinceLastService: cycles,
                    lastServiceDate: serviceDate,
                    healthScore,
                    healthPercentage,
                  };
                });
                await tx.componentCycle.createMany({
                  data: cyclesData,
                  skipDuplicates: true,
                });

                // Alertas para componentes >= 80%
                const criticalCycles = cyclesData.filter(
                  (c) => c.healthPercentage >= 80,
                );
                for (const cycle of criticalCycles) {
                  const config = componentConfigs.find(
                    (cfg) => cfg.id === cycle.componentConfigId,
                  )!;
                  await tx.alert.create({
                    data: {
                      tenantId,
                      barrelId: row.existingBarrelId,
                      alertType: AlertType.COMPONENT_END_OF_LIFE,
                      priority:
                        config.criticality === 'CRITICAL'
                          ? AlertPriority.HIGH
                          : AlertPriority.MEDIUM,
                      title: `Componente ${config.name} próximo do limite`,
                      description: `Componente com ${Math.round(cycle.healthPercentage)}% de uso (importação de pré-registrado)`,
                      metadata: {
                        componentName: config.name,
                        healthPercentage: cycle.healthPercentage,
                      } as Prisma.InputJsonValue,
                    },
                  });
                }
              }
            }
          },
          { timeout: 60000 },
        );

        session.progress.processed += chunk.length;
      } catch (error: unknown) {
        const errObj = error as { message?: string; stack?: string };
        const message = errObj.message ?? 'Unknown error';
        session.progress.failed += chunk.length;
        session.progress.errors.push({
          chunkStart: session.progress.processed,
          message,
        });
        this.logger.error(
          `Import update chunk failed: ${message}`,
          errObj.stack,
        );
      }
    }

    session.status =
      session.progress.failed > 0 && session.progress.processed === 0
        ? 'failed'
        : 'completed';
  }

  /**
   * Retorna o progresso de uma importação em andamento.
   */
  getImportProgress(tenantId: string, uploadId: string) {
    const session = this.importSessions.get(uploadId);
    if (!session || session.tenantId !== tenantId) {
      throw new ImportNotFoundException(uploadId);
    }

    return {
      status: session.status,
      total: session.progress.total,
      processed: session.progress.processed,
      failed: session.progress.failed,
      percentage:
        session.progress.total > 0
          ? Math.round(
              ((session.progress.processed + session.progress.failed) /
                session.progress.total) *
                100,
            )
          : 0,
      errors: session.progress.errors,
    };
  }

  /** Limpa sessões de importação expiradas (>30 minutos). */
  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.importSessions) {
      if (now - session.validatedAt.getTime() > 30 * 60 * 1000) {
        this.importSessions.delete(id);
      }
    }
  }

  // =============================================
  // Feature 3: Vinculação de QR Codes
  // =============================================

  /**
   * Lista barris sem QR code vinculado (qrCode IS NULL).
   */
  async findUnlinked(
    tenantId: string,
    query?: { page?: number; limit?: number },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BarrelWhereInput = {
      tenantId,
      deletedAt: null,
      qrCode: null,
    };

    const [items, total] = await Promise.all([
      this.prisma.barrel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: BARREL_INCLUDE,
      }),
      this.prisma.barrel.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Vincula um QR code a um barril individual.
   */
  async linkQr(tenantId: string, barrelId: string, dto: LinkQrDto) {
    const barrel = await this.findById(tenantId, barrelId);

    if (barrel.qrCode) {
      throw new BarrelQrCodeExistsException(
        `Barril ${barrel.internalCode} já possui QR code: ${barrel.qrCode}`,
      );
    }

    // Verificar se qrCode não está em uso
    const existing = await this.prisma.barrel.findFirst({
      where: { qrCode: dto.qrCode, tenantId, deletedAt: null },
    });
    if (existing) {
      throw new BarrelQrCodeExistsException(dto.qrCode);
    }

    return this.prisma.barrel.update({
      where: { id: barrelId },
      data: { qrCode: dto.qrCode },
      include: BARREL_INCLUDE,
    });
  }

  /**
   * Vincula QR codes em massa a partir de pares internalCode/qrCode.
   */
  async batchLinkQr(
    tenantId: string,
    items: { internalCode: string; qrCode: string }[],
  ) {
    const errors: { internalCode: string; message: string }[] = [];
    const validLinks: { barrelId: string; qrCode: string }[] = [];

    // Buscar todos os barris por internalCode
    const barrels = await this.prisma.barrel.findMany({
      where: {
        tenantId,
        internalCode: { in: items.map((i) => i.internalCode) },
        deletedAt: null,
      },
      select: { id: true, internalCode: true, qrCode: true },
    });
    const barrelMap = new Map(barrels.map((b) => [b.internalCode, b]));

    // Verificar qrCodes já em uso
    const existingQr = await this.prisma.barrel.findMany({
      where: {
        tenantId,
        qrCode: { in: items.map((i) => i.qrCode) },
        deletedAt: null,
      },
      select: { qrCode: true },
    });
    const usedQrCodes = new Set(existingQr.map((b) => b.qrCode));

    // Validar cada item
    const seenQr = new Set<string>();
    for (const item of items) {
      const barrel = barrelMap.get(item.internalCode);
      if (!barrel) {
        errors.push({
          internalCode: item.internalCode,
          message: 'Barril não encontrado',
        });
        continue;
      }
      if (barrel.qrCode) {
        errors.push({
          internalCode: item.internalCode,
          message: `Barril já possui QR code: ${barrel.qrCode}`,
        });
        continue;
      }
      if (usedQrCodes.has(item.qrCode)) {
        errors.push({
          internalCode: item.internalCode,
          message: `QR code já em uso: ${item.qrCode}`,
        });
        continue;
      }
      if (seenQr.has(item.qrCode)) {
        errors.push({
          internalCode: item.internalCode,
          message: `QR code duplicado no batch: ${item.qrCode}`,
        });
        continue;
      }
      seenQr.add(item.qrCode);
      validLinks.push({ barrelId: barrel.id, qrCode: item.qrCode });
    }

    // Atualizar em chunks
    let linked = 0;
    for (let i = 0; i < validLinks.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = validLinks.slice(i, i + IMPORT_CHUNK_SIZE);
      await this.prisma.$transaction(
        chunk.map((link) =>
          this.prisma.barrel.update({
            where: { id: link.barrelId },
            data: { qrCode: link.qrCode },
          }),
        ),
      );
      linked += chunk.length;
    }

    return { linked, errors };
  }

  /**
   * Vincula QR codes em massa a partir de arquivo Excel/CSV.
   */
  async batchLinkQrFromFile(
    tenantId: string,
    buffer: Buffer,
    filename: string,
  ) {
    const rawRows = await this.excelService.parseFile(buffer, filename);
    const items = rawRows
      .filter((r) => r['internalCode'] && r['qrCode'])
      .map((r) => ({
        internalCode: String(r['internalCode']).trim(),
        qrCode: String(r['qrCode']).trim(),
      }));

    if (items.length === 0) {
      return {
        linked: 0,
        errors: [
          {
            internalCode: '-',
            message: 'Nenhum par internalCode/qrCode encontrado no arquivo',
          },
        ],
      };
    }

    return this.batchLinkQr(tenantId, items);
  }

  /**
   * Exporta barris sem QR code para arquivo Excel.
   */
  async exportUnlinked(tenantId: string): Promise<Buffer> {
    const barrels = await this.prisma.barrel.findMany({
      where: { tenantId, deletedAt: null, qrCode: null },
      select: {
        internalCode: true,
        manufacturer: true,
        capacityLiters: true,
        valveModel: true,
        material: true,
      },
      orderBy: { internalCode: 'asc' },
    });

    const columns = [
      { header: 'internalCode', key: 'internalCode', width: 22 },
      { header: 'fabricante', key: 'manufacturer', width: 20 },
      { header: 'capacidade', key: 'capacityLiters', width: 12 },
      { header: 'modeloValvula', key: 'valveModel', width: 15 },
      { header: 'material', key: 'material', width: 15 },
      { header: 'qrCode', key: 'qrCode', width: 20 },
    ];

    return this.excelService.generateFromData(
      columns,
      barrels as Record<string, any>[],
      'Barris sem QR',
    );
  }

  // =========================================================================
  // QR Code como Fonte da Verdade
  // =========================================================================

  /**
   * Normaliza código escaneado para formato canônico KS-BAR-NNNNNNNNN.
   * Aceita tanto KS-NNNNNNNNN quanto KS-BAR-NNNNNNNNN.
   */
  private normalizeCode(code: string): string {
    if (code.startsWith('KS-BAR-')) return code;
    // KS-000000001 → KS-BAR-000000001
    return code.replace(/^KS-/, 'KS-BAR-');
  }

  /**
   * Scan-or-Create: busca barril pelo código escaneado ou cria um novo.
   *
   * Fluxo:
   * 1. Valida formato do código (KS-BAR-NNNNNNNNN ou KS-NNNNNNNNN)
   * 2. Normaliza para KS-BAR-NNNNNNNNN
   * 3. Busca no banco (cross-tenant pelo internalCode)
   * 4. Se encontrado com mesmo tenant → retorna
   * 5. Se encontrado com outro tenant → erro (deve usar transfer)
   * 6. Se PRE_REGISTERED → ativa no tenant que escaneou
   * 7. Se não encontrado → cria novo com dados mínimos
   */
  async scanOrCreate(
    tenantId: string,
    dto: ScanBarrelDto,
  ): Promise<{ barrel: unknown; action: 'found' | 'activated' | 'created' }> {
    const code = this.normalizeCode(dto.code);

    // Busca cross-tenant pelo internalCode
    const existing = await this.prisma.barrel.findFirst({
      where: { internalCode: code, deletedAt: null },
      include: BARREL_INCLUDE,
    });

    if (existing) {
      // Barril PRE_REGISTERED → ativar no tenant que escaneou
      if (existing.status === BarrelStatus.PRE_REGISTERED) {
        const activated = await this.prisma.barrel.update({
          where: { id: existing.id },
          data: {
            tenantId,
            status: BarrelStatus.ACTIVE,
            qrCode: code,
            version: { increment: 1 },
          },
          include: BARREL_INCLUDE,
        });

        // Criar ComponentCycles para o novo tenant
        const componentConfigs = await this.prisma.componentConfig.findMany({
          where: { tenantId, isActive: true, deletedAt: null },
        });
        if (componentConfigs.length > 0) {
          const serviceDate = new Date();
          const cyclesData = componentConfigs.map((config) => {
            const { healthScore, healthPercentage } =
              this.componentService.calculateHealthScore(
                0,
                config.maxCycles,
                serviceDate,
                config.maxDays,
              );
            return {
              id: randomUUID(),
              barrelId: activated.id,
              componentConfigId: config.id,
              cyclesSinceLastService: 0,
              lastServiceDate: serviceDate,
              healthScore,
              healthPercentage,
            };
          });
          await this.prisma.componentCycle.createMany({
            data: cyclesData,
            skipDuplicates: true,
          });
        }

        return { barrel: activated, action: 'activated' };
      }

      // Mesmo tenant → retorna normalmente
      if (existing.tenantId === tenantId) {
        return { barrel: existing, action: 'found' };
      }

      // Outro tenant → erro
      throw new BadRequestException(
        'Este barril pertence a outra cervejaria. Use a funcionalidade de transferência.',
      );
    }

    // Não encontrado → criar novo barril com dados mínimos
    const barrel = await this.prisma.barrel.create({
      data: {
        tenantId,
        internalCode: code,
        qrCode: code,
        capacityLiters: 50,
        material: BarrelMaterial.INOX_304,
        condition: BarrelCondition.NEW,
        status: BarrelStatus.ACTIVE,
      },
      include: BARREL_INCLUDE,
    });

    // Sincronizar BarrelSequence para evitar colisão futura
    const codeNumber = parseInt(code.replace('KS-BAR-', ''), 10);
    if (!isNaN(codeNumber)) {
      await this.prisma.$executeRaw`
        UPDATE barrel_sequences
        SET "lastNumber" = GREATEST("lastNumber", ${codeNumber}), "updatedAt" = NOW()
        WHERE key = 'global'
      `;
    }

    // Criar ComponentCycles
    const componentConfigs = await this.prisma.componentConfig.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });
    if (componentConfigs.length > 0) {
      const serviceDate = new Date();
      const cyclesData = componentConfigs.map((config) => {
        const { healthScore, healthPercentage } =
          this.componentService.calculateHealthScore(
            0,
            config.maxCycles,
            serviceDate,
            config.maxDays,
          );
        return {
          id: randomUUID(),
          barrelId: barrel.id,
          componentConfigId: config.id,
          cyclesSinceLastService: 0,
          lastServiceDate: serviceDate,
          healthScore,
          healthPercentage,
        };
      });
      await this.prisma.componentCycle.createMany({
        data: cyclesData,
        skipDuplicates: true,
      });
    }

    return { barrel, action: 'created' };
  }

  /**
   * Gera códigos em lote para gravação a laser.
   * Cria registros PRE_REGISTERED com códigos sequenciais globais.
   * Usa BarrelSequence para garantir unicidade global.
   * Cria BarrelBatch para rastreamento do lote.
   */
  async generateBatch(
    tenantId: string,
    dto: GenerateBatchDto,
    actorId?: string,
  ): Promise<{
    batchId: string;
    codes: string[];
    range: { start: string; end: string };
    quantity: number;
    tenant: string | null;
  }> {
    const { quantity } = dto;
    // Se o DTO especifica um tenantId (super admin), usar esse; senão usar o do caller
    const targetTenantId = dto.tenantId ?? tenantId;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            // Atualizar sequência global atomicamente
            const seq = await tx.barrelSequence.upsert({
              where: { key: 'global' },
              create: { key: 'global', lastNumber: quantity },
              update: { lastNumber: { increment: quantity } },
            });

            const startNumber = seq.lastNumber - quantity + 1;

            // Gerar códigos
            const codes: string[] = [];
            for (let i = 0; i < quantity; i++) {
              codes.push(
                `KS-BAR-${String(startNumber + i).padStart(9, '0')}`,
              );
            }

            const codeStart = codes[0];
            const codeEnd = codes[codes.length - 1];

            // Criar barris PRE_REGISTERED em lotes de 1000 (PostgreSQL limit)
            const chunkSize = 1000;
            for (let i = 0; i < codes.length; i += chunkSize) {
              const chunk = codes.slice(i, i + chunkSize);
              await tx.barrel.createMany({
                data: chunk.map((code) => ({
                  id: randomUUID(),
                  tenantId: targetTenantId,
                  internalCode: code,
                  qrCode: code,
                  capacityLiters: 50,
                  material: BarrelMaterial.INOX_304,
                  condition: BarrelCondition.NEW,
                  status: BarrelStatus.PRE_REGISTERED,
                })),
              });
            }

            // Criar registro de lote
            const batch = await tx.barrelBatch.create({
              data: {
                tenantId: dto.tenantId ?? null,
                codeStart,
                codeEnd,
                quantity,
                createdById: actorId ?? tenantId,
              },
              include: { tenant: { select: { name: true } } },
            });

            return {
              batchId: batch.id,
              codes,
              range: { start: codeStart, end: codeEnd },
              quantity,
              tenant: batch.tenant?.name ?? null,
            };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 60000,
          },
        );

        return result;
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        const isRetryable =
          prismaError.code === 'P2034' || prismaError.code === 'P2002';

        if (isRetryable && attempt < MAX_RETRIES - 1) {
          this.logger.warn(
            `generateBatch conflict (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`,
          );
          await new Promise((r) =>
            setTimeout(r, Math.random() * 100 * (attempt + 1)),
          );
          continue;
        }
        throw error;
      }
    }

    throw new Error('Failed to generate batch after max retries');
  }

  /**
   * Transfere um barril para outro tenant.
   * Cria registro de OwnershipHistory e atualiza o tenantId do barril.
   */
  async transferBarrel(
    tenantId: string,
    barrelId: string,
    dto: TransferBarrelDto,
  ): Promise<unknown> {
    await this.findById(tenantId, barrelId);

    if (dto.toTenantId === tenantId) {
      throw new BadRequestException(
        'Não é possível transferir o barril para o mesmo tenant',
      );
    }

    // Verificar que o tenant destino existe
    const targetTenant = await this.prisma.tenant.findUnique({
      where: { id: dto.toTenantId },
    });
    if (!targetTenant) {
      throw new BadRequestException('Tenant de destino não encontrado');
    }

    // Executar transferência em transação
    const [updatedBarrel] = await this.prisma.$transaction([
      // Atualizar o tenant do barril
      this.prisma.barrel.update({
        where: { id: barrelId },
        data: {
          tenantId: dto.toTenantId,
          status: BarrelStatus.ACTIVE,
          version: { increment: 1 },
        },
        include: BARREL_INCLUDE,
      }),
      // Registrar histórico de propriedade
      this.prisma.ownershipHistory.create({
        data: {
          barrelId,
          fromTenantId: tenantId,
          toTenantId: dto.toTenantId,
          notes: dto.notes,
        },
      }),
    ]);

    return updatedBarrel;
  }

  /**
   * Atualiza o status de múltiplos barris em massa.
   */
  async batchUpdateStatus(
    tenantId: string,
    dto: { barrelIds: string[]; status: string; reason?: string },
    _userId: string,
  ) {
    const result = await this.prisma.barrel.updateMany({
      where: {
        id: { in: dto.barrelIds },
        tenantId,
        deletedAt: null,
      },
      data: { status: dto.status as any },
    });
    return { updated: result.count };
  }

  /**
   * Retorna o histórico de propriedade de um barril.
   */
  async getOwnershipHistory(tenantId: string, barrelId: string) {
    // Verificar que o barril existe e pertence ao tenant
    await this.findById(tenantId, barrelId);

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
}
