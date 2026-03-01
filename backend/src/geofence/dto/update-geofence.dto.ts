import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, MinLength, MaxLength, Min, Max } from 'class-validator';
import { GeofenceType } from '@prisma/client';

export class UpdateGeofenceDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(150)
    name?: string;

    @IsOptional()
    @IsEnum(GeofenceType)
    type?: GeofenceType;

    @IsOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude?: number;

    @IsOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude?: number;

    @IsOptional()
    @IsNumber()
    @Min(50)
    @Max(50000)
    radiusMeters?: number;

    @IsOptional()
    @IsUUID()
    clientId?: string;
}
