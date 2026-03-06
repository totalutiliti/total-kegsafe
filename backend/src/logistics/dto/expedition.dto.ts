import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class ExpeditionDto {
  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gpsAccuracy?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtml()
  notes?: string;

  @IsOptional()
  @IsUUID()
  batchId?: string;
}
