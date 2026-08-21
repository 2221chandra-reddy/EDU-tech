import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import env from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateBody } from '../middleware/validate.js';
import { presentUser, startFreeTrial } from '../services/billing.js';

const router = express.Router();

const USER_SAFE_COLS = `id, name, email, role, target_exam, phone, avatar_url,
  exam_date, daily_study_minutes, preferred_language, target_score,
  qualification, previous_attempt, onboarding_done, diagnostic_done, plan,
  plan_started_at, plan_expires_at, plan_status, created_at`;

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

router.post(
  '/register',
  validateBody({
    name: { required: true, type: 'string', min: 2, max: 120 },
    email: { required: true, type: 'email', max: 180 },
    password: { required: true, type: 'string', min: 8, max: 100 },
    target_exam: { type: 'string', max: 80 },
    phone: { type: 'string', max: 20 },
  }),
  asyncHandler(async (req, res) => {
    const { name, email, password, target_exam, phone } = req.body;
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      throw new AppError('Password must include letters and numbers', 400, 'WEAK_PASSWORD');
    }
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      throw new AppError('Email already registered', 409, 'EMAIL_EXISTS');
    }
    const hash = await bcrypt.hash(password, env.isProd ? 12 : 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, target_exam, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${USER_SAFE_COLS}`,
      [name.trim(), email.toLowerCase(), hash, target_exam || null, phone || null]
    );
    await startFreeTrial(rows[0].id);
    const user = await presentUser({ ...rows[0], plan: 'free' });
    res.status(201).json({ user, token: signToken(user) });
  })
);

router.post(
  '/login',
  validateBody({
    email: { required: true, type: 'email' },
    password: { required: true, type: 'string', min: 1 },
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query(
      `SELECT ${USER_SAFE_COLS}, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!rows.length) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const user = rows[0];
    if (!user.password_hash) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    const { password_hash, ...safeUser } = user;
    const presented = await presentUser(safeUser);
    res.json({ user: presented, token: signToken(presented) });
  })
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    let payload;
    try {
      payload = jwt.verify(header.slice(7), env.jwtSecret);
    } catch {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    const { rows } = await query(
      `SELECT ${USER_SAFE_COLS} FROM users WHERE id = $1`,
      [payload.id]
    );
    if (!rows.length) throw new AppError('User not found', 404, 'NOT_FOUND');
    res.json({ user: await presentUser(rows[0]) });
  })
);

export default router;
