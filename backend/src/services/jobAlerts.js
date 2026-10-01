import { randomUUID } from 'crypto';
import { query, isMemoryMode } from '../config/db.js';
import { getStore, schedulePersist } from '../db/memory.js';

export const JOB_CATEGORIES = [
  'banking',
  'railways',
  'ssc',
  'insurance',
  'police',
  'state_gov',
  'central_gov',
  'defence',
  'others',
];

const FIELDS = [
  'title',
  'organization',
  'category',
  'start_date',
  'end_date',
  'vacancies',
  'notification_url',
  'apply_url',
  'logo_url',
  'summary',
  'is_published',
];

let tableReady = false;

/** Neon databases created before job alerts existed get the table on first use. */
async function ensureTable() {
  if (tableReady || isMemoryMode()) return;
  await query(`
    CREATE TABLE IF NOT EXISTS job_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(220) NOT NULL,
      organization VARCHAR(160),
      category VARCHAR(40) NOT NULL DEFAULT 'others',
      start_date DATE,
      end_date DATE,
      vacancies INT,
      notification_url TEXT,
      apply_url TEXT,
      logo_url TEXT,
      summary TEXT,
      is_published BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  tableReady = true;
}

export function normalizeCategory(value, title = '') {
  const v = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  if (JOB_CATEGORIES.includes(v)) return v;
  const hay = `${v} ${title}`.toLowerCase();
  if (/rrb|railway|rail/.test(hay)) return 'railways';
  if (/ssc|staff selection/.test(hay)) return 'ssc';
  if (/ibps|sbi|bank|rbi|nabard/.test(hay)) return 'banking';
  if (/lic|insurance|uiic|niacl|gic/.test(hay)) return 'insurance';
  if (/police|constable|sub.?inspector|capf|crpf|bsf/.test(hay)) return 'police';
  if (/army|navy|air force|agniveer|defence|drdo/.test(hay)) return 'defence';
  if (/appsc|tspsc|state|psc/.test(hay)) return 'state_gov';
  if (/upsc|central|ministry/.test(hay)) return 'central_gov';
  return 'others';
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cleanUrl(value) {
  const s = String(value || '').trim();
  return /^https?:\/\//i.test(s) ? s.slice(0, 1000) : null;
}

export function sanitizeJobAlert(body = {}) {
  const title = String(body.title || '').trim().slice(0, 220);
  const vacancies = Number(String(body.vacancies ?? '').replace(/,/g, ''));
  return {
    title,
    organization: String(body.organization || '').trim().slice(0, 160) || null,
    category: normalizeCategory(body.category, title),
    start_date: toDate(body.start_date),
    end_date: toDate(body.end_date),
    vacancies: Number.isFinite(vacancies) && vacancies > 0 ? Math.round(vacancies) : null,
    notification_url: cleanUrl(body.notification_url),
    apply_url: cleanUrl(body.apply_url),
    logo_url: cleanUrl(body.logo_url),
    summary: String(body.summary || '').trim().slice(0, 600) || null,
    is_published: body.is_published !== false,
  };
}

function sortAlerts(rows) {
  const today = new Date().toISOString().slice(0, 10);
  return rows.slice().sort((a, b) => {
    const aOpen = !a.end_date || String(a.end_date).slice(0, 10) >= today;
    const bOpen = !b.end_date || String(b.end_date).slice(0, 10) >= today;
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return String(b.start_date || b.created_at || '').localeCompare(String(a.start_date || a.created_at || ''));
  });
}

export async function listJobAlerts({ category, includeHidden = false, includeExpired = false } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const cat = category && category !== 'all' ? normalizeCategory(category) : null;

  if (isMemoryMode()) {
    const s = getStore();
    if (!s.job_alerts) s.job_alerts = [];
    let rows = s.job_alerts.filter((r) => includeHidden || r.is_published !== false);
    if (cat) rows = rows.filter((r) => r.category === cat);
    if (!includeExpired) rows = rows.filter((r) => !r.end_date || String(r.end_date).slice(0, 10) >= today);
    return sortAlerts(rows);
  }

  await ensureTable();
  const params = [];
  let sql = `SELECT * FROM job_alerts WHERE 1=1`;
  if (!includeHidden) sql += ` AND COALESCE(is_published, TRUE) = TRUE`;
  if (cat) {
    params.push(cat);
    sql += ` AND category = $${params.length}`;
  }
  if (!includeExpired) {
    params.push(today);
    sql += ` AND (end_date IS NULL OR end_date >= $${params.length}::date)`;
  }
  const { rows } = await query(sql, params);
  return sortAlerts(rows);
}

export async function createJobAlert(body) {
  const data = sanitizeJobAlert(body);
  if (!data.title) throw new Error('Title is required');

  if (isMemoryMode()) {
    const s = getStore();
    if (!s.job_alerts) s.job_alerts = [];
    const row = { id: randomUUID(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    s.job_alerts.push(row);
    schedulePersist();
    return row;
  }

  await ensureTable();
  const cols = FIELDS;
  const { rows } = await query(
    `INSERT INTO job_alerts (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    cols.map((c) => data[c])
  );
  return rows[0];
}

export async function updateJobAlert(id, body) {
  const data = sanitizeJobAlert(body);
  if (!data.title) throw new Error('Title is required');

  if (isMemoryMode()) {
    const s = getStore();
    const row = (s.job_alerts || []).find((r) => r.id === id);
    if (!row) throw new Error('Job alert not found');
    Object.assign(row, data, { updated_at: new Date().toISOString() });
    schedulePersist();
    return row;
  }

  await ensureTable();
  const sets = FIELDS.map((c, i) => `${c} = $${i + 1}`);
  const { rows } = await query(
    `UPDATE job_alerts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${FIELDS.length + 1} RETURNING *`,
    [...FIELDS.map((c) => data[c]), id]
  );
  if (!rows.length) throw new Error('Job alert not found');
  return rows[0];
}

export async function deleteJobAlert(id) {
  if (isMemoryMode()) {
    const s = getStore();
    const idx = (s.job_alerts || []).findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Job alert not found');
    const [removed] = s.job_alerts.splice(idx, 1);
    schedulePersist();
    return removed;
  }

  await ensureTable();
  const { rows } = await query(`DELETE FROM job_alerts WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throw new Error('Job alert not found');
  return rows[0];
}
