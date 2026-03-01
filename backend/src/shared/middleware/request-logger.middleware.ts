import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request, res: Response, next: NextFunction): void {
        const startTime = Date.now();
        const { method, originalUrl } = req;

        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const { statusCode } = res;
            const user = (req as any).user;

            const logLine = `${method} ${originalUrl} ${statusCode} ${duration}ms` +
                ` [tenant:${user?.tenantId || '-'} user:${user?.id || '-'}]`;

            if (statusCode >= 500) {
                this.logger.error(logLine);
            } else if (statusCode >= 400) {
                this.logger.warn(logLine);
            } else {
                this.logger.log(logLine);
            }
        });

        next();
    }
}
