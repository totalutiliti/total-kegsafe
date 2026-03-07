import { IsString, Matches } from 'class-validator';
import { NoHtml } from '../../shared/validators/no-html.validator.js';

/**
 * DTO para scan-or-create: recebe o código escaneado do QR Code.
 * O código deve estar no formato KS-BAR-NNNNNNNNN ou KS-NNNNNNNNN.
 */
export class ScanBarrelDto {
  @IsString()
  @Matches(/^KS(-BAR)?-\d{9}$/, {
    message:
      'Código inválido. Formato esperado: KS-BAR-000000001 ou KS-000000001',
  })
  @NoHtml()
  code!: string;
}
