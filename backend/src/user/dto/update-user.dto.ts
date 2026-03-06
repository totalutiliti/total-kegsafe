import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  @NoHtml()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @NoHtml()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
