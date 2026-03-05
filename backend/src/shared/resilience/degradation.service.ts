import { Injectable, Logger } from '@nestjs/common';

export enum FeatureState {
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  DISABLED = 'DISABLED',
}

export interface FeatureStatus {
  name: string;
  state: FeatureState;
  reason?: string;
  degradedAt?: Date;
}

export interface FeatureOptions {
  /** Latency threshold in ms — if exceeded while DEGRADED, a warning is logged */
  latencyThreshold?: number;
}

interface FeatureEntry {
  state: FeatureState;
  reason?: string;
  degradedAt?: Date;
  options: FeatureOptions;
}

const DEFAULT_LATENCY_THRESHOLD = 1000;

@Injectable()
export class DegradationService {
  private readonly logger = new Logger(DegradationService.name);
  private readonly features = new Map<string, FeatureEntry>();

  /**
   * Register a feature for degradation tracking.
   * Defaults to ACTIVE state.
   */
  register(name: string, options?: FeatureOptions): void {
    if (this.features.has(name)) {
      this.logger.warn(`Feature "${name}" is already registered`);
      return;
    }
    this.features.set(name, {
      state: FeatureState.ACTIVE,
      options: {
        latencyThreshold:
          options?.latencyThreshold ?? DEFAULT_LATENCY_THRESHOLD,
      },
    });
    this.logger.log(`Feature "${name}" registered as ACTIVE`);
  }

  /**
   * Check if a feature is available (ACTIVE or DEGRADED).
   * Returns false if DISABLED or not registered.
   */
  isAvailable(name: string): boolean {
    const entry = this.features.get(name);
    if (!entry) return false;
    return entry.state !== FeatureState.DISABLED;
  }

  /**
   * Mark a feature as DEGRADED with a reason.
   */
  degrade(name: string, reason: string): void {
    const entry = this.features.get(name);
    if (!entry) {
      this.logger.warn(
        `Cannot degrade unregistered feature "${name}" — register it first`,
      );
      return;
    }
    entry.state = FeatureState.DEGRADED;
    entry.reason = reason;
    entry.degradedAt = new Date();
    this.logger.warn(`Feature "${name}" degraded: ${reason}`);
  }

  /**
   * Disable a feature entirely.
   */
  disable(name: string, reason: string): void {
    const entry = this.features.get(name);
    if (!entry) {
      this.logger.warn(
        `Cannot disable unregistered feature "${name}" — register it first`,
      );
      return;
    }
    entry.state = FeatureState.DISABLED;
    entry.reason = reason;
    entry.degradedAt = new Date();
    this.logger.warn(`Feature "${name}" disabled: ${reason}`);
  }

  /**
   * Restore a feature to ACTIVE state.
   */
  restore(name: string): void {
    const entry = this.features.get(name);
    if (!entry) {
      this.logger.warn(
        `Cannot restore unregistered feature "${name}" — register it first`,
      );
      return;
    }
    const previousState = entry.state;
    entry.state = FeatureState.ACTIVE;
    entry.reason = undefined;
    entry.degradedAt = undefined;
    this.logger.log(
      `Feature "${name}" restored from ${previousState} to ACTIVE`,
    );
  }

  /**
   * Get the current state of a specific feature.
   */
  getFeatureState(name: string): FeatureState | undefined {
    return this.features.get(name)?.state;
  }

  /**
   * Get the latency threshold for a feature.
   */
  getLatencyThreshold(name: string): number {
    return (
      this.features.get(name)?.options.latencyThreshold ??
      DEFAULT_LATENCY_THRESHOLD
    );
  }

  /**
   * Get the status of all registered features.
   */
  getStatus(): FeatureStatus[] {
    const result: FeatureStatus[] = [];
    this.features.forEach((entry, name) => {
      result.push({
        name,
        state: entry.state,
        reason: entry.reason,
        degradedAt: entry.degradedAt,
      });
    });
    return result;
  }
}
