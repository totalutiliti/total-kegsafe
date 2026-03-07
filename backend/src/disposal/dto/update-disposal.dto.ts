import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class UpdateDisposalDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @NoHtml()
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @NoHtml()
  notes?: string;
}
