import { AppError } from '../utils/AppError.js';

/**
 * Lightweight body validator for enterprise-style request checks.
 * rules: { field: { required?: boolean, type?: 'string'|'number'|'email'|'boolean', min?: number, max?: number } }
 */
export function validateBody(rules) {
  return (req, _res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(rules)) {
      const value = body[field];
      const missing = value === undefined || value === null || value === '';

      if (rule.required && missing) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }
      if (missing) continue;

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
      }
      if (rule.type === 'number' && Number.isNaN(Number(value))) {
        errors.push({ field, message: `${field} must be a number` });
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ field, message: `${field} must be a boolean` });
      }
      if (rule.type === 'email') {
        const ok = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        if (!ok) errors.push({ field, message: `${field} must be a valid email` });
      }
      if (typeof value === 'string') {
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push({ field, message: `${field} must be at least ${rule.min} characters` });
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push({ field, message: `${field} must be at most ${rule.max} characters` });
        }
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rule.enum.join(', ')}` });
      }
    }

    if (errors.length) {
      return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors));
    }
    next();
  };
}

export function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function created(res, data) {
  return ok(res, data, 201);
}
