import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { DamageType } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateTriageDto {
  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsBoolean()
  intact!: boolean;

  @IsOptional()
  @IsEnum(DamageType)
  damageType?: DamageType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtml()
  damageNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}
