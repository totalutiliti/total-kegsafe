import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { DisposalDestination } from '@prisma/client';

export class CompleteDisposalDto {
  @IsEnum(DisposalDestination)
  destination!: DisposalDestination;

  @IsOptional()
  @IsNumber()
  @Min(0)
  scrapValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
