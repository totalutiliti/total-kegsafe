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

export const AUDIT_KEY = 'audit';
export interface AuditOptions {
    action: string;
    entityType: string;
    getEntityId?: (req: any, result: any) => string;
}

export const Audit = (options: AuditOptions) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(AUDIT_KEY, options, descriptor.value);
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
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const handler = context.getHandler();

        const auditOptions = Reflect.getMetadata(AUDIT_KEY, handler) as AuditOptions | undefined;

        if (!auditOptions) {
            return next.handle();
        }

        const tenantId = this.cls.get('tenantId');
        const userId = this.cls.get('userId');
        const oldData = request.body;

        return next.handle().pipe(
            tap(async (result) => {
                try {
                    const entityId = auditOptions.getEntityId
                        ? auditOptions.getEntityId(request, result)
                        : result?.id || request.params?.id;

                    await this.prisma.auditLog.create({
                        data: {
                            tenantId,
                            userId,
                            action: auditOptions.action,
                            entityType: auditOptions.entityType,
                            entityId: entityId?.toString() || 'unknown',
                            oldData: request.method !== 'POST' ? oldData : null,
                            newData: result,
                            ipAddress: request.ip,
                            userAgent: request.headers['user-agent'],
                        },
                    });
                } catch (error: any) {
                    this.logger.error('Audit log failed', {
                        message: error?.message,
                        stack: error?.stack,
                    });
                }
            }),
        );
    }
}
