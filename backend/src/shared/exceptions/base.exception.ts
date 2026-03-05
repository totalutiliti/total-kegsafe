/**
 * Exceção base para todos os erros de domínio do KegSafe
 */
export abstract class KegSafeException extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toResponse(): ErrorResponse {
    return {
      statusCode: this.statusCode,
      error: this.getHttpErrorName(),
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: new Date().toISOString(),
    };
  }

  private getHttpErrorName(): string {
    const httpErrors: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      410: 'Gone',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return httpErrors[this.statusCode] || 'Error';
  }
}

export interface ErrorResponse {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
  path?: string;
}
