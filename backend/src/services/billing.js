import { createHmac, randomUUID } from 'crypto';
import { query, isMemoryMode } from '../config/db.js';
import { getStore, schedulePersist } from '../db/memory.js';
import env from '../config/env.js';

export const DEFAULT_PLAN_SETTINGS = {
  id: 'default',
  free_trial_days: 7,
  premium_price_inr: 499,
  premium_duration_days: 30,
  currency: 'INR',
  razorpay_key_id: '',
};

function addDays(from, days) {
  const d = new Date(from);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function iso(d) {
  return d instanceof Date ? d.toISOString() : d;
}

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function publicSettings(row) {
  const merged = { ...DEFAULT_PLAN_SETTINGS, ...(row || {}) };
  const envKey = env.razorpayKeyId || merged.razorpay_key_id || '';
  return {
    free_trial_days: Number(merged.free_trial_days) || 7,
    premium_price_inr: Number(merged.premium_price_inr) || 499,
    premium_duration_days: Number(merged.premium_duration_days) || 30,
    currency: merged.currency || 'INR',
    razorpay_key_id: envKey,
    razorpay_configured: Boolean(envKey && env.razorpayKeySecret),
    demo_pay_allowed: Boolean(env.allowDemoPay || !env.isProd),
  };
}

export async function getPlanSettings() {
  if (isMemoryMode()) {
    const s = getStore();
    if (!s.plan_settings) s.plan_settings = [];
    let row = s.plan_settings.find((x) => x.id === 'default');
    if (!row) {
      row = { ...DEFAULT_PLAN_SETTINGS, updated_at: new Date().toISOString() };
      s.plan_settings.push(row);
      schedulePersist();
    }
    return publicSettings(row);
  }

  const existing = await query(`SELECT * FROM plan_settings WHERE id = 'default'`);
  if (!existing.rows.length) {
    await query(`INSERT INTO plan_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`);
    const again = await query(`SELECT * FROM plan_settings WHERE id = 'default'`);
    return publicSettings(again.rows[0]);
  }
  return publicSettings(existing.rows[0]);
}

export async function updatePlanSettings(body = {}) {
  const current = await getPlanSettings();
  const next = {
    free_trial_days: Math.min(365, Math.max(1, Number(body.free_trial_days ?? current.free_trial_days))),
    premium_price_inr: Math.min(99999, Math.max(1, Number(body.premium_price_inr ?? current.premium_price_inr))),
    premium_duration_days: Math.min(730, Math.max(1, Number(body.premium_duration_days ?? current.premium_duration_days))),
    razorpay_key_id: body.razorpay_key_id != null ? String(body.razorpay_key_id).trim() : current.razorpay_key_id,
  };

  if (isMemoryMode()) {
    const s = getStore();
    if (!s.plan_settings) s.plan_settings = [];
    let row = s.plan_settings.find((x) => x.id === 'default');
    if (!row) {
      row = { ...DEFAULT_PLAN_SETTINGS };
      s.plan_settings.push(row);
    }
    Object.assign(row, next, { updated_at: new Date().toISOString() });
    schedulePersist();
    return publicSettings(row);
  }

  await query(
    `UPDATE plan_settings SET
       free_trial_days = $1,
       premium_price_inr = $2,
       premium_duration_days = $3,
       razorpay_key_id = $4,
       updated_at = NOW()
     WHERE id = 'default'`,
    [next.free_trial_days, next.premium_price_inr, next.premium_duration_days, next.razorpay_key_id || null]
  );
  return getPlanSettings();
}

async function readUser(userId) {
  if (isMemoryMode()) {
    return getStore().users.find((u) => u.id === userId) || null;
  }
  const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
  return rows[0] || null;
}

async function writeUserPlan(userId, fields) {
  if (isMemoryMode()) {
    const u = getStore().users.find((x) => x.id === userId);
    if (!u) return null;
    Object.assign(u, fields, { updated_at: new Date().toISOString() });
    schedulePersist();
    const { password_hash, ...safe } = u;
    return safe;
  }
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }
  params.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function startFreeTrial(userId) {
  const settings = await getPlanSettings();
  const started = new Date();
  return writeUserPlan(userId, {
    plan: 'free',
    plan_status: 'active',
    plan_started_at: iso(started),
    plan_expires_at: iso(addDays(started, settings.free_trial_days)),
  });
}

export async function grantPremium(userId, days, { provider = 'razorpay', paymentId = null } = {}) {
  const settings = await getPlanSettings();
  const grantDays = Number(days) || settings.premium_duration_days;
  const user = await readUser(userId);
  if (!user) throw new Error('User not found');
  const now = new Date();
  const currentEnd = user.plan === 'premium' && user.plan_expires_at && new Date(user.plan_expires_at) > now
    ? new Date(user.plan_expires_at)
    : now;
  const updated = await writeUserPlan(userId, {
    plan: 'premium',
    plan_status: 'active',
    plan_started_at: iso(now),
    plan_expires_at: iso(addDays(currentEnd, grantDays)),
  });
  if (paymentId) {
    /* payment row already exists */
  }
  return { user: updated, days: grantDays, provider };
}

export async function expireToFree(userId) {
  return writeUserPlan(userId, {
    plan: 'free',
    plan_status: 'expired',
    plan_expires_at: iso(new Date()),
  });
}

export async function syncUserPlan(user) {
  if (!user) return null;
  const settings = await getPlanSettings();
  if (user.role === 'admin') {
    return {
      ...user,
      plan: 'premium',
      plan_status: 'active',
      plan_expired: false,
      days_left: 9999,
    };
  }

  let expires = user.plan_expires_at || null;
  if (!expires) {
    const base = user.created_at || new Date();
    const trialEnd = addDays(base, settings.free_trial_days);
    await writeUserPlan(user.id, {
      plan_started_at: user.plan_started_at || iso(base),
      plan_expires_at: iso(trialEnd),
      plan_status: 'active',
    });
    expires = iso(trialEnd);
    user = { ...user, plan_expires_at: expires, plan_status: 'active' };
  }

  const leftover = daysLeft(expires);
  const expired = leftover != null && leftover < 0;

  if (expired && (user.plan === 'premium' || user.plan_status !== 'expired')) {
    const downgraded = await writeUserPlan(user.id, {
      plan: 'free',
      plan_status: 'expired',
    });
    user = { ...user, ...downgraded, plan: 'free', plan_status: 'expired' };
  }

  return {
    ...user,
    plan_expired: expired,
    days_left: expired ? 0 : leftover,
    plan_status: expired ? 'expired' : user.plan_status || 'active',
  };
}

export async function presentUserById(userId) {
  const user = await readUser(userId);
  if (!user) return null;
  return presentUser(user);
}

export async function presentUser(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  const billed = await syncUserPlan(safe);
  const settings = await getPlanSettings();
  const premium = billed.role === 'admin' || (billed.plan === 'premium' && !billed.plan_expired);
  const trialActive = billed.plan === 'free' && !billed.plan_expired;
  return {
    ...billed,
    entitlements: {
      premium,
      trial_active: trialActive,
      ai_unlimited: premium,
      live_unlimited: premium,
    },
    billing: {
      ...settings,
      plan: billed.plan,
      plan_status: billed.plan_status,
      plan_expired: billed.plan_expired,
      days_left: billed.days_left,
      plan_expires_at: billed.plan_expires_at,
    },
  };
}

export async function getEntitlements(userId) {
  const user = await readUser(userId);
  const presented = await presentUser(user);
  return presented?.entitlements || { premium: false, trial_active: false, ai_unlimited: false, live_unlimited: false };
}

async function insertPayment(row) {
  const record = {
    id: row.id || randomUUID(),
    user_id: row.user_id,
    amount_inr: row.amount_inr,
    currency: row.currency || 'INR',
    provider: row.provider || 'razorpay',
    provider_order_id: row.provider_order_id || null,
    provider_payment_id: row.provider_payment_id || null,
    status: row.status || 'created',
    plan_granted: row.plan_granted || 'premium',
    days_granted: row.days_granted || null,
    raw: row.raw || null,
    created_at: new Date().toISOString(),
    paid_at: row.paid_at || null,
  };

  if (isMemoryMode()) {
    const s = getStore();
    if (!s.payments) s.payments = [];
    s.payments.unshift(record);
    schedulePersist();
    return record;
  }

  const { rows } = await query(
    `INSERT INTO payments (id, user_id, amount_inr, currency, provider, provider_order_id, provider_payment_id, status, plan_granted, days_granted, raw, paid_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      record.id,
      record.user_id,
      record.amount_inr,
      record.currency,
      record.provider,
      record.provider_order_id,
      record.provider_payment_id,
      record.status,
      record.plan_granted,
      record.days_granted,
      record.raw ? JSON.stringify(record.raw) : null,
      record.paid_at,
    ]
  );
  return rows[0];
}

async function updatePayment(id, fields) {
  if (isMemoryMode()) {
    const s = getStore();
    const row = (s.payments || []).find((p) => p.id === id || p.provider_order_id === id);
    if (!row) return null;
    Object.assign(row, fields);
    schedulePersist();
    return row;
  }
  const sets = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    params.push(key === 'raw' && value && typeof value === 'object' ? JSON.stringify(value) : value);
    sets.push(`${key} = $${params.length}`);
  }
  params.push(id);
  const { rows } = await query(
    `UPDATE payments SET ${sets.join(', ')} WHERE id = $${params.length} OR provider_order_id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function listPayments({ userId = null, limit = 50 } = {}) {
  if (isMemoryMode()) {
    const s = getStore();
    let rows = s.payments || [];
    if (userId) rows = rows.filter((p) => p.user_id === userId);
    return rows.slice(0, limit).map((p) => {
      const u = s.users.find((x) => x.id === p.user_id);
      return { ...p, email: u?.email, name: u?.name };
    });
  }
  if (userId) {
    const { rows } = await query(
      `SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT p.*, u.email, u.name
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function createCheckoutOrder(userId) {
  const settings = await getPlanSettings();
  const amount = settings.premium_price_inr;
  const payment = await insertPayment({
    user_id: userId,
    amount_inr: amount,
    currency: settings.currency,
    provider: settings.razorpay_configured ? 'razorpay' : 'demo',
    status: 'created',
    days_granted: settings.premium_duration_days,
  });

  if (!settings.razorpay_configured) {
    return {
      mode: settings.demo_pay_allowed ? 'demo' : 'manual',
      payment_id: payment.id,
      amount_inr: amount,
      currency: settings.currency,
      days: settings.premium_duration_days,
      key_id: null,
    };
  }

  const auth = Buffer.from(`${settings.razorpay_key_id}:${env.razorpayKeySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amount * 100,
      currency: 'INR',
      receipt: String(payment.id).slice(0, 40),
      notes: { user_id: userId, payment_id: payment.id },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    await updatePayment(payment.id, { status: 'failed', raw: data });
    throw new Error(data.error?.description || 'Could not create Razorpay order');
  }

  await updatePayment(payment.id, { provider_order_id: data.id, raw: data });
  return {
    mode: 'razorpay',
    payment_id: payment.id,
    order_id: data.id,
    amount_inr: amount,
    amount_paise: amount * 100,
    currency: 'INR',
    key_id: settings.razorpay_key_id,
    days: settings.premium_duration_days,
  };
}

export async function verifyRazorpayPayment({ userId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!env.razorpayKeySecret) throw new Error('Razorpay is not configured');
  const expected = createHmac('sha256', env.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    throw new Error('Payment signature mismatch');
  }
  const settings = await getPlanSettings();
  await updatePayment(razorpay_order_id, {
    provider_order_id: razorpay_order_id,
    provider_payment_id: razorpay_payment_id,
    status: 'paid',
    paid_at: new Date().toISOString(),
  });
  const granted = await grantPremium(userId, settings.premium_duration_days, { provider: 'razorpay' });
  return granted;
}

export async function completeDemoPayment(userId) {
  const settings = await getPlanSettings();
  if (!settings.demo_pay_allowed) {
    throw new Error('Demo pay is disabled. Add Razorpay keys or set ALLOW_DEMO_PAY=true.');
  }
  await insertPayment({
    user_id: userId,
    amount_inr: settings.premium_price_inr,
    currency: settings.currency,
    provider: 'demo',
    status: 'demo',
    days_granted: settings.premium_duration_days,
    paid_at: new Date().toISOString(),
  });
  return grantPremium(userId, settings.premium_duration_days, { provider: 'demo' });
}

export async function adminSetStudentPlan(userId, plan) {
  const settings = await getPlanSettings();
  if (plan === 'premium') {
    await insertPayment({
      user_id: userId,
      amount_inr: 0,
      provider: 'admin',
      status: 'paid',
      days_granted: settings.premium_duration_days,
      paid_at: new Date().toISOString(),
    });
    return grantPremium(userId, settings.premium_duration_days, { provider: 'admin' });
  }
  const user = await expireToFree(userId);
  return { user, days: 0, provider: 'admin' };
}
