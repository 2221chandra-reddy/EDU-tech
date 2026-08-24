import { randomUUID } from 'crypto';
import { getStore, schedulePersist } from '../db/memory.js';
import { isMemoryMode, query } from '../config/db.js';
import { generateQuestions } from './ai.js';
import { keepStoredUrl, deleteStoredAsset, parseS3Key, readTextObject } from './s3.js';
import { notifyCbtPublished } from './notifications.js';
import {
  questionsForSection,
  validatePatternSections,
  syllabusPrompt,
  NEGATIVE_ONE_THIRD,
  BLUEPRINTS,
} from '../data/exam-blueprints.js';

const DEFAULT_SUBJECTS = [
  { name: 'Mathematics', code: 'MATH', description: 'Quantitative aptitude, arithmetic, algebra, geometry' },
  { name: 'Reasoning', code: 'REASONING', description: 'Logical, verbal and non-verbal reasoning' },
  { name: 'English', code: 'ENGLISH', description: 'Grammar, vocabulary, comprehension' },
  { name: 'General Awareness', code: 'GA', description: 'Static GK and current affairs' },
  { name: 'General Science', code: 'SCIENCE', description: 'Physics, chemistry and biology basics' },
  { name: 'Physics', code: 'PHYSICS', description: 'Mechanics, electricity, optics' },
  { name: 'Chemistry', code: 'CHEMISTRY', description: 'Physical, organic and inorganic' },
  { name: 'Biology', code: 'BIOLOGY', description: 'Human body, plants, diseases' },
  { name: 'Computer Awareness', code: 'COMPUTER', description: 'Basics of computers and IT' },
  { name: 'Current Affairs', code: 'CA', description: 'National and international updates' },
  { name: 'Banking Awareness', code: 'BANKING', description: 'Banking terms, RBI, finance' },
  { name: 'Polity', code: 'POLITY', description: 'Indian Constitution and governance' },
  { name: 'Geography', code: 'GEOGRAPHY', description: 'India and world geography' },
  { name: 'History', code: 'HISTORY', description: 'Ancient, medieval and modern India' },
  { name: 'Economics', code: 'ECONOMICS', description: 'Basic economics and budget' },
];

function nowIso() {
  return new Date().toISOString();
}

async function blueprintForExamId(exam_id) {
  if (!exam_id) return null;
  if (isMemoryMode()) {
    const code = getStore().exams.find((e) => e.id === exam_id)?.code;
    return BLUEPRINTS[code]?.paper_pattern || null;
  }
  const { rows } = await query(`SELECT code FROM exams WHERE id = $1`, [exam_id]);
  return BLUEPRINTS[rows[0]?.code]?.paper_pattern || null;
}

export function ensureScheduleCollections() {
  const s = getStore();
  if (!s.subjects) s.subjects = [];
  if (!s.exam_schedules) s.exam_schedules = [];
  if (!s.notebook_jobs) s.notebook_jobs = [];
  if (!s.notifications) s.notifications = [];
}

function isSystemSubject(sub) {
  if (!sub) return false;
  if (sub.origin === 'admin') return false;
  if (sub.origin === 'system') return true;
  const name = String(sub.name || '').trim().toLowerCase();
  return DEFAULT_SUBJECTS.some((d) => d.name.toLowerCase() === name);
}

function markLegacySeededSubjects() {
  ensureScheduleCollections();
  const s = getStore();
  let changed = false;
  for (const sub of s.subjects) {
    if (sub.origin) continue;
    const name = String(sub.name || '').trim().toLowerCase();
    if (DEFAULT_SUBJECTS.some((d) => d.name.toLowerCase() === name)) {
      sub.origin = 'system';
      changed = true;
    }
  }
  if (changed) schedulePersist();
}

function normalizeStem(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const DEMO_MATERIAL_TITLES = new Set([
  'RRB NTPC Maths eBook',
  'Percentage Basics',
  'Blood Relations Notes',
  "Ohm's Law Chapter PDF",
  'Reasoning Mind Map',
  'Maths Quick Revision',
  'Weekly Current Affairs Digest',
  'RRB NTPC 2024 Previous Paper',
  'SSC Algebra Video Series',
  'Banking Awareness PDF',
]);

const DEMO_MOCK_TITLES = new Set(['RRB NTPC Full Mock Test 1', 'SSC CGL Tier-1 Practice Mock']);
const DEMO_PRACTICE_TITLES = new Set(['Percentage Topic Drill']);

function isDemoMaterial(m) {
  if (!m) return false;
  if (m.origin === 'admin') return false;
  if (m.origin === 'system') return true;
  return DEMO_MATERIAL_TITLES.has(String(m.title || '').trim());
}

function isDemoQuestion(q) {
  return String(q?.source || '').toLowerCase() === 'sample';
}

export function seedSubjectsIfEmpty() {
  // Intentionally empty: admin subject list is only what admin creates.
}

export async function listSubjects() {
  if (isMemoryMode()) {
    ensureScheduleCollections();
    markLegacySeededSubjects();
    return getStore()
      .subjects.filter((s) => !isSystemSubject(s))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const { rows } = await query(`SELECT * FROM subjects ORDER BY name`);
  return rows;
}

export async function createSubject({ name, code, description }) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Subject name is required');
  if (cleanName.length < 2) throw new Error('Subject name is too short');

  const cleanCode = (code || cleanName).toUpperCase().replace(/\s+/g, '_').slice(0, 40);

  if (isMemoryMode()) {
    ensureScheduleCollections();
    const s = getStore();
    const existing = s.subjects.find(
      (x) =>
        String(x.name).trim().toLowerCase() === cleanName.toLowerCase() ||
        String(x.code).trim().toLowerCase() === cleanCode.toLowerCase()
    );
    if (existing) {
      if (isSystemSubject(existing)) {
        existing.origin = 'admin';
        existing.description = description || existing.description || '';
        schedulePersist();
        return existing;
      }
      throw new Error('This subject already exists');
    }
    const row = {
      id: randomUUID(),
      name: cleanName,
      code: cleanCode,
      description: description || '',
      origin: 'admin',
      created_at: nowIso(),
    };
    s.subjects.push(row);
    schedulePersist();
    return row;
  }

  const found = await query(
    `SELECT * FROM subjects WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR LOWER(TRIM(code)) = LOWER(TRIM($2)) LIMIT 1`,
    [cleanName, cleanCode]
  );
  if (found.rows[0]) {
    if (isSystemSubject(found.rows[0])) {
      const { rows } = await query(
        `UPDATE subjects SET name = $1, code = $2, description = COALESCE($3, description) WHERE id = $4 RETURNING *`,
        [cleanName, cleanCode, description || null, found.rows[0].id]
      );
      return { ...rows[0], origin: 'admin' };
    }
    throw new Error('This subject already exists');
  }
  const { rows } = await query(
    `INSERT INTO subjects (name, code, description) VALUES ($1, $2, $3) RETURNING *`,
    [cleanName, cleanCode, description || null]
  );
  return { ...rows[0], origin: 'admin' };
}

export async function deleteSubject(id) {
  if (!id) throw new Error('Subject id is required');

  if (isMemoryMode()) {
    ensureScheduleCollections();
    const s = getStore();
    const idx = s.subjects.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error('Subject not found');
    const [removed] = s.subjects.splice(idx, 1);
    schedulePersist();
    return removed;
  }

  const { rows } = await query(`DELETE FROM subjects WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throw new Error('Subject not found');
  return rows[0];
}

/** Subjects with no materials/videos attached */
export async function deleteUnusedSubjects() {
  if (isMemoryMode()) {
    ensureScheduleCollections();
    const s = getStore();
    const used = new Set(
      (s.materials || [])
        .map((m) => String(m.subject || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const removed = [];
    s.subjects = (s.subjects || []).filter((sub) => {
      const key = String(sub.name || '').trim().toLowerCase();
      if (key && used.has(key)) return true;
      removed.push(sub);
      return false;
    });
    schedulePersist();
    return { deleted: removed.length, subjects: removed };
  }

  const { rows } = await query(
    `DELETE FROM subjects s
     WHERE NOT EXISTS (
       SELECT 1 FROM materials m
       WHERE LOWER(TRIM(m.subject)) = LOWER(TRIM(s.name))
     )
     RETURNING *`
  );
  return { deleted: rows.length, subjects: rows };
}

export async function deleteCourse(id) {
  if (!id) throw new Error('Course id is required');

  if (isMemoryMode()) {
    const s = getStore();
    const idx = s.courses.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Course not found');
    const [removed] = s.courses.splice(idx, 1);
    s.enrollments = (s.enrollments || []).filter((e) => e.course_id !== id);
    s.materials = (s.materials || []).map((m) =>
      m.course_id === id ? { ...m, course_id: null } : m
    );
    s.certificates = (s.certificates || []).map((c) =>
      c.course_id === id ? { ...c, course_id: null } : c
    );
    schedulePersist();
    return removed;
  }

  const { rows } = await query(`DELETE FROM courses WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throw new Error('Course not found');
  return rows[0];
}

export async function listMaterialsAdmin({ type, subject } = {}) {
  if (isMemoryMode()) {
    const s = getStore();
    let rows = s.materials
      .filter((m) => !isDemoMaterial(m))
      .map((m) => {
        const e = s.exams.find((x) => x.id === m.exam_id);
        return { ...m, exam_name: e?.name };
      });
    if (type) rows = rows.filter((r) => r.type === type);
    if (subject) rows = rows.filter((r) => (r.subject || '').toLowerCase() === subject.toLowerCase());
    return rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
  let sql = `SELECT m.*, e.name AS exam_name FROM materials m LEFT JOIN exams e ON e.id = m.exam_id WHERE 1=1`;
  const params = [];
  if (type) {
    params.push(type);
    sql += ` AND m.type = $${params.length}`;
  }
  if (subject) {
    params.push(subject);
    sql += ` AND m.subject ILIKE $${params.length}`;
  }
  sql += ' ORDER BY m.created_at DESC';
  const { rows } = await query(sql, params);
  return rows.filter((m) => !isDemoMaterial(m));
}

export async function updateMaterial(id, payload = {}) {
  if (!id) throw new Error('Material id is required');
  const fields = [
    'exam_id',
    'title',
    'type',
    'subject',
    'topic',
    'description',
    'content_text',
    'file_url',
    'video_url',
    'duration_minutes',
    'is_published',
  ];

  if (isMemoryMode()) {
    const s = getStore();
    const row = s.materials.find((m) => m.id === id);
    if (!row) throw new Error('Material not found');
    if (payload.file_url !== undefined) payload.file_url = keepStoredUrl(payload.file_url, row.file_url);
    if (payload.video_url !== undefined) payload.video_url = keepStoredUrl(payload.video_url, row.video_url);
    for (const key of fields) {
      if (payload[key] !== undefined) row[key] = payload[key];
    }
    schedulePersist();
    const e = s.exams.find((x) => x.id === row.exam_id);
    return { ...row, exam_name: e?.name };
  }

  const current = (await query(`SELECT file_url, video_url FROM materials WHERE id = $1`, [id])).rows[0];
  if (!current) throw new Error('Material not found');
  if (payload.file_url !== undefined) payload.file_url = keepStoredUrl(payload.file_url, current.file_url);
  if (payload.video_url !== undefined) payload.video_url = keepStoredUrl(payload.video_url, current.video_url);

  const sets = [];
  const params = [];
  for (const key of fields) {
    if (payload[key] !== undefined) {
      params.push(payload[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) throw new Error('No fields to update');
  params.push(id);
  const { rows } = await query(
    `UPDATE materials SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  if (!rows.length) throw new Error('Material not found');
  return rows[0];
}

export async function deleteMaterial(id) {
  if (!id) throw new Error('Material id is required');
  if (isMemoryMode()) {
    const s = getStore();
    const idx = s.materials.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Material not found');
    const [removed] = s.materials.splice(idx, 1);
    await deleteStoredAsset(removed.file_url);
    await deleteStoredAsset(removed.video_url);
    schedulePersist();
    return removed;
  }
  const { rows } = await query(`DELETE FROM materials WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throw new Error('Material not found');
  await deleteStoredAsset(rows[0].file_url);
  await deleteStoredAsset(rows[0].video_url);
  return rows[0];
}

function unlinkQuestion(s, questionId) {
  s.mock_test_questions = (s.mock_test_questions || []).filter((x) => x.question_id !== questionId);
  s.practice_set_questions = (s.practice_set_questions || []).filter((x) => x.question_id !== questionId);
}

export async function deleteQuestion(id) {
  if (!id) throw new Error('Question id is required');
  if (isMemoryMode()) {
    const s = getStore();
    const idx = s.questions.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Question not found');
    const [removed] = s.questions.splice(idx, 1);
    unlinkQuestion(s, id);
    schedulePersist();
    return removed;
  }
  await query(`DELETE FROM mock_test_questions WHERE question_id = $1`, [id]);
  await query(`DELETE FROM practice_set_questions WHERE question_id = $1`, [id]);
  const { rows } = await query(`DELETE FROM questions WHERE id = $1 RETURNING *`, [id]);
  if (!rows.length) throw new Error('Question not found');
  return rows[0];
}

/** Remove demo/sample questions. Keeps unique admin/AI questions. */
export async function deleteSampleQuestions() {
  if (isMemoryMode()) {
    const s = getStore();
    const removed = (s.questions || []).filter(isDemoQuestion);
    for (const q of removed) unlinkQuestion(s, q.id);
    s.questions = (s.questions || []).filter((q) => !isDemoQuestion(q));
    schedulePersist();
    return { deleted: removed.length, deleted_samples: removed.length, deleted_duplicates: 0 };
  }
  const { rows } = await query(`SELECT id FROM questions WHERE source = 'sample'`);
  for (const row of rows) {
    await query(`DELETE FROM mock_test_questions WHERE question_id = $1`, [row.id]);
    await query(`DELETE FROM practice_set_questions WHERE question_id = $1`, [row.id]);
  }
  const result = await query(`DELETE FROM questions WHERE source = 'sample' RETURNING id`);
  return { deleted: result.rows.length, deleted_samples: result.rows.length, deleted_duplicates: 0 };
}

export async function deleteDemoMaterials() {
  if (isMemoryMode()) {
    const s = getStore();
    const before = (s.materials || []).length;
    s.materials = (s.materials || []).filter((m) => !isDemoMaterial(m));
    s.mock_tests = (s.mock_tests || []).filter((m) => {
      if (m.origin === 'admin') return true;
      return !DEMO_MOCK_TITLES.has(String(m.title || '').trim());
    });
    const keepMockIds = new Set((s.mock_tests || []).map((m) => m.id));
    s.mock_test_questions = (s.mock_test_questions || []).filter((x) => keepMockIds.has(x.mock_test_id));
    s.practice_sets = (s.practice_sets || []).filter((p) => !DEMO_PRACTICE_TITLES.has(String(p.title || '').trim()));
    const keepSetIds = new Set((s.practice_sets || []).map((p) => p.id));
    s.practice_set_questions = (s.practice_set_questions || []).filter((x) => keepSetIds.has(x.practice_set_id));
    schedulePersist();
    return { deleted: before - s.materials.length };
  }
  const { rows } = await query(`SELECT id, title FROM materials`);
  let deleted = 0;
  for (const m of rows) {
    if (!isDemoMaterial(m)) continue;
    await query(`DELETE FROM materials WHERE id = $1`, [m.id]);
    deleted += 1;
  }
  return { deleted };
}

export async function purgeUnwantedContent() {
  const questions = await deleteSampleQuestions();
  const materials = await deleteDemoMaterials();
  return {
    deleted_samples: questions.deleted_samples || questions.deleted || 0,
    deleted_duplicates: questions.deleted_duplicates || 0,
    deleted_materials: materials.deleted || 0,
  };
}

export async function questionStemExists(questionText, excludeId = null) {
  const key = normalizeStem(questionText);
  if (!key) return false;
  if (isMemoryMode()) {
    return getStore().questions.some(
      (q) => q.id !== excludeId && !isDemoQuestion(q) && normalizeStem(q.question_text) === key
    );
  }
  const { rows } = await query(`SELECT id, question_text FROM questions WHERE COALESCE(source, '') <> 'sample'`);
  return rows.some((q) => q.id !== excludeId && normalizeStem(q.question_text) === key);
}

export async function listSchedules() {
  if (isMemoryMode()) {
    ensureScheduleCollections();
    const s = getStore();
    return s.exam_schedules
      .slice()
      .sort((a, b) => (a.publish_at || '').localeCompare(b.publish_at || ''))
      .map((sch) => {
        const e = s.exams.find((x) => x.id === sch.exam_id);
        return { ...sch, exam_name: e?.name };
      });
  }
  const { rows } = await query(
    `SELECT es.*, e.name AS exam_name FROM exam_schedules es
     LEFT JOIN exams e ON e.id = es.exam_id
     ORDER BY es.publish_at ASC`
  );
  return rows;
}

/**
 * pattern_sections: [{ subject, question_type, percentage, topic? }]
 * percentages should sum to ~100
 */
export async function createSchedule(payload) {
  const {
    exam_id,
    title,
    question_type = 'mcq',
    duration_minutes = 90,
    total_questions = 100,
    negative_marking = 0.25,
    publish_at,
    pattern_sections = [],
    notebook_direction = '',
    material_ids = [],
  } = payload || {};

  if (!String(exam_id || '').trim()) throw new Error('Please select an exam');
  if (!String(title || '').trim()) throw new Error('Exam title is required');
  if (!publish_at) throw new Error('Publish date and time are required');

  const publishDate = new Date(publish_at);
  if (Number.isNaN(publishDate.getTime())) {
    throw new Error('Invalid publish date/time. Pick a valid date and time.');
  }
  if (publishDate.getTime() <= Date.now()) {
    throw new Error('Cannot schedule an exam in the past. Pick a future date and time.');
  }

  const locked = await blueprintForExamId(exam_id);
  const parsed = validatePatternSections(
    pattern_sections?.length ? pattern_sections : locked?.sections || [],
    total_questions
  );
  if (!parsed.ok) throw new Error(parsed.error);
  const sections = parsed.sections;

  const row = {
    id: randomUUID(),
    exam_id,
    title: String(title).trim(),
    question_type,
    duration_minutes: locked?.duration_locked ? locked.duration_minutes : Number(duration_minutes) || 90,
    total_questions: parsed.total_questions,
    negative_marking:
      locked?.negative_marking != null ? locked.negative_marking : Number(negative_marking) || NEGATIVE_ONE_THIRD,
    publish_at: publishDate.toISOString(),
    pattern_sections: sections,
    notebook_direction: notebook_direction || locked?.ai_direction || '',
    material_ids: [...new Set([...(Array.isArray(material_ids) ? material_ids : []), ...(await listMaterialIdsForExam(exam_id))])],
    status: 'scheduled',
    mock_test_id: null,
    created_at: nowIso(),
    published_at: null,
    error_message: null,
  };

  if (isMemoryMode()) {
    ensureScheduleCollections();
    const s = getStore();
    s.exam_schedules.push(row);
    schedulePersist();
    const exam = s.exams.find((e) => e.id === exam_id);
    return { ...row, exam_name: exam?.name };
  }

  const { rows } = await query(
    `INSERT INTO exam_schedules
      (exam_id, title, question_type, duration_minutes, total_questions, negative_marking,
       publish_at, pattern_sections, notebook_direction, material_ids, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled') RETURNING *`,
    [
      exam_id,
      row.title,
      question_type,
      row.duration_minutes,
      row.total_questions,
      row.negative_marking,
      row.publish_at,
      JSON.stringify(sections),
      notebook_direction || '',
      JSON.stringify(row.material_ids),
    ]
  );
  return rows[0];
}

export async function createNotebookJob({
  direction,
  exam_id,
  subject,
  topic,
  material_ids = [],
  content_text = '',
  total_questions = 20,
  duration_minutes = 60,
  publish = true,
  is_live = true,
  title,
  schedule_id = null,
  pattern_sections = null,
  negative_marking = 0.25,
}) {
  const job = {
    id: randomUUID(),
    direction,
    exam_id,
    subject,
    topic: topic || null,
    material_ids,
    content_text: content_text || '',
    total_questions,
    publish,
    status: 'queued',
    result_summary: null,
    created_at: nowIso(),
    completed_at: null,
  };

  if (isMemoryMode()) {
    ensureScheduleCollections();
    getStore().notebook_jobs.push(job);
    schedulePersist();
  } else {
    await query(
      `INSERT INTO notebook_jobs
        (id, exam_id, schedule_id, direction, subject, topic, material_ids, content_text,
         total_questions, duration_minutes, publish, is_live, title, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,'queued', NOW())`,
      [
        job.id,
        exam_id || null,
        schedule_id,
        direction || null,
        subject || null,
        topic || null,
        JSON.stringify(material_ids || []),
        content_text || '',
        total_questions,
        duration_minutes,
        Boolean(publish),
        Boolean(is_live),
        title || null,
      ]
    );
  }

  try {
    job.status = 'running';
    if (!isMemoryMode()) {
      await query(`UPDATE notebook_jobs SET status = 'running' WHERE id = $1`, [job.id]);
    }
    const locked = await blueprintForExamId(exam_id);
    const parsed = pattern_sections?.length
      ? validatePatternSections(pattern_sections, total_questions)
      : locked
        ? validatePatternSections(locked.sections, locked.total_questions)
        : { ok: true, sections: subject
          ? [{ subject, question_type: 'mcq', percentage: 100, marks: 0, topic: topic || '' }]
          : [{ subject: 'Mixed', question_type: 'mcq', percentage: 100, marks: 0, topic: '' }], total_questions: Number(total_questions) || 20 };
    if (!parsed.ok) throw new Error(parsed.error);

    const result = await generatePaperFromDirection({
      direction:
        direction ||
        locked?.ai_direction ||
        'Read the textbook matter carefully. Generate MCQs with answers and explanations only from that content.',
      exam_id,
      subject,
      topic,
      material_ids,
      content_text,
      total_questions: Math.min(Math.max(Number(parsed.total_questions) || 20, 5), 250),
      pattern_sections: parsed.sections,
      title: title || `Notebook Paper — ${subject || 'Mixed'} — ${new Date().toLocaleString()}`,
      duration_minutes: locked?.duration_locked ? locked.duration_minutes : Number(duration_minutes) || 60,
      negative_marking: locked?.negative_marking != null ? locked.negative_marking : Number(negative_marking) || 0.25,
      publish_now: Boolean(publish),
      is_live: Boolean(is_live),
    });
    job.status = 'completed';
    job.result_summary = publish
      ? `Published ${result.question_ids.length} Q&A from textbook to question bank + live mock`
      : `Created draft mock with ${result.question_ids.length} questions from textbook`;
    job.mock_test_id = result.mock_test_id;
    job.question_count = result.question_ids.length;
    job.completed_at = nowIso();
    if (!isMemoryMode()) {
      await query(
        `UPDATE notebook_jobs SET status = 'completed', result_summary = $1, mock_test_id = $2,
         question_count = $3, completed_at = NOW() WHERE id = $4`,
        [job.result_summary, job.mock_test_id, job.question_count, job.id]
      );
    } else {
      schedulePersist();
    }
    return { job, ...result };
  } catch (err) {
    job.status = 'failed';
    job.result_summary = err.message;
    job.completed_at = nowIso();
    if (!isMemoryMode()) {
      await query(
        `UPDATE notebook_jobs SET status = 'failed', result_summary = $1, completed_at = NOW() WHERE id = $2`,
        [job.result_summary, job.id]
      );
    } else {
      schedulePersist();
    }
    throw err;
  }
}

export async function listNotebookJobs() {
  if (isMemoryMode()) {
    ensureScheduleCollections();
    return getStore().notebook_jobs.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { rows } = await query(`SELECT * FROM notebook_jobs ORDER BY created_at DESC LIMIT 100`);
  return rows;
}

async function listMaterialIdsForExam(exam_id) {
  if (!exam_id) return [];
  if (isMemoryMode()) {
    return (getStore().materials || [])
      .filter((m) => m.exam_id === exam_id && m.type !== 'video' && m.is_published !== false)
      .map((m) => m.id);
  }
  const { rows } = await query(
    `SELECT id FROM materials
     WHERE exam_id = $1 AND COALESCE(is_published, TRUE) = TRUE AND type <> 'video'`,
    [exam_id]
  );
  return rows.map((r) => r.id);
}

async function collectTextbookMatter(material_ids = [], extraText = '') {
  const parts = [];
  if (extraText?.trim()) parts.push(extraText.trim());

  if (isMemoryMode()) {
    const s = getStore();
    for (const id of material_ids) {
      const m = s.materials.find((x) => x.id === id);
      if (!m) continue;
      const header = `[${m.type}] ${m.title} (${m.subject || ''}/${m.topic || ''})`;
      const body = [m.content_text, m.description].filter((x) => x && String(x).trim()).join('\n');
      if (body) parts.push(`${header}\n${body}`);
      else parts.push(`${header}\n(No chapter text saved — add textbook matter in Content.)`);
      // Read plain .txt uploads if present
      if (m.file_url && /\.txt$/i.test(m.file_url)) {
        try {
          if (parseS3Key(m.file_url)) {
            const text = await readTextObject(m.file_url);
            if (text) parts.push(text);
          } else {
            const pathMod = await import('path');
            const fsMod = await import('fs');
            const { fileURLToPath } = await import('url');
            const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
            const fileName = m.file_url.split('/').pop();
            const full = pathMod.join(__dirname, '..', '..', 'uploads', 'docs', fileName);
            if (fsMod.existsSync(full)) {
              parts.push(fsMod.readFileSync(full, 'utf8').slice(0, 20000));
            }
          }
        } catch {
          // ignore file read errors
        }
      }
    }
  } else {
    for (const id of material_ids) {
      const { rows } = await query(`SELECT * FROM materials WHERE id = $1`, [id]);
      const m = rows[0];
      if (!m) continue;
      const header = `[${m.type}] ${m.title} (${m.subject || ''}/${m.topic || ''})`;
      const body = [m.content_text, m.description].filter((x) => x && String(x).trim()).join('\n');
      if (body) parts.push(`${header}\n${body}`);
      if (m.file_url && /\.txt$/i.test(m.file_url) && parseS3Key(m.file_url)) {
        try {
          const text = await readTextObject(m.file_url);
          if (text) parts.push(text);
        } catch {
          // ignore
        }
      }
    }
  }

  return parts.join('\n\n').trim();
}

function sectionsHaveSubjects(pattern_sections = [], subject) {
  if (subject?.trim()) return true;
  return Array.isArray(pattern_sections) && pattern_sections.some((s) => s?.subject);
}

async function generatePaperFromDirection({
  direction,
  exam_id,
  subject,
  topic,
  material_ids = [],
  content_text = '',
  total_questions = 100,
  pattern_sections = [],
  title,
  duration_minutes = 90,
  negative_marking = 0.25,
  publish_now = false,
  is_live = false,
}) {
  const s = isMemoryMode() ? getStore() : null;
  const examName = s
    ? s.exams.find((e) => e.id === exam_id)?.name
    : (await query(`SELECT name FROM exams WHERE id = $1`, [exam_id])).rows[0]?.name;

  const locked = await blueprintForExamId(exam_id);
  const noteIds = await listMaterialIdsForExam(exam_id);
  const allNoteIds = [...new Set([...(material_ids || []), ...noteIds])];
  const textbook_content = await collectTextbookMatter(allNoteIds, content_text);
  const noteHint = allNoteIds.length
    ? `Use the admin-uploaded notes/textbooks for this exam as the primary source. Still vary stems so each paper is unique.`
    : '';
  // Scheduled papers can generate from subject pattern alone (no textbook required)
  if (!textbook_content && !direction?.trim() && !sectionsHaveSubjects(pattern_sections, subject)) {
    throw new Error('Paste textbook matter, add a Notebook direction, or set subject pattern sections.');
  }

  const materialsContext = [];
  if (isMemoryMode()) {
    for (const id of allNoteIds) {
      const m = s.materials.find((x) => x.id === id);
      if (m) materialsContext.push(`${m.type}: ${m.title} (${m.subject}/${m.topic})`);
    }
  }

  const sections = pattern_sections.length
    ? pattern_sections
    : [{ subject: subject || 'General', question_type: 'mcq', percentage: 100, topic: topic || '' }];

  const allQuestionIds = [];
  const savedQuestions = [];

  for (const section of sections) {
    const count = questionsForSection(section, total_questions) * (locked?.pool_multiplier || 1);
    const syllabus = syllabusPrompt(examName, section.subject);
    const topicsHint = section.topic || '';
    const BATCH = 25;
    const generated = [];
    for (let offset = 0; offset < count; offset += BATCH) {
      const n = Math.min(BATCH, count - offset);
      const promptExtra = [
        direction || '',
        syllabus,
        noteHint,
        topicsHint ? `Focus topic: ${topicsHint}` : '',
        `Question type: ${section.question_type || 'mcq'}`,
        `This batch is questions ${offset + 1}–${offset + n} of ${count} for ${section.subject}. Do not repeat earlier stems.`,
        materialsContext.length ? `Selected materials:\n${materialsContext.join('\n')}` : '',
        textbook_content
          ? 'Generate question + answer key + explanation from the textbook/notes matter. You may rephrase, but facts must match the notes.'
          : 'Generate official-exam MCQs with answer key and short explanation.',
      ]
        .filter(Boolean)
        .join('\n');

      const batch = await generateQuestions({
        exam: examName,
        subject: section.subject,
        topic: section.topic || topic || section.subject,
        difficulty: 'medium',
        count: n,
        extra: promptExtra,
        textbook_content,
      });
      generated.push(...batch);
    }

    for (const q of generated) {
      if (await questionStemExists(q.question_text)) continue;
      if (savedQuestions.some((row) => normalizeStem(row.question_text) === normalizeStem(q.question_text))) continue;
      const source = textbook_content ? 'notebook' : q.source || 'ai';
      if (isMemoryMode()) {
        const row = {
          id: randomUUID(),
          exam_id,
          subject: q.subject || section.subject,
          topic: q.topic || section.topic || section.subject,
          chapter: q.topic || section.topic || section.subject,
          concept: q.topic || section.topic || section.subject,
          difficulty: q.difficulty || 'medium',
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          explanation: q.explanation,
          source,
          status: publish_now ? 'approved' : 'pending',
          created_at: nowIso(),
        };
        s.questions.push(row);
        allQuestionIds.push(row.id);
        savedQuestions.push(row);
      } else {
        const { rows } = await query(
          `INSERT INTO questions (exam_id, subject, topic, chapter, concept, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source, status)
           VALUES ($1,$2,$3,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [
            exam_id,
            q.subject || section.subject,
            q.topic || section.topic || section.subject,
            q.difficulty || 'medium',
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_option,
            q.explanation,
            source,
            publish_now ? 'approved' : 'pending',
          ]
        );
        allQuestionIds.push(rows[0].id);
        savedQuestions.push(rows[0]);
      }
    }
  }

  const studentTotal = locked?.total_questions || total_questions;
  const vary = Boolean(locked?.vary_per_student);
  const finalIds = vary ? allQuestionIds : allQuestionIds.slice(0, studentTotal);

  let mock;
  const duration = Number(duration_minutes) || 90;
  const liveNow = publish_now ? Boolean(is_live) : false;
  const windowStart = liveNow ? nowIso() : null;
  const windowEnd = liveNow ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
  const desc = vary
    ? `AI question bank for unique papers per student login (${finalIds.length} in pool; each student gets ${studentTotal}). Notes used: ${allNoteIds.length}.`
    : `Notebook LLM paper from textbook matter. Direction: ${direction || 'N/A'}. Materials: ${allNoteIds.length}`;

  if (isMemoryMode()) {
    mock = {
      id: randomUUID(),
      exam_id,
      title,
      description: desc,
      duration_minutes: duration,
      total_questions: studentTotal,
      negative_marking,
      vary_per_student: vary,
      is_live: liveNow,
      starts_at: windowStart,
      ends_at: windowEnd,
      is_published: publish_now,
      created_at: nowIso(),
    };
    s.mock_tests.push(mock);
    finalIds.forEach((qid, i) => {
      s.mock_test_questions.push({ mock_test_id: mock.id, question_id: qid, sort_order: i + 1 });
    });
    schedulePersist();
  } else {
    const { rows } = await query(
      `INSERT INTO mock_tests (exam_id, title, description, duration_minutes, total_questions, negative_marking, is_live, is_published, starts_at, ends_at, vary_per_student)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
         CASE WHEN $7 THEN NOW() ELSE NULL END,
         CASE WHEN $7 THEN NOW() + ($4 * INTERVAL '1 minute') ELSE NULL END,
         $9
       ) RETURNING *`,
      [
        exam_id,
        title,
        desc,
        duration,
        studentTotal,
        negative_marking,
        liveNow,
        publish_now,
        vary,
      ]
    );
    mock = rows[0];
    for (let i = 0; i < finalIds.length; i++) {
      await query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, sort_order) VALUES ($1,$2,$3)`,
        [mock.id, finalIds[i], i + 1]
      );
    }
  }

  if (liveNow && publish_now) {
    try {
      await notifyCbtPublished(mock);
    } catch (err) {
      console.error('[notify] CBT publish failed:', err.message);
    }
  }

  return { mock_test_id: mock.id, mock, question_ids: finalIds, questions: savedQuestions };
}

export async function processDueSchedules() {
  const now = Date.now();
  let due = [];

  if (isMemoryMode()) {
    ensureScheduleCollections();
    due = getStore().exam_schedules.filter((sch) => {
      if (sch.status !== 'scheduled') return false;
      const t = new Date(sch.publish_at).getTime();
      return Number.isFinite(t) && t <= now;
    });
  } else {
    const { rows } = await query(
      `SELECT * FROM exam_schedules WHERE status = 'scheduled' AND publish_at <= NOW()`
    );
    due = rows.map((r) => ({
      ...r,
      pattern_sections: typeof r.pattern_sections === 'string' ? JSON.parse(r.pattern_sections) : r.pattern_sections,
      material_ids: typeof r.material_ids === 'string' ? JSON.parse(r.material_ids) : r.material_ids,
    }));
  }

  const results = [];
  for (const sch of due) {
    try {
      if (isMemoryMode()) sch.status = 'generating';
      else await query(`UPDATE exam_schedules SET status = 'generating' WHERE id = $1`, [sch.id]);

      const result = await generatePaperFromDirection({
        direction: sch.notebook_direction,
        exam_id: sch.exam_id,
        material_ids: sch.material_ids || [],
        total_questions: sch.total_questions || 100,
        pattern_sections: sch.pattern_sections || [],
        title: sch.title,
        duration_minutes: sch.duration_minutes || 90,
        negative_marking: sch.negative_marking ?? 0.25,
        publish_now: true,
        is_live: true,
      });

      if (isMemoryMode()) {
        sch.status = 'published';
        sch.mock_test_id = result.mock_test_id;
        sch.published_at = nowIso();
        sch.error_message = null;
      } else {
        await query(
          `UPDATE exam_schedules SET status = 'published', mock_test_id = $1, published_at = NOW(), error_message = NULL WHERE id = $2`,
          [result.mock_test_id, sch.id]
        );
      }
      results.push({ id: sch.id, status: 'published', mock_test_id: result.mock_test_id });
    } catch (err) {
      if (isMemoryMode()) {
        sch.status = 'failed';
        sch.error_message = err.message;
      } else {
        await query(`UPDATE exam_schedules SET status = 'failed', error_message = $1 WHERE id = $2`, [
          err.message,
          sch.id,
        ]);
      }
      results.push({ id: sch.id, status: 'failed', error: err.message });
    }
  }
  return results;
}

export { DEFAULT_SUBJECTS };
