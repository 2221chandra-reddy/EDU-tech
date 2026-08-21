import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import env from './config/env.js';
import { isMemoryMode, isFileDbMode } from './config/db.js';
import { bootDemoStore, seedMemory } from './db/memory.js';
import { processDueSchedules, purgeUnwantedContent } from './services/scheduler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { authLimiter } from './middleware/security.js';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import studentRoutes from './routes/student.js';
import aiRoutes from './routes/ai.js';
import practiceRoutes from './routes/practice.js';
import cbtRoutes from './routes/cbt.js';
import adminRoutes from './routes/admin.js';
import billingRoutes from './routes/billing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = process.env.VERCEL
  ? path.join('/tmp', env.uploadDir || 'uploads')
  : path.join(__dirname, '..', env.uploadDir);
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
try {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
  console.warn('[boot] upload dir unavailable:', err.message);
}

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: env.isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:'],
            mediaSrc: ["'self'", 'blob:'],
            connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
            frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
            fontSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
    hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

const allowedOrigins = new Set(
  [
    env.clientUrl,
    ...env.extraOrigins,
    `http://localhost:${env.port}`,
    `http://127.0.0.1:${env.port}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // Same-origin SPA when API serves frontend (browser Origin matches CLIENT_URL)
      if (env.serveFrontend && origin === env.clientUrl) return cb(null, true);
      if (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
    },
  })
);

app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static uploads: no directory listing; nosniff
app.use(
  '/uploads',
  express.static(uploadDir, {
    fallthrough: true,
    maxAge: env.isProd ? '1d' : '1h',
    index: false,
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', env.isProd ? 'public, max-age=86400' : 'no-store');
    },
  })
);

app.get('/api/health', (_req, res) => {
  const payload = {
    status: 'ok',
    service: 'EduGate AI Learning + CBT API',
    timestamp: new Date().toISOString(),
  };
  // Extra diagnostics only in non-production
  if (!env.isProd) {
    Object.assign(payload, {
      version: '1.0.0',
      environment: env.nodeEnv,
      ai_provider: env.aiProvider,
      db_mode: isMemoryMode() ? 'memory' : 'postgres',
      mode: env.serveFrontend ? 'online-fullstack' : 'api-only',
    });
  }
  res.json({ success: true, data: payload });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/cbt', cbtRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

if (env.serveFrontend && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: '1h', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log(`[boot] Serving frontend from ${frontendDist}`);
}

app.use(notFoundHandler);
app.use(errorHandler);

async function bootDataStores() {
  if (isMemoryMode()) {
    if (isFileDbMode()) {
      const result = await bootDemoStore({ persist: true, filePath: env.demoDbPath });
      await purgeUnwantedContent();
      if (result.loaded) {
        console.log(`[boot] DB mode: file (demo persisted) — loaded ${env.demoDbPath}`);
      } else {
        console.log(`[boot] DB mode: file (demo persisted) — seeded ${env.demoDbPath}`);
      }
    } else {
      await seedMemory();
      await purgeUnwantedContent();
      console.log(`[boot] DB mode: memory (demo) — resets on restart; use DB_MODE=file to persist`);
    }
  } else {
    await purgeUnwantedContent();
    console.log('[boot] DB mode: postgres');
  }
}

async function start() {
  await bootDataStores();

  setInterval(() => {
    processDueSchedules()
      .then((results) => {
        if (results.length) {
          console.log(`[scheduler] published ${results.length} paper(s)`);
        }
      })
      .catch((err) => console.error('[scheduler]', err.message));
  }, env.schedulerIntervalMs);

  app.listen(env.port, env.host, () => {
    console.log(`[boot] EduGate listening on ${env.host}:${env.port}`);
    console.log(`[boot] env=${env.nodeEnv} ai=${env.aiProvider} serveFrontend=${env.serveFrontend}`);
    if (env.isProd) {
      console.log(`[boot] Production security active — set CLIENT_URL to your https domain`);
    } else {
      console.log(`[boot] Local only — open http://localhost:5173`);
    }
  });
}

/** Vercel Services / serverless: export the Express app (no app.listen). */
export default app;

if (process.env.VERCEL) {
  // Cold-start data boot for serverless; do not call listen()
  bootDataStores().catch((err) => {
    console.error('[boot] Vercel data boot failed:', err);
  });
} else {
  start().catch((err) => {
    console.error('[boot] Failed to start:', err);
    process.exit(1);
  });
}