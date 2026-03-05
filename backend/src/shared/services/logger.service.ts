import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as winston from 'winston';

interface LogContext {
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  barrelId?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLogger implements LoggerService {
  private context?: string;
  private logger: winston.Logger;

  constructor(private readonly cls: ClsService) {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'kegsafe-api' },
      transports: [
        new winston.transports.Console({
          format:
            process.env.NODE_ENV === 'production'
              ? winston.format.json()
              : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple(),
                ),
        }),
      ],
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: LogContext | string) {
    this.writeLog(
      'info',
      message,
      typeof context === 'string' ? undefined : context,
    );
  }

  error(message: string, trace?: string, context?: LogContext | string) {
    this.writeLog('error', message, {
      ...(typeof context === 'string' ? {} : context),
      stack: trace,
    });
  }

  warn(message: string, context?: LogContext | string) {
    this.writeLog(
      'warn',
      message,
      typeof context === 'string' ? undefined : context,
    );
  }

  debug(message: string, context?: LogContext | string) {
    if (process.env.NODE_ENV !== 'production') {
      this.writeLog(
        'debug',
        message,
        typeof context === 'string' ? undefined : context,
      );
    }
  }

  verbose(message: string, context?: LogContext | string) {
    this.writeLog(
      'verbose',
      message,
      typeof context === 'string' ? undefined : context,
    );
  }

  private writeLog(level: string, message: string, context?: LogContext) {
    const logEntry = {
      level,
      message,
      context: this.context,
      traceId: this.cls.get('traceId') || context?.traceId,
      requestId: this.cls.get('requestId'),
      tenantId: this.cls.get('tenantId') || context?.tenantId,
      userId: this.cls.get('userId') || context?.userId,
      ...this.sanitize(context),
    };

    this.logger.log(level, message, logEntry);
  }

  /**
   * PII Masking conforme RULES.md Seção 14.4
   */
  private sanitize(context?: LogContext): LogContext {
    if (!context) return {};
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'apiKey',
      'secret',
    ];
    const piiFields = ['email', 'phone', 'cnpj', 'cpf'];

    const sanitized = { ...context };
    for (const field of sensitiveFields) {
      if (field in sanitized) sanitized[field] = '[REDACTED]';
    }
    for (const field of piiFields) {
      if (field in sanitized && typeof sanitized[field] === 'string') {
        sanitized[field] = this.maskPii(field, sanitized[field]);
      }
    }
    return sanitized;
  }

  private maskPii(field: string, value: string): string {
    switch (field) {
      case 'email': {
        const [local, domain] = value.split('@');
        return `${local[0]}***@${domain}`;
      }
      case 'phone':
        return value.replace(/\d(?=\d{4})/g, '*');
      case 'cnpj':
        return `**.***.***/${value.slice(8, 12)}-**`;
      case 'cpf':
        return `***.***.${value.slice(6, 9)}-**`;
      default:
        return '[MASKED]';
    }
  }
}
