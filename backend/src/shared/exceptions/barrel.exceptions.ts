import { KegSafeException } from './base.exception.js';

export class BarrelNotFoundException extends KegSafeException {
  readonly statusCode = 404;
  readonly code = 'BARREL_NOT_FOUND';

  constructor(identifier?: string) {
    super(
      identifier
        ? `Barrel with ID '${identifier}' not found`
        : 'Barrel not found',
    );
  }
}

export class BarrelQrCodeExistsException extends KegSafeException {
  readonly statusCode = 409;
  readonly code = 'BARREL_QR_CODE_EXISTS';

  constructor(qrCode: string) {
    super(`Barrel with QR code '${qrCode}' already exists`, { qrCode });
  }
}

export class BarrelInvalidStatusTransitionException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_INVALID_STATUS_TRANSITION';

  constructor(
    currentStatus: string,
    targetStatus: string,
    allowedTransitions: string[],
  ) {
    super(
      `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      {
        currentStatus,
        targetStatus,
        allowedTransitions,
      },
    );
  }
}

export class BarrelNotReadyForExpeditionException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_NOT_READY_FOR_EXPEDITION';

  constructor(currentStatus: string) {
    super(`Barrel cannot be expedited. Current status: ${currentStatus}`, {
      currentStatus,
      requiredStatus: 'ACTIVE',
    });
  }
}

export class BarrelNotInTransitException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_NOT_IN_TRANSIT';

  constructor(currentStatus: string) {
    super(`Barrel is not in transit. Current status: ${currentStatus}`, {
      currentStatus,
      requiredStatus: 'IN_TRANSIT',
    });
  }
}

export class BarrelNotAtClientException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_NOT_AT_CLIENT';

  constructor(currentStatus: string) {
    super(`Barrel is not at client. Current status: ${currentStatus}`, {
      currentStatus,
      requiredStatus: 'AT_CLIENT',
    });
  }
}

export class BarrelBlockedCriticalComponentException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_BLOCKED_CRITICAL_COMPONENT';

  constructor(barrelId: string, components: string[]) {
    super('Barrel has critical components requiring maintenance', {
      barrelId,
      criticalComponents: components,
      action:
        'Barrel must go through maintenance before being released for filling',
    });
  }
}

export class BarrelBlockedException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_BLOCKED';

  constructor(reason?: string) {
    super(reason || 'Barrel is blocked and cannot be used');
  }
}

export class BarrelDisposedException extends KegSafeException {
  readonly statusCode = 400;
  readonly code = 'BARREL_DISPOSED';

  constructor() {
    super('Barrel has been disposed and cannot be used');
  }
}
