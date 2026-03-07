import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

/**
 * DTO para transferência de barril entre tenants.
 */
export class TransferBarrelDto {
  @IsUUID()
  toTenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @NoHtml()
  notes?: string;
}
