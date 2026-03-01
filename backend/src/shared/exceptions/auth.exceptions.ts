import { KegSafeException } from './base.exception.js';

export class InvalidCredentialsException extends KegSafeException {
    readonly statusCode = 401;
    readonly code = 'AUTH_INVALID_CREDENTIALS';

    constructor() {
        super('Invalid email or password');
    }
}

export class TokenExpiredException extends KegSafeException {
    readonly statusCode = 401;
    readonly code = 'AUTH_TOKEN_EXPIRED';

    constructor() {
        super('Access token has expired');
    }
}

export class TokenInvalidException extends KegSafeException {
    readonly statusCode = 401;
    readonly code = 'AUTH_TOKEN_INVALID';

    constructor(reason?: string) {
        super(reason || 'Invalid or malformed token');
    }
}

export class InsufficientRoleException extends KegSafeException {
    readonly statusCode = 403;
    readonly code = 'AUTH_INSUFFICIENT_ROLE';

    constructor(required: string[], current: string) {
        super(`Insufficient permissions. Required: ${required.join(' or ')}, Current: ${current}`);
    }
}

export class AccountDisabledException extends KegSafeException {
    readonly statusCode = 403;
    readonly code = 'AUTH_ACCOUNT_DISABLED';

    constructor() {
        super('Account has been disabled');
    }
}

export class AccountLockedException extends KegSafeException {
    readonly statusCode = 403;
    readonly code = 'AUTH_ACCOUNT_LOCKED';

    constructor(unlockAt: Date) {
        super(`Account temporarily locked until ${unlockAt.toISOString()}`, { unlockAt: unlockAt.toISOString() });
    }
}

export class TenantMismatchException extends KegSafeException {
    readonly statusCode = 403;
    readonly code = 'AUTH_TENANT_MISMATCH';

    constructor() {
        super('Resource belongs to different tenant');
    }
}
