import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SloService } from './slo.service.js';
import type { Response } from 'express';

@Injectable()
export class SloInterceptor implements NestInterceptor {
  constructor(private readonly sloService: SloService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const response = context.switchToHttp().getResponse<Response>();

    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const endpoint = `${controller}.${handler}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const latency = Date.now() - start;
          const statusCode: number = response.statusCode;
          this.sloService.recordRequest(endpoint, statusCode, latency);
        },
        error: () => {
          const latency = Date.now() - start;
          // On error, the status code may not be set on the response yet.
          // Use 500 as a safe fallback for unhandled errors.
          const statusCode: number =
            response.statusCode >= 400 ? response.statusCode : 500;
          this.sloService.recordRequest(endpoint, statusCode, latency);
        },
      }),
    );
  }
}
