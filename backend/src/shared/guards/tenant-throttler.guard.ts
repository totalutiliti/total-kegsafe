import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const authReq = req as unknown as Partial<AuthenticatedRequest>;
    const tenantId = authReq.user?.tenantId || 'anonymous';
    const ip = (req as unknown as Request).ip || 'unknown';
    return `${tenantId}:${ip}`;
  }

  protected getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    return {
      req: ctx.getRequest<Request>(),
      res: ctx.getResponse<Response>(),
    };
  }
}
