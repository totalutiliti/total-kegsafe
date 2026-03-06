import {
  IsUUID,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateDisposalDto {
  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @NoHtml()
  reason!: string;
}
