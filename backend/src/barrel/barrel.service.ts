import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BarrelStatus,
  BarrelMaterial,
  ValveModel,
  Prisma,
} from '@prisma/client';
import { CreateBarrelDto } from './dto/create-barrel.dto.js';
import { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import { QuickRegisterDto } from './dto/quick-register.dto.js';
import { LinkQrDto } from './dto/link-qr.dto.js';
import { ExcelService } from '../shared/services/excel.service.js';
import {
  BarrelNotFoundException,
  BarrelQrCodeExistsException,
  BarrelInvalidStatusTransitionException,
} from '../shared/exceptions/barrel.exceptions.js';
import {
  ImportNotFoundException,
  ImportInProgressException,
} from '../shared/exceptions/import.exceptions.js';

// Transições de status válidas conforme RULES.md
const VALID_TRANSITIONS: Record<string, string[]> = {
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
];

interface ImportSession {
  tenantId: string;
  rows: ValidatedRow[];
  validatedAt: Date;
  status: 'validated' | 'in_progress' | 'completed' | 'failed';
  progress: { processed: number; total: number; failed: number; errors: any[] };
}

export interface ValidatedRow {
  qrCode: string;
  manufacturer?: string;
  valveModel?: ValveModel;
  capacityLiters: number;
  tareWeightKg?: number;
  material?: BarrelMaterial;
  acquisitionCost?: number;
}

@Injectable()
export class BarrelService {
  private readonly logger = new Logger(BarrelService.name);

  /** Sessões de importação em memória (TTL gerenciado por limpeza periódica) */
  private importSessions = new Map<string, ImportSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
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
                  AND ("internalCode" ILIKE ${searchPattern} OR "qrCode" ILIKE ${searchPattern})
                ORDER BY "createdAt" DESC
                LIMIT ${limit} OFFSET ${skip}
            `,
      this.prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(*)::bigint AS "count" FROM barrels
                WHERE "tenantId" = ${tenantId}::uuid
                  AND "deletedAt" IS NULL
                  ${statusFilter}
                  AND ("internalCode" ILIKE ${searchPattern} OR "qrCode" ILIKE ${searchPattern})
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
    // Verificar unicidade do QR Code (apenas quando fornecido)
    if (dto.qrCode) {
      const existing = await this.prisma.barrel.findFirst({
        where: { qrCode: dto.qrCode, tenantId },
      });
      if (existing) {
        throw new BarrelQrCodeExistsException(dto.qrCode);
      }
    }

    // Gerar código interno com retry (protege contra race condition)
    const internalCode = await this.generateInternalCode(tenantId);

    // Criar barril
    const barrel = await this.prisma.barrel.create({
      data: {
        tenantId,
        internalCode,
        qrCode: dto.qrCode ?? null,
        barcode: dto.barcode,
        manufacturer: dto.manufacturer,
        valveModel: dto.valveModel,
        capacityLiters: dto.capacityLiters,
        tareWeightKg: dto.tareWeightKg,
        material: dto.material,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        acquisitionCost: dto.acquisitionCost,
        status: BarrelStatus.ACTIVE,
      },
    });

    // Criar ComponentCycles em batch (1 query em vez de N sequenciais)
    const componentConfigs = await this.prisma.componentConfig.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    if (componentConfigs.length > 0) {
      await this.prisma.componentCycle.createMany({
        data: componentConfigs.map((config) => ({
          barrelId: barrel.id,
          componentConfigId: config.id,
          cyclesSinceLastService: 0,
          lastServiceDate: new Date(),
          healthScore: 'GREEN' as const,
          healthPercentage: 0,
        })),
        skipDuplicates: true,
      });
    }

    return this.findById(tenantId, barrel.id);
  }

  /**
   * Gera o próximo internalCode com transaction serializable + retry.
   * Protege contra race condition em criações simultâneas e contra dados corrompidos.
   */
  async generateInternalCode(tenantId: string): Promise<string> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const lastBarrel = await tx.barrel.findFirst({
              where: { tenantId },
              orderBy: { internalCode: 'desc' },
              select: { internalCode: true },
            });

            const lastNumber = lastBarrel
              ? parseInt(lastBarrel.internalCode.replace('KS-BAR-', ''), 10)
              : 0;

            // Fallback contra NaN (dados corrompidos no banco)
            if (isNaN(lastNumber)) {
              this.logger.warn(
                `Corrupt internalCode detected for tenant ${tenantId}: "${lastBarrel?.internalCode}". Using count fallback.`,
              );
              const count = await tx.barrel.count({ where: { tenantId } });
              return `KS-BAR-${String(count + 1).padStart(9, '0')}`;
            }

            return `KS-BAR-${String(lastNumber + 1).padStart(9, '0')}`;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        return result;
      } catch (error: any) {
        const isRetryable = error.code === 'P2034' || error.code === 'P2002';

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

    // Unreachable, mas TypeScript exige
    throw new Error('Failed to generate internalCode after max retries');
  }

  async update(tenantId: string, id: string, dto: UpdateBarrelDto) {
    await this.findById(tenantId, id);
    return this.prisma.barrel.update({
      where: { id },
      data: {
        manufacturer: dto.manufacturer,
        valveModel: dto.valveModel,
        capacityLiters: dto.capacityLiters,
        tareWeightKg: dto.tareWeightKg,
        material: dto.material,
        acquisitionCost: dto.acquisitionCost,
      },
      include: BARREL_INCLUDE,
    });
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
   * Gera N internalCodes sequenciais em uma única transaction Serializable.
   * Usado pela importação em massa para evitar N transactions individuais.
   */
  async generateInternalCodes(
    tenantId: string,
    count: number,
  ): Promise<string[]> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const lastBarrel = await tx.barrel.findFirst({
              where: { tenantId },
              orderBy: { internalCode: 'desc' },
              select: { internalCode: true },
            });

            let lastNumber = lastBarrel
              ? parseInt(lastBarrel.internalCode.replace('KS-BAR-', ''), 10)
              : 0;

            if (isNaN(lastNumber)) {
              this.logger.warn(
                `Corrupt internalCode detected for tenant ${tenantId}: "${lastBarrel?.internalCode}". Using count fallback.`,
              );
              lastNumber = await tx.barrel.count({ where: { tenantId } });
            }

            return Array.from(
              { length: count },
              (_, i) => `KS-BAR-${String(lastNumber + i + 1).padStart(9, '0')}`,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error: any) {
        const isRetryable = error.code === 'P2034' || error.code === 'P2002';
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
  generateImportTemplate(): Buffer {
    return this.excelService.generateTemplate(
      IMPORT_COLUMNS,
      [
        {
          qrCode: 'QR-EXEMPLO-001',
          fabricante: 'Franke',
          modeloValvula: 'TYPE_S',
          capacidade: 50,
          pesoTara: 13.2,
          material: 'INOX_304',
          custoAquisicao: 800,
        },
        {
          qrCode: 'QR-EXEMPLO-002',
          fabricante: 'Portinox',
          modeloValvula: 'TYPE_D',
          capacidade: 30,
          pesoTara: 10.5,
          material: 'INOX_316',
          custoAquisicao: 950,
        },
      ],
      [
        'Preencha cada linha com os dados de um barril.',
        'O campo qrCode é obrigatório e deve ser único.',
        'modeloValvula aceita: TYPE_S, TYPE_D, TYPE_A, TYPE_G, TYPE_M, OTHER',
        'material aceita: INOX_304, INOX_316, PET_SLIM',
        'capacidade aceita: valores entre 5 e 100 (litros)',
      ],
    );
  }

  /**
   * Valida um arquivo de importação e armazena em sessão temporária.
   */
  async validateImport(tenantId: string, buffer: Buffer, filename: string) {
    const rawRows = this.excelService.parseFile(buffer, filename);
    const errors: { row: number; field: string; message: string }[] = [];
    const validRows: ValidatedRow[] = [];
    const seenQrCodes = new Set<string>();
    let duplicateRows = 0;

    const validValveModels = new Set(Object.values(ValveModel));
    const validMaterials = new Set(Object.values(BarrelMaterial));

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

      // Duplicata interna
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

      validRows.push({
        qrCode,
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
      });
    }

    // Verificar QR codes existentes no banco em batch
    if (validRows.length > 0) {
      const existingBarrels = await this.prisma.barrel.findMany({
        where: {
          tenantId,
          qrCode: { in: validRows.map((r) => r.qrCode) },
          deletedAt: null,
        },
        select: { qrCode: true },
      });

      const existingQrCodes = new Set(existingBarrels.map((b) => b.qrCode));
      const remainingValid: ValidatedRow[] = [];

      for (const row of validRows) {
        if (existingQrCodes.has(row.qrCode)) {
          errors.push({
            row: 0,
            field: 'qrCode',
            message: `QR Code já existe no sistema: ${row.qrCode}`,
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
      validatedAt: new Date(),
      status: 'validated',
      progress: {
        processed: 0,
        total: validRows.length,
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
      errorRows: errors.length,
      duplicateRows,
      errors,
      preview: validRows.slice(0, 100),
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
    session.progress = {
      processed: 0,
      total: session.rows.length,
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
      total: session.rows.length,
    };
  }

  /**
   * Processa chunks de importação sequencialmente.
   */
  private async processImportChunks(tenantId: string, session: ImportSession) {
    const rows = session.rows;
    const chunks: ValidatedRow[][] = [];
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
      chunks.push(rows.slice(i, i + IMPORT_CHUNK_SIZE));
    }

    // Buscar componentConfigs uma vez (usado para todos os chunks)
    const componentConfigs = await this.prisma.componentConfig.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
    });

    for (const chunk of chunks) {
      try {
        // Gerar internalCodes em batch (1 serializable tx)
        const codes = await this.generateInternalCodes(tenantId, chunk.length);

        // Preparar dados de barris
        const barrelData = chunk.map((row, i) => ({
          tenantId,
          internalCode: codes[i],
          qrCode: row.qrCode,
          manufacturer: row.manufacturer ?? null,
          valveModel: row.valveModel ?? null,
          capacityLiters: row.capacityLiters,
          tareWeightKg: row.tareWeightKg ?? null,
          material: row.material ?? 'INOX_304',
          acquisitionCost: row.acquisitionCost ?? null,
          status: BarrelStatus.ACTIVE,
        }));

        await this.prisma.$transaction(
          async (tx) => {
            // Batch insert barris
            await tx.barrel.createMany({ data: barrelData });

            // Buscar IDs dos barris criados
            const createdBarrels = await tx.barrel.findMany({
              where: {
                tenantId,
                qrCode: { in: barrelData.map((b) => b.qrCode) },
              },
              select: { id: true },
            });

            // Batch insert componentCycles
            if (componentConfigs.length > 0 && createdBarrels.length > 0) {
              const cyclesData = createdBarrels.flatMap((barrel) =>
                componentConfigs.map((config) => ({
                  barrelId: barrel.id,
                  componentConfigId: config.id,
                  cyclesSinceLastService: 0,
                  lastServiceDate: new Date(),
                  healthScore: 'GREEN' as const,
                  healthPercentage: 0,
                })),
              );
              await tx.componentCycle.createMany({
                data: cyclesData,
                skipDuplicates: true,
              });
            }
          },
          { timeout: 60000 },
        );

        session.progress.processed += chunk.length;
      } catch (error: any) {
        session.progress.failed += chunk.length;
        session.progress.errors.push({
          chunkStart: session.progress.processed,
          message: error.message,
        });
        this.logger.error(`Import chunk failed: ${error.message}`, error.stack);
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
    const rawRows = this.excelService.parseFile(buffer, filename);
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
}
