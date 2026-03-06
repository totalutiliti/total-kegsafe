import { IsString } from 'class-validator';

/**
 * DTO para executar a importação de barris previamente validada.
 */
export class ExecuteImportDto {
  @IsString()
  uploadId!: string;
}
