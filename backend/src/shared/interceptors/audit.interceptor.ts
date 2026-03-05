import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Prisma } from '@prisma/client';

export const AUDIT_KEY = 'audit';
export interface AuditOptions {
  action: string;
  entityType: string;
  getEntityId?: (req: Request, result: AuditResult) => string;
}

interface AuditResult {
  id?: string;
  [key: string]: unknown;
}

export const Audit = (options: AuditOptions) => {
  return (
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(AUDIT_KEY, options, descriptor.value as object);
    return descriptor;
  };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();

    const auditOptions = Reflect.getMetadata(AUDIT_KEY, handler) as
      | AuditOptions
      | undefined;

    if (!auditOptions) {
      return next.handle();
    }

    const tenantId: string = this.cls.get('tenantId');
    const userId: string = this.cls.get('userId');
    const oldData = request.body as Prisma.InputJsonValue;

    return next.handle().pipe(
      tap((result: unknown) => {
        void (async () => {
          try {
            const auditResult = result as AuditResult | undefined;
            const entityId = auditOptions.getEntityId
              ? auditOptions.getEntityId(request, auditResult ?? {})
              : auditResult?.id || request.params?.id;

            await this.prisma.auditLog.create({
              data: {
                tenantId,
                userId,
                action: auditOptions.action,
                entityType: auditOptions.entityType,
                entityId: entityId?.toString() || 'unknown',
                oldData: request.method !== 'POST' ? oldData : null,
                newData: auditResult as Prisma.InputJsonValue,
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
              },
            });
          } catch (error: unknown) {
            const err =
              error instanceof Error ? error : new Error(String(error));
            this.logger.error('Audit log failed', {
              message: err.message,
              stack: err.stack,
            });
          }
        })();
      }),
    );
  }
}
