import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';

export const AUDIT_KEY = 'audit';
export const SKIP_AUDIT_KEY = 'skipAudit';

export interface AuditOptions {
  action: string;
  entityType: string;
  getEntityId?: (req: Request, result: AuditResult) => string;
}

interface AuditResult {
  id?: string;
  [key: string]: unknown;
}

/** Decorator for explicit audit configuration on a handler */
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

/** Decorator to skip audit logging for specific handlers */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);

// Map controller names to Prisma model names for old-state capture
const ENTITY_MODEL_MAP: Record<string, string> = {
  Barrel: 'barrel',
  Client: 'client',
  User: 'user',
  Component: 'componentConfig',
  Disposal: 'disposal',
  Maintenance: 'maintenanceOrder',
  Alert: 'alert',
  Geofence: 'geofence',
  Supplier: 'supplier',
  ServiceProvider: 'serviceProvider',
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
    const method = request.method;
    const handler = context.getHandler();
    const controller = context.getClass();

    // Only intercept mutation methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Check for @SkipAudit() decorator
    const skipAudit = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_KEY,
      [handler, controller],
    );
    if (skipAudit) {
      return next.handle();
    }

    const tenantId: string | undefined = this.cls.get('tenantId');
    const userId: string | undefined = this.cls.get('userId');

    // Skip if no tenant context (unauthenticated routes, super admin cross-tenant)
    if (!tenantId) {
      return next.handle();
    }

    // Check for explicit @Audit() decorator
    const auditOptions = Reflect.getMetadata(AUDIT_KEY, handler) as
      | AuditOptions
      | undefined;

    // Infer entity type and action if no decorator
    const entityType =
      auditOptions?.entityType || this.inferEntityType(controller);
    const action = auditOptions?.action || this.inferAction(method);

    // Capture old state for UPDATE and DELETE operations
    const entityId = Array.isArray(request.params?.id)
      ? request.params.id[0]
      : request.params?.id;
    const shouldCaptureOldState =
      ['PUT', 'PATCH', 'DELETE'].includes(method) && entityId;

    const oldStatePromise = shouldCaptureOldState
      ? this.captureOldState(entityType, entityId, tenantId)
      : Promise.resolve(null);

    return from(oldStatePromise).pipe(
      switchMap((oldState) =>
        next.handle().pipe(
          tap((result: unknown) => {
            void (async () => {
              try {
                const auditResult = result as AuditResult | undefined;
                const resolvedEntityId = auditOptions?.getEntityId
                  ? auditOptions.getEntityId(request, auditResult ?? {})
                  : auditResult?.id || entityId;

                await this.prisma.auditLog.create({
                  data: {
                    tenantId,
                    userId,
                    action,
                    entityType,
                    entityId: resolvedEntityId?.toString() || 'unknown',
                    oldData: oldState
                      ? (oldState as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                    newData: auditResult
                      ? (auditResult as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
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
        ),
      ),
    );
  }

  private inferEntityType(
    controller: new (...args: unknown[]) => unknown,
  ): string {
    return controller.name.replace('Controller', '');
  }

  private inferAction(method: string): string {
    switch (method) {
      case 'POST':
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      default:
        return method;
    }
  }

  private async captureOldState(
    entityType: string,
    entityId: string,
    tenantId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const modelName = ENTITY_MODEL_MAP[entityType];
      if (!modelName) return null;

      const delegate = (this.prisma as unknown as Record<string, unknown>)[
        modelName
      ] as Record<string, (...args: unknown[]) => unknown> | undefined;
      if (!delegate?.findFirst) return null;

      return (await delegate.findFirst({
        where: { id: entityId, tenantId },
      })) as Record<string, unknown> | null;
    } catch {
      return null;
    }
  }
}
