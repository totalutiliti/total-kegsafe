import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaintenanceType, ComponentAction } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class ChecklistItemDto {
  @IsUUID()
  @IsNotEmpty()
  componentConfigId!: string;

  @IsEnum(ComponentAction)
  action!: ComponentAction;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtml()
  notes?: string;
}

export class CreateChecklistDto {
  @IsOptional()
  @IsUUID()
  maintenanceOrderId?: string;

  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsEnum(MaintenanceType)
  maintenanceType!: MaintenanceType;

  @IsOptional()
  @IsBoolean()
  pressureTestOk?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pressureTestValue?: number;

  @IsOptional()
  @IsBoolean()
  washCompleted?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @NoHtml()
  generalNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCost?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  items!: ChecklistItemDto[];
}
