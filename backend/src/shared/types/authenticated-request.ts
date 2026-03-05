import type { Request } from 'express';
import type { Role } from '@prisma/client';

/**
 * Shape returned by JwtStrategy.validate() — attached to request.user by Passport.
 */
export interface JwtUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Express Request after JWT authentication — `request.user` is guaranteed to exist.
 */
export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

/**
 * NestJS HttpException response shape (from exception.getResponse()).
 */
export interface HttpExceptionResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  details?: Record<string, unknown>;
}
