import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ValveModel, BarrelMaterial } from '@prisma/client';

export class UpdateBarrelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsEnum(ValveModel)
  valveModel?: ValveModel;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  capacityLiters?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  tareWeightKg?: number;

  @IsOptional()
  @IsEnum(BarrelMaterial)
  material?: BarrelMaterial;

  @IsOptional()
  @IsNumber()
  @Min(0)
  acquisitionCost?: number;
}
