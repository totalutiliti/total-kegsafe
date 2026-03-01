import { IsUUID, IsNotEmpty, IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';
import { MaintenanceType, AlertPriority } from '@prisma/client';

export class CreateMaintenanceOrderDto {
    @IsUUID()
    @IsNotEmpty()
    barrelId!: string;

    @IsEnum(MaintenanceType)
    orderType!: MaintenanceType;

    @IsOptional()
    @IsEnum(AlertPriority)
    priority?: AlertPriority;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    @IsUUID()
    assignedToId?: string;

    @IsOptional()
    @IsUUID()
    providerId?: string;
}
