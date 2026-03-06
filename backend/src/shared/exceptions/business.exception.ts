import { KegSafeException } from './base.exception.js';

/**
 * Exceção genérica de negócio
 */
export class BusinessException extends KegSafeException {
  readonly statusCode: number;
  readonly code: string;

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, unknown>,
  ) {
    super(message, details);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Exceção de validação de negócio
 */
export class ValidationException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_FAILED';

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}
