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
  damageNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
}
