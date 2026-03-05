import { Injectable, Logger } from '@nestjs/common';

/** Default SLO targets */
const DEFAULT_SLO = {
  availability: 0.995,
  p95Latency: 500,
} as const;

/** Maximum number of latency samples to keep per endpoint (circular buffer) */
const MAX_LATENCY_SAMPLES = 1000;

interface EndpointMetrics {
  requestCount: number;
  errorCount: number;
  /** Circular buffer of latency samples in ms */
  latencySamples: number[];
  /** Current write position in the circular buffer */
  latencyIndex: number;
}

export interface SloTargets {
  availability: number;
  p95Latency: number;
}

export interface EndpointReport {
  endpoint: string;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p50Latency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
}

export interface ErrorBudgetReport {
  sloTarget: SloTargets;
  totalRequests: number;
  totalErrors: number;
  currentAvailability: number;
  errorBudgetTotal: number;
  errorBudgetUsed: number;
  errorBudgetRemaining: number;
  /** Percentage of error budget remaining (0-100) */
  errorBudgetRemainingPct: number;
}

@Injectable()
export class SloService {
  private readonly logger = new Logger(SloService.name);
  private readonly endpoints = new Map<string, EndpointMetrics>();
  private readonly sloTargets: SloTargets = { ...DEFAULT_SLO };

  /**
   * Record a request for an endpoint.
   */
  recordRequest(endpoint: string, statusCode: number, latencyMs: number): void {
    let metrics = this.endpoints.get(endpoint);
    if (!metrics) {
      metrics = {
        requestCount: 0,
        errorCount: 0,
        latencySamples: [],
        latencyIndex: 0,
      };
      this.endpoints.set(endpoint, metrics);
    }

    metrics.requestCount++;

    if (statusCode >= 400) {
      metrics.errorCount++;
    }

    // Circular buffer for latency samples
    if (metrics.latencySamples.length < MAX_LATENCY_SAMPLES) {
      metrics.latencySamples.push(latencyMs);
    } else {
      metrics.latencySamples[metrics.latencyIndex] = latencyMs;
    }
    metrics.latencyIndex = (metrics.latencyIndex + 1) % MAX_LATENCY_SAMPLES;
  }

  /**
   * Get metrics for a specific endpoint, or all endpoints if none specified.
   */
  getMetrics(endpoint?: string): EndpointReport[] {
    if (endpoint) {
      const metrics = this.endpoints.get(endpoint);
      if (!metrics) return [];
      return [this.buildReport(endpoint, metrics)];
    }

    const reports: EndpointReport[] = [];
    this.endpoints.forEach((metrics, ep) => {
      reports.push(this.buildReport(ep, metrics));
    });
    return reports;
  }

  /**
   * Calculate the remaining error budget as a percentage.
   */
  getErrorBudget(): ErrorBudgetReport {
    let totalRequests = 0;
    let totalErrors = 0;

    this.endpoints.forEach((metrics) => {
      totalRequests += metrics.requestCount;
      totalErrors += metrics.errorCount;
    });

    const currentAvailability =
      totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 1;

    // Error budget = allowed error fraction
    const allowedErrorRate = 1 - this.sloTargets.availability;
    const errorBudgetTotal =
      totalRequests > 0 ? Math.floor(totalRequests * allowedErrorRate) : 0;
    const errorBudgetUsed = totalErrors;
    const errorBudgetRemaining = Math.max(
      0,
      errorBudgetTotal - errorBudgetUsed,
    );
    const errorBudgetRemainingPct =
      errorBudgetTotal > 0
        ? Math.round((errorBudgetRemaining / errorBudgetTotal) * 10000) / 100
        : 100;

    if (errorBudgetRemainingPct < 10 && totalRequests > 0) {
      this.logger.warn(
        `Error budget critically low: ${errorBudgetRemainingPct.toFixed(1)}% remaining`,
      );
    }

    return {
      sloTarget: { ...this.sloTargets },
      totalRequests,
      totalErrors,
      currentAvailability: Math.round(currentAvailability * 100000) / 100000,
      errorBudgetTotal,
      errorBudgetUsed,
      errorBudgetRemaining,
      errorBudgetRemainingPct,
    };
  }

  /**
   * Reset all metrics — useful for testing.
   */
  reset(): void {
    this.endpoints.clear();
    this.logger.log('SLO metrics reset');
  }

  // ──────────────── Private helpers ────────────────

  private buildReport(
    endpoint: string,
    metrics: EndpointMetrics,
  ): EndpointReport {
    const errorRate =
      metrics.requestCount > 0 ? metrics.errorCount / metrics.requestCount : 0;

    return {
      endpoint,
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      errorRate: Math.round(errorRate * 100000) / 100000,
      p50Latency: this.percentile(metrics.latencySamples, 50),
      p95Latency: this.percentile(metrics.latencySamples, 95),
      p99Latency: this.percentile(metrics.latencySamples, 99),
    };
  }

  private percentile(samples: number[], pct: number): number | null {
    if (samples.length === 0) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil((pct / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}
