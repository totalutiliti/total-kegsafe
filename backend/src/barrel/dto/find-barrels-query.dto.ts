import { IsOptional, IsString, IsEnum } from 'class-validator';
import { BarrelStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto.js';

export class FindBarrelsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(BarrelStatus)
  status?: BarrelStatus;
}
