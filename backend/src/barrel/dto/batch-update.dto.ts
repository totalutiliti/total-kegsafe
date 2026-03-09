import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BarrelStatus } from '@prisma/client';

export class BatchUpdateStatusDto {
  @IsArray()
  @IsUUID('4', { each: true })
  barrelIds: string[];

  @IsEnum(BarrelStatus)
  status: BarrelStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
