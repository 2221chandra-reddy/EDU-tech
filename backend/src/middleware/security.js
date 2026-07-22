import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/** Stricter limit for login / register (brute-force protection) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AUTH_RATE_LIMITED', message: 'Too many auth attempts. Try again in 15 minutes.' },
  },
});

/** Limit contact form spam */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.isProd ? 10 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'CONTACT_RATE_LIMITED', message: 'Too many contact messages. Try again later.' },
  },
});

/** Limit expensive AI endpoints */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isProd ? 60 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'AI_RATE_LIMITED', message: 'AI rate limit reached. Please wait and try again.' },
  },
});
