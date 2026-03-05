import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Supplier ----
  async findAllSuppliers(tenantId: string) {
    return this.prisma.supplier.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findSupplierById(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!supplier) throw new ResourceNotFoundException('Supplier', id);
    return supplier;
  }

  async createSupplier(
    tenantId: string,
    data: {
      name: string;
      supplyType: string;
      cnpj?: string;
      contactPhone?: string;
      contactEmail?: string;
      paymentTerms?: string;
      leadTimeDays?: number;
    },
  ) {
    return this.prisma.supplier.create({ data: { tenantId, ...data } });
  }

  async updateSupplier(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      supplyType?: string;
      cnpj?: string;
      contactPhone?: string;
      contactEmail?: string;
      paymentTerms?: string;
      leadTimeDays?: number;
      isActive?: boolean;
    },
  ) {
    await this.findSupplierById(tenantId, id);
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async deleteSupplier(tenantId: string, id: string) {
    await this.findSupplierById(tenantId, id);
    return this.prisma.supplier.delete({ where: { id } });
  }

  // ---- ServiceProvider ----
  async findAllProviders(tenantId: string) {
    return this.prisma.serviceProvider.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findProviderById(tenantId: string, id: string) {
    const provider = await this.prisma.serviceProvider.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!provider) throw new ResourceNotFoundException('ServiceProvider', id);
    return provider;
  }

  async createProvider(
    tenantId: string,
    data: {
      name: string;
      specialty: string;
      certifications?: string;
      hourlyRate?: number;
      serviceRate?: number;
      contactEmail?: string;
      contactPhone?: string;
    },
  ) {
    return this.prisma.serviceProvider.create({ data: { tenantId, ...data } });
  }

  async updateProvider(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      specialty?: string;
      certifications?: string;
      hourlyRate?: number;
      serviceRate?: number;
      contactEmail?: string;
      contactPhone?: string;
      isActive?: boolean;
    },
  ) {
    await this.findProviderById(tenantId, id);
    return this.prisma.serviceProvider.update({ where: { id }, data });
  }

  async deleteProvider(tenantId: string, id: string) {
    await this.findProviderById(tenantId, id);
    return this.prisma.serviceProvider.delete({ where: { id } });
  }
}
