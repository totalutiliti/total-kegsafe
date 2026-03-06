import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  MaxLength,
  Length,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { IsCnpj } from '../../shared/validators/cnpj.validator.js';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateClientDto {
  @IsString()
  @MaxLength(200)
  @NoHtml()
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @NoHtml()
  tradeName?: string;

  @IsOptional()
  @IsString()
  @Length(14, 14, { message: 'CNPJ deve ter exatamente 14 dígitos' })
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter apenas dígitos' })
  @IsCnpj({ message: 'CNPJ inválido (dígitos verificadores incorretos)' })
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @NoHtml()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtml()
  address?: string;

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
  @IsString()
  @MaxLength(50)
  @NoHtml()
  connectorType?: string;
}
