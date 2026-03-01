import { Module } from '@nestjs/common';
import { SupplierService } from './supplier.service.js';
import { SupplierController } from './supplier.controller.js';

@Module({
    providers: [SupplierService],
    controllers: [SupplierController],
    exports: [SupplierService],
})
export class SupplierModule { }
