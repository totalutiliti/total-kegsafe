import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { IsCnpj } from '../../shared/validators/cnpj.validator.js';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateTenantDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @NoHtml()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,50}$/, {
    message: 'Slug deve ser alfanumérico minúsculo com hifens, 3-50 caracteres',
  })
  slug!: string;

  @IsString()
  @IsCnpj()
  cnpj!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
