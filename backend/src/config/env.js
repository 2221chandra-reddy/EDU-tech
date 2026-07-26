import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Always load backend/.env even if process was started from repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Local dev = this PC only. AWS/Docker production = all interfaces.
const defaultHost = isProd ? '0.0.0.0' : '127.0.0.1';

const weakSecrets = new Set([
  'change-me',
  'changeme',
  'secret',
  'jwtsecret',
  'edugate-dev-secret-change-in-production-2026',
  'change-this-to-a-long-random-secret-min-32-chars',
  'change-me-to-a-long-random-production-secret-32chars',
]);

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST || defaultHost,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  extraOrigins: (process.env.EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'edugate-dev-secret-change-in-production-2026'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || (isProd ? '12h' : '7d'),
  dbMode: process.env.DB_MODE || 'memory',
  databaseUrl: process.env.DATABASE_URL || '',
  aiProvider: process.env.AI_PROVIDER || 'mock',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  schedulerIntervalMs: Number(process.env.SCHEDULER_INTERVAL_MS || 30000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || (isProd ? 300 : 1000)),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || (isProd ? 20 : 100)),
  serveFrontend: process.env.SERVE_FRONTEND === 'true' || (isProd && process.env.SERVE_FRONTEND !== 'false'),
  allowMemoryInProd: process.env.ALLOW_MEMORY_IN_PROD === 'true',
  maxUploadVideoMb: Number(process.env.MAX_UPLOAD_VIDEO_MB || 200),
  maxUploadDocMb: Number(process.env.MAX_UPLOAD_DOC_MB || 40),
};

if (env.dbMode === 'postgres' && !env.databaseUrl) {
  throw new Error('DB_MODE=postgres requires DATABASE_URL');
}

if (isProd) {
  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (weakSecrets.has(env.jwtSecret.toLowerCase()) || /change.?me|password|secret123/i.test(env.jwtSecret)) {
    throw new Error('JWT_SECRET is too weak for production — use a long random value');
  }
  if (env.dbMode === 'memory' && !env.allowMemoryInProd) {
    throw new Error('DB_MODE=memory is not allowed in production (set ALLOW_MEMORY_IN_PROD=true only for demos)');
  }
  if (!process.env.CLIENT_URL) {
    console.warn('[boot] WARNING: CLIENT_URL not set — CORS may block browsers');
  }
}

export default env;
