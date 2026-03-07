import { IsOptional, IsEnum, IsString } from 'class-validator';
import { DisposalStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto.js';

export class DisposalQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(DisposalStatus)
  status?: DisposalStatus;

  @IsOptional()
  @IsString()
  barrelId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
