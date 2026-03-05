import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DisposalStatus, BarrelStatus } from '@prisma/client';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';
import { BusinessException } from '../shared/exceptions/business.exception.js';

@Injectable()
export class DisposalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.disposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { barrel: true },
    });
  }

  async findById(tenantId: string, id: string) {
    const disposal = await this.prisma.disposal.findFirst({
      where: { id, tenantId },
      include: { barrel: true },
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

    return this.prisma.disposal.create({
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
        destination: data.destination as any,
        scrapValue: data.scrapValue,
        notes: data.notes,
        completedAt: new Date(),
      },
    });
  }
}
