import { IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO para geração em lote de códigos KS-BAR para gravação a laser.
 * Gera códigos sequenciais com status PRE_REGISTERED.
 */
export class GenerateBatchDto {
  @IsInt()
  @Min(1)
  @Max(50000)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
