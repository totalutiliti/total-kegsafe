import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InsufficientRoleException } from '../../shared/exceptions/auth.exceptions.js';
import type { AuthenticatedRequest } from '../../shared/types/authenticated-request.js';

/**
 * Guard que restringe acesso exclusivamente a SUPER_ADMIN.
 * Usado como segunda camada nos endpoints do painel Super Admin,
 * complementando o RolesGuard global.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || user.role !== 'SUPER_ADMIN') {
      throw new InsufficientRoleException(
        ['SUPER_ADMIN'],
        user?.role || 'none',
      );
    }

    return true;
  }
}
