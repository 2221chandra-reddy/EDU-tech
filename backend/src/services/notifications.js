import { randomUUID } from 'crypto';
import { getStore, schedulePersist } from '../db/memory.js';
import { isMemoryMode, query } from '../config/db.js';

function nowIso() {
  return new Date().toISOString();
}

function normExam(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function examMatches(studentTarget, examName, examCode) {
  const t = normExam(studentTarget);
  if (!t) return false;
  const name = normExam(examName);
  const code = normExam(examCode);
  return t === name || t === code || (name && (name.includes(t) || t.includes(name)));
}

async function listStudents() {
  if (isMemoryMode()) {
    return (getStore().users || []).filter((u) => u.role === 'student');
  }
  const { rows } = await query(`SELECT id, target_exam FROM users WHERE role = 'student'`);
  return rows;
}

async function examMeta(examId) {
  if (!examId) return { name: '', code: '' };
  if (isMemoryMode()) {
    const e = getStore().exams.find((x) => x.id === examId);
    return { name: e?.name || '', code: e?.code || '' };
  }
  const { rows } = await query(`SELECT name, code FROM exams WHERE id = $1`, [examId]);
  return { name: rows[0]?.name || '', code: rows[0]?.code || '' };
}

export async function notifyCbtPublished(mock) {
  if (!mock?.id || !mock.is_live) return { sent: 0 };
  const exam = await examMeta(mock.exam_id);
  const students = await listStudents();
  const recipients = students.filter((u) => examMatches(u.target_exam, exam.name, exam.code));
  const title = 'Live CBT exam started';
  const mins = mock.duration_minutes || 90;
  const examLabel = exam.name || 'your target exam';
  const body = `${mock.title || 'A live exam'} for ${examLabel} is live now. Duration ${mins} minutes. Open Live Exams to start.`;
  const link = '/dashboard/live';

  let sent = 0;
  if (isMemoryMode()) {
    const s = getStore();
    if (!s.notifications) s.notifications = [];
    for (const u of recipients) {
      s.notifications.push({
        id: randomUUID(),
        user_id: u.id,
        title,
        body,
        type: 'cbt',
        mock_test_id: mock.id,
        link,
        is_read: false,
        read_at: null,
        created_at: nowIso(),
      });
      sent += 1;
    }
    schedulePersist();
    return { sent };
  }

  for (const u of recipients) {
    await query(
      `INSERT INTO notifications (user_id, title, body, type, mock_test_id, link)
       VALUES ($1,$2,$3,'cbt',$4,$5)`,
      [u.id, title, body, mock.id, link]
    );
    sent += 1;
  }
  return { sent };
}

export async function listNotifications(userId) {
  if (isMemoryMode()) {
    const rows = (getStore().notifications || [])
      .filter((n) => n.user_id === userId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return rows.slice(0, 40);
  }
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
    [userId]
  );
  return rows;
}

export async function unreadCount(userId) {
  const rows = await listNotifications(userId);
  return rows.filter((n) => !n.is_read).length;
}

export async function markNotificationRead(userId, id) {
  if (isMemoryMode()) {
    const n = (getStore().notifications || []).find((x) => x.id === id && x.user_id === userId);
    if (!n) throw new Error('Notification not found');
    n.is_read = true;
    n.read_at = nowIso();
    schedulePersist();
    return n;
  }
  const { rows } = await query(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW()
     WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, userId]
  );
  if (!rows.length) throw new Error('Notification not found');
  return rows[0];
}

export async function markAllRead(userId) {
  if (isMemoryMode()) {
    const rows = (getStore().notifications || []).filter((n) => n.user_id === userId && !n.is_read);
    const at = nowIso();
    for (const n of rows) {
      n.is_read = true;
      n.read_at = at;
    }
    schedulePersist();
    return { updated: rows.length };
  }
  const { rowCount } = await query(
    `UPDATE notifications SET is_read = TRUE, read_at = NOW()
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return { updated: rowCount || 0 };
}
