import { Logger } from '@nestjs/common';
import { DegradationService, FeatureState } from './degradation.service.js';

const logger = new Logger('Degradable');

/**
 * Global reference to the DegradationService singleton.
 * Set once during module bootstrap via DegradationModule.
 */
let degradationServiceRef: DegradationService | null = null;

/**
 * Called by DegradationModule to wire the singleton.
 */
export function setDegradationServiceRef(service: DegradationService): void {
  degradationServiceRef = service;
}

/**
 * Method decorator that integrates with the DegradationService.
 *
 * - If the feature is DISABLED, the method returns the fallback value (default: null).
 * - If the feature is DEGRADED, the method executes but logs a warning if latency exceeds the threshold.
 * - If ACTIVE (or no service), the method executes normally.
 *
 * @param featureName - The registered feature name in DegradationService
 * @param fallback - Value returned when the feature is DISABLED (default: null)
 */
export function Degradable(featureName: string, fallback: unknown = null) {
  return function (
    _target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (...args: unknown[]): Promise<unknown> {
      const service = degradationServiceRef;

      // If no service is wired yet, execute normally
      if (!service) {
        return originalMethod.apply(this, args);
      }

      const state = service.getFeatureState(featureName);

      // DISABLED — return fallback immediately
      if (state === FeatureState.DISABLED) {
        logger.warn(
          `Feature "${featureName}" is DISABLED — returning fallback for ${propertyKey}`,
        );
        return fallback;
      }

      // DEGRADED — execute but track latency
      if (state === FeatureState.DEGRADED) {
        const start = Date.now();
        const result: unknown = await originalMethod.apply(this, args);
        const elapsed = Date.now() - start;
        const threshold = service.getLatencyThreshold(featureName);

        if (elapsed > threshold) {
          logger.warn(
            `Feature "${featureName}" (DEGRADED) — ${propertyKey} took ${elapsed}ms (threshold: ${threshold}ms)`,
          );
        }
        return result;
      }

      // ACTIVE or not registered — execute normally
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
