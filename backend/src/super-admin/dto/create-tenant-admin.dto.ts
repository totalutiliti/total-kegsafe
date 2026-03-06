import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class CreateTenantAdminDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @NoHtml()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
