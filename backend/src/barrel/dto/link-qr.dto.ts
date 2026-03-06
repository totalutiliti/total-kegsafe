import {
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para vincular um QR code a um barril individual.
 */
export class LinkQrDto {
  @IsString()
  @MaxLength(50)
  qrCode!: string;
}

/**
 * Item individual de vinculação em massa.
 */
export class BatchLinkQrItemDto {
  @IsString()
  internalCode!: string;

  @IsString()
  @MaxLength(50)
  qrCode!: string;
}

/**
 * DTO para vinculação de QR codes em massa via JSON.
 */
export class BatchLinkQrDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchLinkQrItemDto)
  @ArrayMinSize(1)
  items!: BatchLinkQrItemDto[];
}
