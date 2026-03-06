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
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class UpdateBarrelDto {
  @IsNumber()
  @Min(1)
  version: number;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @NoHtml()
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
