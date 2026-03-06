import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ChaosService provides fault injection primitives for resilience testing.
 *
 * Safety guarantees:
 * - NEVER active when NODE_ENV === 'production'
 * - NEVER active unless CHAOS_ENABLED=true is explicitly set
 * - All chaos actions are logged prominently
 */
@Injectable()
export class ChaosService {
  private readonly logger = new Logger(ChaosService.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    const chaosFlag = this.config.get<string>('CHAOS_ENABLED', 'false');

    this.enabled = chaosFlag === 'true' && nodeEnv !== 'production';

    if (this.enabled) {
      this.logger.warn(
        '⚠ CHAOS ENGINEERING IS ENABLED — fault injection is active. ' +
          'This must NEVER happen in production.',
      );
    }
  }

  /**
   * Returns true if chaos engineering is enabled.
   * Requires both CHAOS_ENABLED=true AND NODE_ENV !== 'production'.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Injects artificial latency by returning a promise that resolves
   * after a random delay between minMs and maxMs.
   */
  async injectLatency(minMs: number, maxMs: number): Promise<void> {
    if (!this.enabled) return;

    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    this.logger.warn(`[CHAOS] Injecting ${delay}ms latency`);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Returns true with the given probability (0 to 1).
   * Use to randomly trigger failures in non-production environments.
   */
  shouldFail(probability: number): boolean {
    if (!this.enabled) return false;

    const clampedProbability = Math.max(0, Math.min(1, probability));
    const failed = Math.random() < clampedProbability;

    if (failed) {
      this.logger.warn(
        `[CHAOS] Failure triggered (probability=${clampedProbability})`,
      );
    }

    return failed;
  }
}
