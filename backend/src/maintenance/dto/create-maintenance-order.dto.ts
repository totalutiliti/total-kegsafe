import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { MaintenanceType, AlertPriority } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

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
  @NoHtml()
  description?: string;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  scheduledDate?: string;
}
