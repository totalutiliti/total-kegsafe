import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Feature Flag Service — permite ligar/desligar funcionalidades sem novo deploy.
 * Flags são controladas via variáveis de ambiente com prefixo FF_.
 *
 * Uso:
 *   if (this.featureFlags.isEnabled('BATCH_IMPORT')) { ... }
 *
 * Variáveis de ambiente:
 *   FF_BATCH_IMPORT=true|false (default: true)
 *   FF_GEOFENCE=true|false (default: true)
 *   FF_DISPOSAL=true|false (default: true)
 *   FF_ALERTS=true|false (default: true)
 */
@Injectable()
export class FeatureFlagService {
  private readonly flags: Map<string, boolean>;

  constructor(private readonly config: ConfigService) {
    this.flags = new Map([
      ['BATCH_IMPORT', this.parseBool('FF_BATCH_IMPORT', true)],
      ['GEOFENCE', this.parseBool('FF_GEOFENCE', true)],
      ['DISPOSAL', this.parseBool('FF_DISPOSAL', true)],
      ['ALERTS', this.parseBool('FF_ALERTS', true)],
    ]);
  }

  isEnabled(flag: string): boolean {
    return this.flags.get(flag) ?? false;
  }

  getAllFlags(): Record<string, boolean> {
    return Object.fromEntries(this.flags);
  }

  private parseBool(envKey: string, defaultValue: boolean): boolean {
    const value = this.config.get<string>(envKey);
    if (value === undefined || value === null) return defaultValue;
    return value === 'true';
  }
}
