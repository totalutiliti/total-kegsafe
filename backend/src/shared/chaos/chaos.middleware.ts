import {
  Injectable,
  NestMiddleware,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ChaosService } from './chaos.service.js';

export interface ChaosMiddlewareOptions {
  /** Route path patterns to target (matched via string includes). Empty = all routes. */
  targetPaths: string[];
  /** Minimum latency in milliseconds to inject. */
  latencyMinMs: number;
  /** Maximum latency in milliseconds to inject. */
  latencyMaxMs: number;
  /** Probability (0-1) of injecting a failure response. */
  failureProbability: number;
}

const DEFAULT_OPTIONS: ChaosMiddlewareOptions = {
  targetPaths: [],
  latencyMinMs: 100,
  latencyMaxMs: 500,
  failureProbability: 0.05,
};

/**
 * NestJS middleware for chaos engineering fault injection.
 *
 * Only active when ChaosService.isEnabled() returns true
 * (CHAOS_ENABLED=true AND NODE_ENV !== 'production').
 *
 * Configurable via the static `options` property.
 */
@Injectable()
export class ChaosMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ChaosMiddleware.name);

  /** Middleware configuration — modify before registering in a module. */
  static options: ChaosMiddlewareOptions = { ...DEFAULT_OPTIONS };

  constructor(private readonly chaosService: ChaosService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!this.chaosService.isEnabled()) {
      next();
      return;
    }

    const { targetPaths, latencyMinMs, latencyMaxMs, failureProbability } =
      ChaosMiddleware.options;

    // Check if this request path is targeted
    const path = req.originalUrl || req.url;
    if (
      targetPaths.length > 0 &&
      !targetPaths.some((target) => path.includes(target))
    ) {
      next();
      return;
    }

    // Inject latency
    if (latencyMinMs > 0 && latencyMaxMs > 0) {
      await this.chaosService.injectLatency(latencyMinMs, latencyMaxMs);
    }

    // Inject failure
    if (this.chaosService.shouldFail(failureProbability)) {
      this.logger.warn(`[CHAOS] Returning 500 for ${req.method} ${path}`);
      throw new HttpException(
        'Chaos engineering: simulated failure',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    next();
  }
}
