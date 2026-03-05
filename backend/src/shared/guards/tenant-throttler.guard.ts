import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const tenantId = req.user?.tenantId || 'anonymous';
    const ip = req.ip || 'unknown';
    return `${tenantId}:${ip}`;
  }

  protected getRequestResponse(context: ExecutionContext) {
    const ctx = context.switchToHttp();
    return { req: ctx.getRequest(), res: ctx.getResponse() };
  }
}
