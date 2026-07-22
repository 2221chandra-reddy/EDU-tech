import { AppError } from '../utils/AppError.js';
import env from '../config/env.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.isOperational ? err.message : 'Something went wrong';

  if (!err.isOperational || status >= 500) {
    console.error('[ERROR]', {
      code,
      message: err.message,
      stack: env.isProd ? undefined : err.stack,
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message: env.isProd && status >= 500 ? 'Internal server error' : message,
      details: err.details || undefined,
    },
  });
}

/** Wrap async route handlers so rejected promises reach error middleware */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
