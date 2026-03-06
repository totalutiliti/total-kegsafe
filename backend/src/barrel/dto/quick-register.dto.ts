import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ValveModel, BarrelMaterial } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

/**
 * DTO para cadastro rápido via scan de QR Code.
 * qrCode é obrigatório (vem do scan).
 * Os demais campos vêm do template fixo definido pelo usuário.
 */
export class QuickRegisterDto {
  @IsString()
  @MaxLength(50)
  @NoHtml()
  qrCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @NoHtml()
  barcode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @NoHtml()
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
}
