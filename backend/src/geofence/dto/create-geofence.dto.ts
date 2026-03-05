import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { GeofenceType } from '@prisma/client';

export class CreateGeofenceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsEnum(GeofenceType)
  type!: GeofenceType;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @Min(50)
  @Max(50000)
  radiusMeters!: number;

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
