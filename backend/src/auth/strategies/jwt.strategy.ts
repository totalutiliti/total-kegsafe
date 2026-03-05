import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClsService } from 'nestjs-cls';
import type { JwtPayload } from '../auth.service.js';
import type { Request } from 'express';

/**
 * Extract JWT from httpOnly cookie first, then fall back to Authorization header.
 * This allows both browser (cookie) and API client (Bearer) authentication.
 */
function cookieThenBearerExtractor(req: Request): string | null {
  // 1. Try httpOnly cookie
  const cookies = req?.cookies as Record<string, string> | undefined;
  if (cookies?.accessToken) {
    return cookies.accessToken;
  }
  // 2. Fallback to Bearer header (for API clients like Postman/Swagger)
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is required. Set it in your .env file.');
    }
    super({
      jwtFromRequest: cookieThenBearerExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        isActive: true,
        deletedAt: null,
      },
      include: { tenant: true },
    });

    if (!user || !user.tenant.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    // Setar contexto de tenant no CLS para uso pelo Prisma middleware
    this.cls.set('tenantId', user.tenantId);
    this.cls.set('userId', user.id);
    this.cls.set('userRole', user.role);

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
