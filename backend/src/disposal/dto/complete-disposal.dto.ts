import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { DisposalDestination } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

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
  @NoHtml()
  notes?: string;
}
