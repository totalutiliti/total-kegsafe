import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  MaxLength,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ValveModel, BarrelMaterial, BarrelCondition } from '@prisma/client';

export class CreateBarrelDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  qrCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsEnum(ValveModel)
  valveModel?: ValveModel;

  @IsNumber()
  @Min(5)
  @Max(100)
  capacityLiters!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  tareWeightKg?: number;

  @IsOptional()
  @IsEnum(BarrelMaterial)
  material?: BarrelMaterial;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  acquisitionCost?: number;

  @IsOptional()
  @IsEnum(BarrelCondition)
  condition?: BarrelCondition;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialCycles?: number;
}
