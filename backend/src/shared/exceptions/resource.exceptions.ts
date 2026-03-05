import { KegSafeException } from './base.exception.js';

export class ResourceNotFoundException extends KegSafeException {
  readonly statusCode = 404;
  readonly code = 'RESOURCE_NOT_FOUND';

  constructor(resource: string, identifier?: string) {
    super(
      identifier
        ? `${resource} with ID '${identifier}' not found`
        : `${resource} not found`,
    );
  }
}

export class ResourceAlreadyExistsException extends KegSafeException {
  readonly statusCode = 409;
  readonly code = 'RESOURCE_ALREADY_EXISTS';

  constructor(resource: string, field: string, value: string) {
    super(`${resource} with ${field} '${value}' already exists`, {
      field,
      value,
    });
  }
}

export class ResourceDeletedException extends KegSafeException {
  readonly statusCode = 410;
  readonly code = 'RESOURCE_DELETED';

  constructor(resource: string) {
    super(`${resource} has been deleted`);
  }
}
