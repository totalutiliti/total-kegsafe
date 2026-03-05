import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenInvalidException } from '../../shared/exceptions/auth.exceptions.js';
import type { JwtUser } from '../../shared/types/authenticated-request.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<T = JwtUser>(
    err: Error | null,
    user: T | false,
    info?: { message?: string },
  ): T {
    if (err || !user) {
      throw err || new TokenInvalidException(info?.message);
    }
    return user;
  }
}
