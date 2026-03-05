import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Response } from 'express';

export const IDEMPOTENT_KEY = 'idempotent';

/**
 * Decorator para marcar operações como idempotentes.
 * Endpoints marcados verificam o header Idempotency-Key.
 */
export const Idempotent = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(IDEMPOTENT_KEY, true, descriptor.value);
    return descriptor;
  };
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const handler = context.getHandler();
    const isIdempotent = Reflect.getMetadata(IDEMPOTENT_KEY, handler);

    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next.handle();
    }

    const tenantId = this.cls.get('tenantId');

    // Check if key already exists
    try {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: `${tenantId}:${idempotencyKey}` },
      });

      if (existing && existing.expiresAt > new Date()) {
        response.status(existing.statusCode);
        return of(existing.response);
      }
    } catch (error: any) {
      this.logger.warn(`Idempotency check failed: ${error.message}`);
    }

    return next.handle().pipe(
      tap((result) => {
        void (async () => {
          try {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await this.prisma.idempotencyKey.upsert({
              where: { key: `${tenantId}:${idempotencyKey}` },
              update: {
                statusCode: response.statusCode || HttpStatus.OK,
                response: result || {},
                expiresAt,
              },
              create: {
                key: `${tenantId}:${idempotencyKey}`,
                tenantId,
                statusCode: response.statusCode || HttpStatus.OK,
                response: result || {},
                expiresAt,
              },
            });
          } catch (error: any) {
            this.logger.warn(`Idempotency save failed: ${error.message}`);
          }
        })();
      }),
    );
  }
}
