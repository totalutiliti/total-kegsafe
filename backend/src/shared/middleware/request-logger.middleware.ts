import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl } = req;

    // Generate or reuse requestId
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    this.cls.set('requestId', requestId);
    this.cls.set('traceId', requestId);
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;
      const user = (req as any).user;

      const logData = {
        requestId,
        method,
        path: originalUrl,
        statusCode,
        duration,
        tenantId: user?.tenantId || '-',
        userId: user?.id || '-',
      };

      if (statusCode >= 500) {
        this.logger.error(JSON.stringify(logData));
      } else if (statusCode >= 400) {
        this.logger.warn(JSON.stringify(logData));
      } else {
        this.logger.log(JSON.stringify(logData));
      }
    });

    next();
  }
}
