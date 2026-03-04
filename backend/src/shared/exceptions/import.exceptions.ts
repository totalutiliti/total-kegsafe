import { KegSafeException } from './base.exception.js';

export class ImportNotFoundException extends KegSafeException {
  readonly statusCode = 404;
  readonly code = 'IMPORT_NOT_FOUND';

  constructor(uploadId: string) {
    super(`Sessão de importação '${uploadId}' não encontrada ou expirada`, {
      uploadId,
    });
  }
}

export class ImportInProgressException extends KegSafeException {
  readonly statusCode = 409;
  readonly code = 'IMPORT_IN_PROGRESS';

  constructor(uploadId: string) {
    super(`Importação '${uploadId}' já está em andamento`, { uploadId });
  }
}
