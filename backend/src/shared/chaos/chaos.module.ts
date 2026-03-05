import { Module } from '@nestjs/common';
import { ChaosService } from './chaos.service.js';

/**
 * ChaosModule provides fault injection capabilities for resilience testing.
 *
 * Import this module in AppModule — it remains dormant unless both:
 * - CHAOS_ENABLED=true is set in environment variables
 * - NODE_ENV is NOT 'production'
 *
 * To use the ChaosMiddleware, apply it in a module's configure() method:
 *
 * ```typescript
 * configure(consumer: MiddlewareConsumer) {
 *   consumer.apply(ChaosMiddleware).forRoutes('*');
 * }
 * ```
 */
@Module({
  providers: [ChaosService],
  exports: [ChaosService],
})
export class ChaosModule {}
