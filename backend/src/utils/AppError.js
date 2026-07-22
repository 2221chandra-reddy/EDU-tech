export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export function assertFound(value, message = 'Resource not found') {
  if (!value) throw new AppError(message, 404, 'NOT_FOUND');
  return value;
}

export function assertAuth(condition, message = 'Authentication required') {
  if (!condition) throw new AppError(message, 401, 'UNAUTHORIZED');
}

export function assertForbidden(condition, message = 'Access denied') {
  if (!condition) throw new AppError(message, 403, 'FORBIDDEN');
}

export function assertValid(condition, message = 'Validation failed', details = null) {
  if (!condition) throw new AppError(message, 400, 'VALIDATION_ERROR', details);
}
