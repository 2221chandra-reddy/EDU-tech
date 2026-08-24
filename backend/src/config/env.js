import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Always load backend/.env even if process was started from repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

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

const demoDbRel = process.env.DEMO_DB_PATH || 'data/demo-db.json';
const databaseUrl = process.env.DATABASE_URL || '';

function resolveDbMode() {
  const explicit = (process.env.DB_MODE || '').toLowerCase();
  const isNeon = /neon\.tech/i.test(databaseUrl);
  if (isNeon && explicit !== 'memory') return 'postgres';
  if (explicit) return explicit;
  if (databaseUrl) return 'postgres';
  return isProd ? 'memory' : 'file';
}

const dbMode = resolveDbMode();

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
  dbMode,
  databaseUrl,
  demoDbPath: path.isAbsolute(demoDbRel) ? demoDbRel : path.join(backendRoot, demoDbRel),
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
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  allowDemoPay: process.env.ALLOW_DEMO_PAY === 'true',
  maxUploadVideoMb: Number(process.env.MAX_UPLOAD_VIDEO_MB || 200),
  maxUploadDocMb: Number(process.env.MAX_UPLOAD_DOC_MB || 40),
  awsRegion: process.env.AWS_REGION || '',
  awsS3Bucket: process.env.AWS_S3_BUCKET || '',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3SignedUrlExpires: Number(process.env.S3_SIGNED_URL_EXPIRES || 3600),
};

if (!['memory', 'file', 'postgres'].includes(env.dbMode)) {
  throw new Error(`DB_MODE must be memory, file, or postgres (got: ${env.dbMode})`);
}

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
  if ((env.dbMode === 'memory' || env.dbMode === 'file') && !env.allowMemoryInProd) {
    throw new Error(
      `DB_MODE=${env.dbMode} is not allowed in production (set ALLOW_MEMORY_IN_PROD=true only for demos)`
    );
  }
  if (!process.env.CLIENT_URL) {
    console.warn('[boot] WARNING: CLIENT_URL not set — CORS may block browsers');
  }
}

export default env;
