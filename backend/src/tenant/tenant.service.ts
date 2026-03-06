import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ResourceNotFoundException } from '../shared/exceptions/resource.exceptions.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', id);
    }
    return tenant;
  }

  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (!tenant) {
      throw new ResourceNotFoundException('Tenant', slug);
    }
    return tenant;
  }

  async update(
    id: string,
    data: { name?: string; settings?: any; logoUrl?: string },
  ) {
    await this.findById(id);
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }
}
