import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  KegSafeException,
  ErrorResponse,
} from '../exceptions/base.exception.js';
import { ClsService } from 'nestjs-cls';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      this.cls.get('requestId') ||
      (request.headers['x-request-id'] as string) ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let errorResponse: ErrorResponse;

    if (exception instanceof KegSafeException) {
      errorResponse = {
        ...exception.toResponse(),
        traceId: requestId,
        path: request.url,
      };
      this.logError(exception, request, requestId, 'warn');
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        statusCode: status,
        error: this.getHttpErrorName(status),
        code: this.mapHttpStatusToCode(status),
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || 'An error occurred',
        details:
          typeof exceptionResponse === 'object'
            ? (exceptionResponse as any).details
            : undefined,
        traceId: requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      if (Array.isArray((exceptionResponse as any).message)) {
        errorResponse.details = {
          validationErrors: (exceptionResponse as any).message,
        };
      }

      this.logError(exception, request, requestId, 'warn');
    } else {
      errorResponse = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        code: 'SYSTEM_INTERNAL_ERROR',
        message:
          'An unexpected error occurred. Please contact support with the trace ID.',
        traceId: requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
      this.logError(exception, request, requestId, 'error');
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private logError(
    exception: unknown,
    request: Request,
    requestId: string,
    level: 'warn' | 'error',
  ) {
    const logData = {
      requestId,
      method: request.method,
      path: request.url,
      userId: (request as any).user?.id,
      tenantId: (request as any).user?.tenantId,
      body: this.sanitizeBody(request.body),
      error:
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: level === 'error' ? exception.stack : undefined,
            }
          : exception,
    };

    if (level === 'error') {
      this.logger.error('Unhandled exception', JSON.stringify(logData));
    } else {
      this.logger.warn('Request error', JSON.stringify(logData));
    }
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sensitiveFields = [
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'apiKey',
      'secret',
      'cpf',
      'cnpj',
    ];
    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (field in sanitized) sanitized[field] = '[REDACTED]';
    }
    return sanitized;
  }

  private getHttpErrorName(status: number): string {
    const names: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      410: 'Gone',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return names[status] || 'Error';
  }

  private mapHttpStatusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'VALIDATION_FAILED',
      401: 'AUTH_TOKEN_INVALID',
      403: 'AUTH_INSUFFICIENT_ROLE',
      404: 'RESOURCE_NOT_FOUND',
      409: 'RESOURCE_CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'SYSTEM_INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }
}
