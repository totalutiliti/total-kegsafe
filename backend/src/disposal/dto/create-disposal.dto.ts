import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { DisposalReason } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateDisposalDto {
  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsOptional()
  @IsEnum(DisposalReason)
  disposalReason?: DisposalReason;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @NoHtml()
  reason!: string;
}
