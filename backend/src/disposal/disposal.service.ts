import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DisposalStatus,
  DisposalDestination,
  BarrelStatus,
  AlertType,
  AlertPriority,
} from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';
import { BusinessException } from '../shared/exceptions/business.exception.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class DisposalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query?: {
      page?: number;
      limit?: number;
      status?: DisposalStatus;
      barrelId?: string;
      search?: string;
    },
  ) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { tenantId };

    if (query?.status) where.status = query.status;
    if (query?.barrelId) where.barrelId = query.barrelId;
    if (query?.search) {
      where.OR = [
        { reason: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
        {
          barrel: {
            OR: [
              {
                internalCode: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                chassisNumber: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.disposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          barrel: true,
          requestedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.disposal.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(tenantId: string, id: string) {
    const disposal = await this.prisma.disposal.findFirst({
      where: { id, tenantId },
      include: {
        barrel: true,
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!disposal) throw new ResourceNotFoundException('Disposal', id);
    return disposal;
  }

  /**
   * Sugestões automáticas: barris com TCO alto
   */
  async getSuggestions(tenantId: string) {
    const barrels = await this.prisma.barrel.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { notIn: [BarrelStatus.DISPOSED] },
      },
      orderBy: { totalMaintenanceCost: 'desc' },
      take: 10,
    });

    return barrels.filter((b) => {
      const maintenanceCost = Number(b.totalMaintenanceCost);
      const acquisitionCost = Number(b.acquisitionCost || 0);
      return acquisitionCost > 0 && maintenanceCost > acquisitionCost * 0.6;
    });
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      barrelId: string;
      reason: string;
    },
  ) {
    const barrel = await this.prisma.barrel.findFirst({
      where: { id: data.barrelId, tenantId, deletedAt: null },
    });
    if (!barrel) throw new ResourceNotFoundException('Barrel', data.barrelId);

    const disposal = await this.prisma.disposal.create({
      data: {
        tenantId,
        barrelId: data.barrelId,
        requestedById: userId,
        reason: data.reason,
        tcoAccumulated: barrel.totalMaintenanceCost,
        replacementCost: barrel.acquisitionCost || 0,
        status: DisposalStatus.PENDING_APPROVAL,
      },
      include: { barrel: true },
    });

    // Phase 8: Check for premature disposal (< 70% expected life)
    await this.checkPrematureDisposal(tenantId, barrel);

    return disposal;
  }

  /**
   * Check if barrel is being disposed prematurely (< 70% of expected life).
   * Creates PREMATURE_DISPOSAL alert if so.
   */
  private async checkPrematureDisposal(
    tenantId: string,
    barrel: {
      id: string;
      internalCode: string;
      chassisNumber: string | null;
      manufactureDate: Date | null;
      totalCycles: number;
    },
  ) {
    if (!barrel.manufactureDate) return;

    // Get tenant settings for expectedBarrelLifeYears
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const expectedLifeYears =
      (settings.expectedBarrelLifeYears as number) || 20;

    const ageMs = Date.now() - barrel.manufactureDate.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    const lifePercentage = ageYears / expectedLifeYears;

    if (lifePercentage < 0.7) {
      await this.prisma.alert.create({
        data: {
          tenantId,
          barrelId: barrel.id,
          alertType: AlertType.PREMATURE_DISPOSAL,
          priority: AlertPriority.HIGH,
          title: `Descarte prematuro: barril ${barrel.internalCode}`,
          description: `Barril com apenas ${Math.round(lifePercentage * 100)}% da vida útil esperada (${ageYears.toFixed(1)} de ${expectedLifeYears} anos)`,
          metadata: {
            barrelId: barrel.id,
            internalCode: barrel.internalCode,
            chassisNumber: barrel.chassisNumber,
            ageYears: Number(ageYears.toFixed(1)),
            expectedLifeYears,
            lifePercentage: Number((lifePercentage * 100).toFixed(1)),
            totalCycles: barrel.totalCycles,
          },
        },
      });
    }
  }

  /**
   * Editar descarte (apenas se PENDING_APPROVAL ou APPROVED, antes de completar)
   */
  async update(
    tenantId: string,
    id: string,
    data: { reason?: string; notes?: string },
  ) {
    const disposal = await this.findById(tenantId, id);
    if (disposal.status === DisposalStatus.COMPLETED) {
      throw new BusinessException(
        'DISPOSAL_ALREADY_COMPLETED',
        'Cannot edit a completed disposal',
      );
    }

    return this.prisma.disposal.update({
      where: { id },
      data,
      include: { barrel: true },
    });
  }

  async approve(tenantId: string, id: string, userId: string) {
    const disposal = await this.findById(tenantId, id);
    if (disposal.status !== DisposalStatus.PENDING_APPROVAL) {
      throw new BusinessException(
        'DISPOSAL_INVALID_STATUS',
        'Disposal is not pending approval',
      );
    }

    return this.prisma.disposal.update({
      where: { id },
      data: {
        status: DisposalStatus.APPROVED,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async complete(
    tenantId: string,
    id: string,
    data: { destination: string; scrapValue?: number; notes?: string },
  ) {
    const disposal = await this.findById(tenantId, id);
    if (disposal.status !== DisposalStatus.APPROVED) {
      throw new BusinessException(
        'DISPOSAL_NOT_APPROVED',
        'Disposal must be approved first',
      );
    }

    // Marcar barril como DISPOSED
    await this.prisma.barrel.update({
      where: { id: disposal.barrelId },
      data: { status: BarrelStatus.DISPOSED },
    });

    return this.prisma.disposal.update({
      where: { id },
      data: {
        status: DisposalStatus.COMPLETED,
        destination: data.destination as DisposalDestination,
        scrapValue: data.scrapValue,
        notes: data.notes,
        completedAt: new Date(),
      },
    });
  }

  /**
   * Reverter descarte: restaura barril para ACTIVE.
   * Só pode reverter disposals COMPLETED.
   */
  async revert(tenantId: string, id: string) {
    const disposal = await this.findById(tenantId, id);
    if (disposal.status !== DisposalStatus.COMPLETED) {
      throw new BusinessException(
        'DISPOSAL_NOT_COMPLETED',
        'Only completed disposals can be reverted',
      );
    }

    // Restaurar barril para ACTIVE
    await this.prisma.barrel.update({
      where: { id: disposal.barrelId },
      data: { status: BarrelStatus.ACTIVE },
    });

    // Remover o registro de descarte
    await this.prisma.disposal.delete({
      where: { id },
    });

    return { reverted: true, barrelId: disposal.barrelId };
  }

  /**
   * Upload de foto do barril para descarte.
   * Salva localmente em uploads/disposals/{tenantId}/
   */
  async uploadPhoto(
    tenantId: string,
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    await this.findById(tenantId, id);

    const uploadsDir = path.join(
      process.cwd(),
      'uploads',
      'disposals',
      tenantId,
    );
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${id}-${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, filename);
    await fs.writeFile(filePath, file.buffer);

    const photoUrl = `/uploads/disposals/${tenantId}/${filename}`;

    await this.prisma.disposal.update({
      where: { id },
      data: { photoUrl },
    });

    return { photoUrl };
  }

  /**
   * Analytics: disposal statistics with scatter data and premature detection.
   */
  async getAnalytics(tenantId: string) {
    const disposals = await this.prisma.disposal.findMany({
      where: { tenantId, status: DisposalStatus.COMPLETED },
      include: {
        barrel: {
          select: {
            id: true,
            internalCode: true,
            chassisNumber: true,
            manufactureDate: true,
            totalCycles: true,
            totalMaintenanceCost: true,
            acquisitionCost: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    // Get tenant settings for expectedBarrelLifeYears
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const expectedLifeYears =
      (settings.expectedBarrelLifeYears as number) || 20;

    const scatterData = disposals.map((d) => {
      const ageYears = d.barrel.manufactureDate
        ? (d.completedAt!.getTime() - d.barrel.manufactureDate.getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
        : null;
      const lifePercentage =
        ageYears !== null ? (ageYears / expectedLifeYears) * 100 : null;
      const isPremature = lifePercentage !== null && lifePercentage < 70;

      return {
        id: d.id,
        barrelCode: d.barrel.internalCode,
        chassisNumber: d.barrel.chassisNumber,
        reason: d.reason,
        destination: d.destination,
        tcoAccumulated: Number(d.tcoAccumulated),
        replacementCost: Number(d.replacementCost),
        totalCycles: d.barrel.totalCycles,
        ageYears: ageYears !== null ? Number(ageYears.toFixed(1)) : null,
        lifePercentage:
          lifePercentage !== null ? Number(lifePercentage.toFixed(1)) : null,
        isPremature,
        completedAt: d.completedAt,
      };
    });

    const totalDisposals = scatterData.length;
    const prematureCount = scatterData.filter((d) => d.isPremature).length;
    const avgAge =
      scatterData
        .filter((d) => d.ageYears !== null)
        .reduce((sum, d) => sum + d.ageYears!, 0) / (totalDisposals || 1);
    const avgTco =
      scatterData.reduce((sum, d) => sum + d.tcoAccumulated, 0) /
      (totalDisposals || 1);

    // By destination breakdown
    const byDestination: Record<string, number> = {};
    for (const d of scatterData) {
      const dest = d.destination || 'UNKNOWN';
      byDestination[dest] = (byDestination[dest] || 0) + 1;
    }

    // By month (last 12 months)
    const byMonth: Record<string, number> = {};
    for (const d of scatterData) {
      if (d.completedAt) {
        const key = d.completedAt.toISOString().slice(0, 7);
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
    }

    return {
      summary: {
        totalDisposals,
        prematureCount,
        prematurePercentage:
          totalDisposals > 0
            ? Number(((prematureCount / totalDisposals) * 100).toFixed(1))
            : 0,
        avgAgeYears: Number(avgAge.toFixed(1)),
        avgTco: Number(avgTco.toFixed(2)),
        expectedLifeYears,
      },
      byDestination,
      byMonth,
      scatterData,
    };
  }
}
