import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { IBarrelService } from './barrel.service.interface.js';
import { BARREL_SERVICE } from './barrel.constants.js';
import { ComponentService } from '../component/component.service.js';
import { CreateBarrelDto } from './dto/create-barrel.dto.js';
import { UpdateBarrelDto } from './dto/update-barrel.dto.js';
import { FindBarrelsQueryDto } from './dto/find-barrels-query.dto.js';
import { QuickRegisterDto } from './dto/quick-register.dto.js';
import { ExecuteImportDto } from './dto/import-barrel.dto.js';
import { LinkQrDto } from './dto/link-qr.dto.js';
import { ScanBarrelDto } from './dto/scan-barrel.dto.js';
import { GenerateBatchDto } from './dto/generate-batch.dto.js';
import { TransferBarrelDto } from './dto/transfer-barrel.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TenantId } from '../auth/decorators/tenant-id.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../shared/types/authenticated-request.js';
import { Role } from '@prisma/client';

@Controller('barrels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BarrelController {
  constructor(
    @Inject(BARREL_SERVICE) private readonly barrelService: IBarrelService,
    private readonly componentService: ComponentService,
  ) {}

  // =============================================
  // IMPORTANTE: Rotas estáticas DEVEM vir antes de :id
  // =============================================

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS, Role.MAINTENANCE)
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: FindBarrelsQueryDto,
  ) {
    return this.barrelService.findAll(tenantId, query);
  }

  // --- Feature 3: Barris sem QR ---
  @Get('unlinked')
  @Roles(Role.ADMIN, Role.MANAGER)
  async findUnlinked(
    @TenantId() tenantId: string,
    @Query() query: FindBarrelsQueryDto,
  ) {
    return this.barrelService.findUnlinked(tenantId, query);
  }

  @Get('unlinked/export')
  @Roles(Role.ADMIN, Role.MANAGER)
  async exportUnlinked(@TenantId() tenantId: string, @Res() res: Response) {
    const buffer = await this.barrelService.exportUnlinked(tenantId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=barrels-sem-qr.xlsx',
    );
    res.send(buffer);
  }

  // --- Feature 2: Importação ---
  @Get('import/template')
  @Roles(Role.ADMIN, Role.MANAGER)
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.barrelService.generateImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template-importacao-barris.xlsx',
    );
    res.send(buffer);
  }

  @Get('import/progress/:uploadId')
  @Roles(Role.ADMIN, Role.MANAGER)
  getImportProgress(
    @TenantId() tenantId: string,
    @Param('uploadId') uploadId: string,
  ) {
    return this.barrelService.getImportProgress(tenantId, uploadId);
  }

  // --- Rotas existentes com parâmetros ---
  @Get('qr/:qrCode')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS, Role.MAINTENANCE)
  async findByQrCode(
    @TenantId() tenantId: string,
    @Param('qrCode') qrCode: string,
  ) {
    return this.barrelService.findByQrCode(tenantId, qrCode);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS, Role.MAINTENANCE)
  async findById(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.barrelService.findById(tenantId, id);
  }

  @Get(':id/timeline')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS, Role.MAINTENANCE)
  async getTimeline(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.barrelService.getTimeline(tenantId, id);
  }

  @Get(':id/ownership-history')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getOwnershipHistory(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.barrelService.getOwnershipHistory(tenantId, id);
  }

  @Get(':id/components')
  @Roles(Role.ADMIN, Role.MANAGER, Role.MAINTENANCE)
  async getBarrelComponents(@Param('id') id: string) {
    return this.componentService.getBarrelComponents(id);
  }

  // =============================================
  // POST endpoints
  // =============================================

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  async create(@TenantId() tenantId: string, @Body() dto: CreateBarrelDto) {
    return this.barrelService.create(tenantId, dto);
  }

  // --- Feature 1: Cadastro Rápido ---
  @Post('quick-register')
  @Roles(Role.ADMIN, Role.MANAGER)
  async quickRegister(
    @TenantId() tenantId: string,
    @Body() dto: QuickRegisterDto,
  ) {
    return this.barrelService.quickRegister(tenantId, dto);
  }

  // --- Feature 2: Importação ---
  @Post('import/validate')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async validateImport(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.barrelService.validateImport(
      tenantId,
      file.buffer,
      file.originalname,
    );
  }

  @Post('import/execute')
  @Roles(Role.ADMIN, Role.MANAGER)
  executeImport(@TenantId() tenantId: string, @Body() dto: ExecuteImportDto) {
    return this.barrelService.executeImport(tenantId, dto.uploadId);
  }

  // --- QR Code como Fonte da Verdade ---
  @Post('scan')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LOGISTICS)
  async scanOrCreate(@TenantId() tenantId: string, @Body() dto: ScanBarrelDto) {
    return this.barrelService.scanOrCreate(tenantId, dto);
  }

  @Post('generate-batch')
  @Roles(Role.ADMIN, Role.MANAGER, Role.SUPER_ADMIN)
  async generateBatch(
    @TenantId() tenantId: string,
    @Body() dto: GenerateBatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.barrelService.generateBatch(tenantId, dto, user.id);
  }

  // --- Feature 3: Vinculação QR em massa ---
  @Post('link-qr/batch')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async batchLinkQr(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.barrelService.batchLinkQrFromFile(
      tenantId,
      file.buffer,
      file.originalname,
    );
  }

  // --- QR Code: Transferência entre tenants ---
  @Post(':id/transfer')
  @Roles(Role.ADMIN, Role.MANAGER)
  async transferBarrel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: TransferBarrelDto,
  ) {
    return this.barrelService.transferBarrel(tenantId, id, dto);
  }

  // =============================================
  // PATCH endpoints
  // =============================================

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBarrelDto,
  ) {
    return this.barrelService.update(tenantId, id, dto);
  }

  // --- Feature 3: Vincular QR individual ---
  @Patch(':id/link-qr')
  @Roles(Role.ADMIN, Role.MANAGER)
  async linkQr(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: LinkQrDto,
  ) {
    return this.barrelService.linkQr(tenantId, id, dto);
  }

  // =============================================
  // DELETE endpoints
  // =============================================

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.barrelService.delete(tenantId, id);
  }
}
