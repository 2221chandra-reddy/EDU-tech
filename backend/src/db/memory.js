import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { RAILWAY_LDCE_COMM, LDCE_COMM_SUBJECTS } from '../data/exam-blueprints.js';

const now = () => new Date().toISOString();

function createStore() {
  return {
    users: [],
    exams: [],
    courses: [],
    materials: [],
    bookmarks: [],
    watch_progress: [],
    enrollments: [],
    questions: [],
    practice_sets: [],
    practice_set_questions: [],
    practice_attempts: [],
    mock_tests: [],
    mock_test_questions: [],
    exam_attempts: [],
    certificates: [],
    ai_chat_sessions: [],
    ai_chat_messages: [],
    study_plans: [],
    contact_messages: [],
    subjects: [],
    exam_schedules: [],
    notebook_jobs: [],
    notifications: [],
    user_skills: [],
    diagnostic_attempts: [],
    mistakes: [],
    user_stats: [],
    plan_settings: [],
    payments: [],
    job_alerts: [],
  };
}

let store = createStore();
let persistEnabled = false;
let persistPath = '';
let persistTimer = null;
const PERSIST_DELAY_MS = 250;

export function resetMemoryStore() {
  store = createStore();
  schedulePersist();
}

export function getStore() {
  return store;
}

export function getDemoDbPath() {
  return persistPath;
}

export function isFilePersistEnabled() {
  return persistEnabled;
}

function ensurePersistDir() {
  if (!persistPath) return;
  const dir = path.dirname(persistPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function flushPersist() {
  if (!persistEnabled || !persistPath) return;
  try {
    ensurePersistDir();
    const tmp = `${persistPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, persistPath);
  } catch (err) {
    console.error('[db] Failed to persist demo DB:', err.message);
  }
}

export function schedulePersist() {
  if (!persistEnabled || !persistPath) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersist();
  }, PERSIST_DELAY_MS);
}

function loadStoreFromFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !Array.isArray(data.users)) {
    throw new Error('Invalid demo DB file format');
  }
  const base = createStore();
  store = { ...base, ...data };
  for (const key of Object.keys(base)) {
    if (!Array.isArray(store[key])) store[key] = [];
  }
  // Backfill learning fields on upgraded demo DBs
  for (const u of store.users) {
    if (u.daily_study_minutes == null) u.daily_study_minutes = 60;
    if (u.preferred_language == null) u.preferred_language = 'English';
    if (u.onboarding_done == null) u.onboarding_done = u.role === 'admin';
    if (u.diagnostic_done == null) u.diagnostic_done = u.role === 'admin';
    if (u.plan == null) u.plan = u.role === 'admin' ? 'premium' : 'free';
    if (u.previous_attempt == null) u.previous_attempt = false;
  }
  for (const q of store.questions) {
    if (!q.status) q.status = 'approved';
    if (!q.chapter) q.chapter = q.topic || null;
    if (!q.concept) q.concept = q.topic || null;
  }
  return true;
}

/**
 * Boot in-memory / file demo store.
 * @param {{ persist?: boolean, filePath?: string }} opts
 */
export async function bootDemoStore(opts = {}) {
  persistEnabled = Boolean(opts.persist);
  persistPath = opts.filePath || '';

  if (persistEnabled && persistPath && loadStoreFromFile(persistPath)) {
    return { loaded: true, path: persistPath };
  }

  await seedMemory();
  if (persistEnabled && persistPath) {
    flushPersist();
  }
  return { loaded: false, seeded: true, path: persistPath || null };
}

export async function seedMemory() {
  store = createStore();
  const adminHash = await bcrypt.hash('admin123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  const admin = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Admin User',
    email: 'admin@edugate.com',
    password_hash: adminHash,
    role: 'admin',
    target_exam: null,
    phone: null,
    avatar_url: null,
    exam_date: null,
    daily_study_minutes: 60,
    preferred_language: 'English',
    target_score: null,
    qualification: null,
    previous_attempt: false,
    onboarding_done: true,
    diagnostic_done: true,
    plan: 'premium',
    plan_status: 'active',
    plan_started_at: now(),
    plan_expires_at: new Date(Date.now() + 10 * 365 * 86400000).toISOString(),
    created_at: now(),
    updated_at: now(),
  };
  const student = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Hemanth Student',
    email: 'student@edugate.com',
    password_hash: studentHash,
    role: 'student',
    target_exam: 'RRB NTPC',
    phone: null,
    avatar_url: null,
    exam_date: null,
    daily_study_minutes: 60,
    preferred_language: 'English',
    target_score: 80,
    qualification: 'Graduate',
    previous_attempt: false,
    onboarding_done: false,
    diagnostic_done: false,
    plan: 'free',
    plan_status: 'active',
    plan_started_at: now(),
    plan_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: now(),
    updated_at: now(),
  };
  store.users.push(admin, student);

  const examDefs = [
    ['RRB NTPC', 'RRB_NTPC', 'Railway', 'Non-Technical Popular Categories.', 90, 100],
    ['RRB ALP', 'RRB_ALP', 'Railway', 'Assistant Loco Pilot.', 90, 75],
    ['RRB Group D', 'RRB_GROUP_D', 'Railway', 'Group D recruitment.', 90, 100],
    ['SSC CGL', 'SSC_CGL', 'SSC', 'Combined Graduate Level.', 60, 100],
    ['SSC CHSL', 'SSC_CHSL', 'SSC', 'Combined Higher Secondary Level.', 60, 100],
    ['SSC MTS', 'SSC_MTS', 'SSC', 'Multi Tasking Staff.', 90, 90],
    ['IBPS PO', 'IBPS_PO', 'Banking', 'IBPS Probationary Officer.', 60, 100],
    ['SBI PO', 'SBI_PO', 'Banking', 'SBI Probationary Officer.', 60, 100],
    ['UPSC CSE', 'UPSC_CSE', 'UPSC', 'Civil Services Examination.', 120, 100],
    ['APPSC', 'APPSC', 'State', 'Andhra Pradesh PSC.', 150, 150],
    ['TSPSC', 'TSPSC', 'State', 'Telangana PSC.', 150, 150],
    ['Police Recruitment', 'POLICE', 'Police', 'Police constable and SI.', 90, 100],
    ['DRDO', 'DRDO', 'Defence', 'DRDO recruitment.', 120, 100],
    ['ISRO', 'ISRO', 'Science', 'ISRO exams.', 120, 100],
    [
      RAILWAY_LDCE_COMM.name,
      RAILWAY_LDCE_COMM.code,
      RAILWAY_LDCE_COMM.category,
      RAILWAY_LDCE_COMM.description,
      RAILWAY_LDCE_COMM.duration_minutes,
      RAILWAY_LDCE_COMM.total_questions,
    ],
  ];

  for (const [name, code, category, description, duration, questions] of examDefs) {
    store.exams.push({
      id: randomUUID(),
      name,
      code,
      category,
      description,
      duration_minutes: duration,
      total_questions: questions,
      is_active: true,
      created_at: now(),
    });
  }

  for (const sub of LDCE_COMM_SUBJECTS) {
    store.subjects.push({
      id: randomUUID(),
      name: sub.name,
      code: sub.code,
      description: sub.description,
      origin: 'admin',
      created_at: now(),
    });
  }

  const rrb = store.exams.find((e) => e.code === 'RRB_NTPC');
  const ssc = store.exams.find((e) => e.code === 'SSC_CGL');
  const ibps = store.exams.find((e) => e.code === 'IBPS_PO');

  const course1 = {
    id: randomUUID(),
    exam_id: rrb.id,
    title: 'RRB NTPC Complete Course',
    slug: 'rrb-ntpc-complete',
    description: 'Full syllabus coverage for RRB NTPC with maths, reasoning, and GA.',
    thumbnail_url: null,
    level: 'Beginner',
    duration_hours: 120,
    is_published: true,
    created_at: now(),
  };
  const course2 = {
    id: randomUUID(),
    exam_id: ssc.id,
    title: 'SSC CGL Quant Mastery',
    slug: 'ssc-cgl-quant',
    description: 'Master quantitative aptitude for SSC CGL.',
    thumbnail_url: null,
    level: 'Intermediate',
    duration_hours: 80,
    is_published: true,
    created_at: now(),
  };
  const course3 = {
    id: randomUUID(),
    exam_id: ibps.id,
    title: 'Banking PO Foundation',
    slug: 'banking-po-foundation',
    description: 'IBPS & SBI PO foundation course.',
    thumbnail_url: null,
    level: 'Beginner',
    duration_hours: 100,
    is_published: true,
    created_at: now(),
  };
  store.courses.push(course1, course2, course3);

  // Demo books/videos are not seeded — admin uploads are the only materials.

  const sampleQs = [
    ['Mathematics', 'Percentage', 'easy', 'What is 25% of 480?', '100', '120', '140', '150', 'B', '25% of 480 = 120.'],
    ['Mathematics', 'Percentage', 'medium', 'A number is increased by 20% then decreased by 20%. Net change?', 'No change', '4% increase', '4% decrease', '2% decrease', 'C', 'Net 4% decrease.'],
    ['Reasoning', 'Blood Relations', 'easy', "Pointing to a man, a woman said, 'His mother is the only daughter of my mother.' Relation?", 'Mother', 'Sister', 'Aunt', 'Grandmother', 'A', 'She is his mother.'],
    ['Reasoning', 'Blood Relations', 'medium', "A is B's brother. C is A's mother. D is C's father. E is B's son. D related to E?", 'Grandfather', 'Great grandfather', 'Uncle', 'Father', 'B', 'D is great grandfather.'],
    ['Physics', "Ohm's Law", 'easy', "According to Ohm's Law, V = ?", 'I / R', 'I × R', 'I + R', 'I − R', 'B', 'V = I × R.'],
    ['Physics', "Ohm's Law", 'medium', 'Current 2A through 5Ω. Voltage?', '2.5 V', '7 V', '10 V', '0.4 V', 'C', 'V = 10 V.'],
    ['General Awareness', 'Current Affairs', 'easy', 'Who releases Monetary Policy in India?', 'SEBI', 'RBI', 'NITI Aayog', 'Finance Ministry', 'B', 'RBI.'],
    ['English', 'Synonyms', 'easy', 'Synonym of Abundant?', 'Scarce', 'Plentiful', 'Rare', 'Meagre', 'B', 'Plentiful.'],
    ['Mathematics', 'Profit and Loss', 'medium', 'Cost ₹800, sell ₹1000. Profit %?', '20%', '25%', '15%', '30%', 'B', '25%.'],
    ['Reasoning', 'Coding-Decoding', 'easy', 'If CAT=24, DOG=?', '26', '28', '30', '32', 'A', '4+15+7=26.'],
  ];

  const qIds = [];
  for (const q of sampleQs) {
    const id = randomUUID();
    qIds.push(id);
    store.questions.push({
      id,
      exam_id: rrb.id,
      subject: q[0],
      topic: q[1],
      chapter: q[1],
      concept: q[1],
      difficulty: q[2],
      question_text: q[3],
      option_a: q[4],
      option_b: q[5],
      option_c: q[6],
      option_d: q[7],
      correct_option: q[8],
      explanation: q[9],
      source: 'sample',
      status: 'approved',
      created_at: now(),
    });
  }

  const mockId = randomUUID();
  store.mock_tests.push({
    id: mockId,
    exam_id: rrb.id,
    title: 'RRB NTPC Full Mock Test 1',
    description: 'Realistic CBT mock based on latest pattern.',
    duration_minutes: 30,
    total_questions: qIds.length,
    negative_marking: 0.25,
    is_live: true,
    starts_at: null,
    ends_at: null,
    is_published: true,
    created_at: now(),
  });
  qIds.forEach((qid, i) => {
    store.mock_test_questions.push({ mock_test_id: mockId, question_id: qid, sort_order: i + 1 });
  });

  store.mock_tests.push({
    id: randomUUID(),
    exam_id: ssc.id,
    title: 'SSC CGL Tier-1 Practice Mock',
    description: 'Section-wise timed practice mock.',
    duration_minutes: 60,
    total_questions: 50,
    negative_marking: 0.25,
    is_live: false,
    starts_at: null,
    ends_at: null,
    is_published: true,
    created_at: now(),
  });

  const setId = randomUUID();
  store.practice_sets.push({
    id: setId,
    user_id: null,
    exam_id: rrb.id,
    title: 'Percentage Topic Drill',
    mode: 'topic',
    subject: 'Mathematics',
    topic: 'Percentage',
    difficulty: 'medium',
    question_count: qIds.length,
    time_limit_minutes: 15,
    is_public: true,
    created_at: now(),
  });
  qIds.forEach((qid, i) => {
    store.practice_set_questions.push({ practice_set_id: setId, question_id: qid, sort_order: i + 1 });
  });

  store.enrollments.push(
    { id: randomUUID(), user_id: student.id, course_id: course1.id, progress_percent: 35, enrolled_at: now() },
    { id: randomUUID(), user_id: student.id, course_id: course2.id, progress_percent: 10, enrolled_at: now() }
  );

  console.log('Memory store seeded.');
  console.log('Admin: admin@edugate.com / admin123');
  console.log('Student: student@edugate.com / student123');
}

/** Minimal SQL-ish query helper for memory mode — only patterns used by routes */
export async function memoryQuery(text, params = []) {
  const result = await memoryQueryInner(text, params);
  const sql = String(text);
  if (/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)) {
    schedulePersist();
  }
  return result;
}

async function memoryQueryInner(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  const s = store;

  // Health / generic helpers handled in routes via getStore for complex cases
  // This adapter covers the main query patterns.

  if (/SELECT \* FROM exams WHERE is_active/i.test(sql)) {
    return { rows: s.exams.filter((e) => e.is_active).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)) };
  }

  if (/FROM courses c LEFT JOIN exams/i.test(sql) && /WHERE c\.is_published/i.test(sql) && !/slug/i.test(sql)) {
    let rows = s.courses.filter((c) => c.is_published).map((c) => {
      const e = s.exams.find((x) => x.id === c.exam_id);
      return { ...c, exam_name: e?.name, exam_code: e?.code };
    });
    if (params[0] && sql.includes('e.code')) {
      const exam = params[0];
      rows = rows.filter((r) => r.exam_code === exam || (r.exam_name || '').toLowerCase().includes(String(exam).toLowerCase()));
    }
    if (params.length && sql.includes('title ILIKE')) {
      const q = String(params[params.length - 1]).replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    return { rows };
  }

  if (/FROM courses c[\s\S]*WHERE c\.slug/i.test(sql)) {
    const c = s.courses.find((x) => x.slug === params[0]);
    if (!c) return { rows: [] };
    const e = s.exams.find((x) => x.id === c.exam_id);
    return { rows: [{ ...c, exam_name: e?.name }] };
  }

  if (/FROM materials WHERE course_id/i.test(sql)) {
    return { rows: s.materials.filter((m) => m.course_id === params[0] && m.is_published) };
  }

  if (/INSERT INTO enrollments/i.test(sql)) {
    const exists = s.enrollments.find((e) => e.user_id === params[0] && e.course_id === params[1]);
    if (exists) return { rows: [] };
    const row = { id: randomUUID(), user_id: params[0], course_id: params[1], progress_percent: 0, enrolled_at: now() };
    s.enrollments.push(row);
    return { rows: [row] };
  }

  if (/FROM materials m/i.test(sql) && /is_published = TRUE/i.test(sql)) {
    let rows = s.materials.filter((m) => m.is_published && m.origin !== 'system').filter((m) => {
      if (m.origin === 'admin') return true;
      const demoTitles = new Set([
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
      return !demoTitles.has(String(m.title || '').trim());
    }).map((m) => {
      const e = s.exams.find((x) => x.id === m.exam_id);
      const c = s.courses.find((x) => x.id === m.course_id);
      return { ...m, exam_name: e?.name, course_title: c?.title };
    });
    let i = 0;
    if (sql.includes('m.type =')) {
      rows = rows.filter((r) => r.type === params[i++]);
    }
    if (sql.includes('e.code =')) {
      const exam = params[i++];
      rows = rows.filter((r) => {
        const e = s.exams.find((x) => x.id === r.exam_id);
        return e && (e.code === exam || e.name.toLowerCase().includes(String(exam).toLowerCase()));
      });
    }
    if (sql.includes('m.subject ILIKE')) {
      const sub = String(params[i++]).toLowerCase();
      rows = rows.filter((r) => (r.subject || '').toLowerCase().includes(sub.replace(/%/g, '')));
    }
    if (sql.includes('m.title ILIKE')) {
      const q = String(params[i++]).replace(/%/g, '').toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    return { rows };
  }

  if (/SELECT \* FROM materials WHERE id/i.test(sql)) {
    return { rows: s.materials.filter((m) => m.id === params[0]) };
  }

  if (/INSERT INTO contact_messages/i.test(sql)) {
    s.contact_messages.push({ id: randomUUID(), name: params[0], email: params[1], subject: params[2], message: params[3], created_at: now() });
    return { rows: [] };
  }

  if (/INSERT INTO users/i.test(sql) && /RETURNING/i.test(sql)) {
    const row = {
      id: randomUUID(),
      name: params[0],
      email: params[1],
      password_hash: params[2],
      role: 'student',
      target_exam: params[3],
      phone: params[4],
      avatar_url: null,
      exam_date: null,
      daily_study_minutes: 60,
      preferred_language: 'English',
      target_score: null,
      qualification: null,
      previous_attempt: false,
      onboarding_done: false,
      diagnostic_done: false,
      plan: 'free',
      plan_status: 'active',
      plan_started_at: now(),
      plan_expires_at: null,
      created_at: now(),
      updated_at: now(),
    };
    s.users.push(row);
    const { password_hash, ...safe } = row;
    return { rows: [safe] };
  }

  if (/^SELECT id FROM users WHERE email/i.test(sql)) {
    return { rows: s.users.filter((u) => u.email === params[0]).map((u) => ({ id: u.id })) };
  }

  if (/password_hash/i.test(sql) && /FROM users WHERE email/i.test(sql)) {
    return { rows: s.users.filter((u) => u.email === params[0]).map((u) => ({ ...u })) };
  }

  if (/FROM users WHERE id = \$1/i.test(sql) && /avatar_url/i.test(sql)) {
    const u = s.users.find((x) => x.id === params[0]);
    if (!u) return { rows: [] };
    const { password_hash, ...safe } = u;
    return { rows: [safe] };
  }

  if (/SELECT role,\s*target_exam FROM users WHERE id/i.test(sql) || /SELECT role, target_exam FROM users WHERE id/i.test(sql)) {
    const u = s.users.find((x) => x.id === params[0]);
    if (!u) return { rows: [] };
    return { rows: [{ role: u.role, target_exam: u.target_exam }] };
  }

  // Fallback: expose via tagged operations using comment prefixes if needed
  return memoryQueryFallback(sql, params);
}

async function memoryQueryFallback(sql, params) {
  const s = store;

  // Student overview queries
  if (/FROM enrollments en/i.test(sql)) {
    const rows = s.enrollments
      .filter((e) => e.user_id === params[0])
      .map((en) => {
        const c = s.courses.find((x) => x.id === en.course_id);
        const e = s.exams.find((x) => x.id === c?.exam_id);
        return { ...c, ...en, exam_name: e?.name };
      });
    return { rows };
  }

  if (/FROM bookmarks b/i.test(sql)) {
    const rows = s.bookmarks
      .filter((b) => b.user_id === params[0])
      .map((b) => {
        const m = s.materials.find((x) => x.id === b.material_id);
        return { ...b, title: m?.title, type: m?.type, subject: m?.subject };
      });
    return { rows };
  }

  if (/FROM watch_progress wp/i.test(sql)) {
    const rows = s.watch_progress
      .filter((w) => w.user_id === params[0])
      .map((w) => {
        const m = s.materials.find((x) => x.id === w.material_id);
        return { ...w, title: m?.title, type: m?.type, video_url: m?.video_url, duration_minutes: m?.duration_minutes };
      })
      .filter((w) => w.type === 'video');
    return { rows };
  }

  if (/FROM exam_attempts ea JOIN mock_tests mt/i.test(sql) && /WHERE ea\.id/i.test(sql)) {
    const a = s.exam_attempts.find((x) => x.id === params[0] && x.user_id === params[1]);
    if (!a) return { rows: [] };
    const mt = s.mock_tests.find((x) => x.id === a.mock_test_id);
    const e = s.exams.find((x) => x.id === mt?.exam_id);
    return {
      rows: [{
        ...a,
        negative_marking: mt?.negative_marking,
        total_questions: mt?.total_questions,
        title: mt?.title,
        exam_id: mt?.exam_id,
        test_title: mt?.title,
        exam_name: e?.name,
        exam_code: e?.code,
        duration_minutes: mt?.duration_minutes,
        is_live: mt?.is_live,
        vary_per_student: mt?.vary_per_student,
      }],
    };
  }

  if (/FROM exam_attempts ea/i.test(sql) && /JOIN mock_tests mt/i.test(sql) && /ea\.user_id/i.test(sql)) {
    let rows = s.exam_attempts
      .filter((a) => a.user_id === params[0])
      .map((a) => {
        const mt = s.mock_tests.find((x) => x.id === a.mock_test_id);
        const e = s.exams.find((x) => x.id === mt?.exam_id);
        return { ...a, test_title: mt?.title, exam_name: e?.name, duration_minutes: mt?.duration_minutes };
      });
    if (/status IN \('submitted', 'evaluated'\)/i.test(sql)) {
      rows = rows.filter((a) => a.status === 'submitted' || a.status === 'evaluated');
    }
    return { rows };
  }

  if (/FROM practice_attempts pa/i.test(sql)) {
    const rows = s.practice_attempts
      .filter((a) => a.user_id === params[0])
      .map((a) => {
        const ps = s.practice_sets.find((x) => x.id === a.practice_set_id);
        return { ...a, set_title: ps?.title };
      });
    return { rows };
  }

  if (/SELECT \* FROM certificates WHERE user_id/i.test(sql)) {
    return { rows: s.certificates.filter((c) => c.user_id === params[0]) };
  }

  if (/FROM mock_tests mt/i.test(sql) && /is_live = TRUE/i.test(sql)) {
    const rows = s.mock_tests
      .filter((m) => m.is_published && m.is_live)
      .map((mt) => {
        const e = s.exams.find((x) => x.id === mt.exam_id);
        return { ...mt, exam_name: e?.name, exam_code: e?.code };
      });
    return { rows };
  }

  if (/UPDATE users SET/i.test(sql)) {
    const u = s.users.find((x) => x.id === params[3]);
    if (!u) return { rows: [] };
    if (params[0] != null) u.name = params[0];
    if (params[1] != null) u.phone = params[1];
    if (params[2] != null) u.target_exam = params[2];
    u.updated_at = now();
    const { password_hash, ...safe } = u;
    return { rows: [safe] };
  }

  if (/INSERT INTO bookmarks/i.test(sql)) {
    const exists = s.bookmarks.find((b) => b.user_id === params[0] && b.material_id === params[1]);
    if (exists) return { rows: [] };
    const row = { id: randomUUID(), user_id: params[0], material_id: params[1], created_at: now() };
    s.bookmarks.push(row);
    return { rows: [row] };
  }

  if (/DELETE FROM bookmarks/i.test(sql)) {
    s.bookmarks = s.bookmarks.filter((b) => !(b.user_id === params[0] && b.material_id === params[1]));
    return { rows: [] };
  }

  if (/INSERT INTO watch_progress/i.test(sql)) {
    let row = s.watch_progress.find((w) => w.user_id === params[0] && w.material_id === params[1]);
    if (!row) {
      row = { id: randomUUID(), user_id: params[0], material_id: params[1], progress_percent: 0, last_position_seconds: 0, updated_at: now() };
      s.watch_progress.push(row);
    }
    row.progress_percent = params[2];
    row.last_position_seconds = params[3];
    row.updated_at = now();
    return { rows: [row] };
  }

  // AI sessions
  if (/SELECT \* FROM ai_chat_sessions WHERE user_id/i.test(sql)) {
    return { rows: s.ai_chat_sessions.filter((x) => x.user_id === params[0]).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
  }

  if (/INSERT INTO ai_chat_sessions/i.test(sql)) {
    const row = { id: randomUUID(), user_id: params[0], title: params[1] || 'New chat', created_at: now(), updated_at: now() };
    s.ai_chat_sessions.push(row);
    return { rows: [row] };
  }

  if (/SELECT id FROM ai_chat_sessions WHERE id/i.test(sql)) {
    return { rows: s.ai_chat_sessions.filter((x) => x.id === params[0] && x.user_id === params[1]).map((x) => ({ id: x.id })) };
  }

  if (/FROM ai_chat_messages WHERE session_id/i.test(sql) && /ORDER BY created_at ASC/i.test(sql)) {
    return { rows: s.ai_chat_messages.filter((m) => m.session_id === params[0]).sort((a, b) => a.created_at.localeCompare(b.created_at)) };
  }

  if (/INSERT INTO ai_chat_messages/i.test(sql)) {
    const actualRole = sql.match(/'(user|assistant)'/)?.[1] || params[1];
    const session_id = params[0];
    const actualContent = sql.match(/'(user|assistant)'/) ? params[1] : params[2];
    s.ai_chat_messages.push({
      id: randomUUID(),
      session_id,
      role: actualRole,
      content: actualContent,
      created_at: now(),
    });
    return { rows: [] };
  }

  if (/SELECT role, content FROM ai_chat_messages/i.test(sql)) {
    return {
      rows: s.ai_chat_messages
        .filter((m) => m.session_id === params[0])
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 12)
        .map((m) => ({ role: m.role, content: m.content })),
    };
  }

  if (/UPDATE ai_chat_sessions SET/i.test(sql)) {
    const sess = s.ai_chat_sessions.find((x) => x.id === params[0]);
    if (sess) {
      sess.updated_at = now();
      if (sess.title === 'New chat' && params[1]) sess.title = params[1];
    }
    return { rows: [] };
  }

  if (/SELECT id FROM exams WHERE code/i.test(sql)) {
    const q = String(params[0]).toLowerCase();
    const e = s.exams.find((x) => x.code === params[0] || x.name.toLowerCase().includes(q));
    return { rows: e ? [{ id: e.id }] : [] };
  }

  if (/INSERT INTO questions/i.test(sql) && /RETURNING/i.test(sql)) {
    const hasChapter = /chapter/i.test(sql);
    const sharedChapterConcept = /\$(\d+),\s*\$\1,\s*\$\1,/i.test(sql);
    let i = 0;
    const next = () => params[i++];
    const exam_id = next();
    const subject = next();
    let topic;
    let chapter;
    let concept;
    if (hasChapter && sharedChapterConcept) {
      topic = next();
      chapter = topic;
      concept = topic;
    } else if (hasChapter) {
      topic = next();
      chapter = next();
      concept = next();
    } else {
      topic = next();
      chapter = topic;
      concept = topic;
    }
    const difficulty = next();
    const question_text = next();
    const option_a = next();
    const option_b = next();
    const option_c = next();
    const option_d = next();
    const correct_option = next();
    const explanation = next();
    let source = next();
    if (sql.includes("'ai'")) source = source || 'ai';
    if (sql.includes("'notebook'")) source = source || 'notebook';
    if (source == null) source = 'manual';
    const statusLit = sql.match(/'(pending|approved|draft|rejected)'(?:\s*RETURNING|\s*\))/i);
    let status = statusLit ? statusLit[1] : null;
    if (!status && params[i] != null) status = next();
    if (!status) status = source === 'sample' ? 'approved' : 'pending';
    const row = {
      id: randomUUID(),
      exam_id,
      subject,
      topic,
      chapter: chapter || topic,
      concept: concept || topic,
      difficulty,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      source,
      status,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now(),
    };
    s.questions.push(row);
    return { rows: [row] };
  }

  if (/UPDATE questions SET/i.test(sql) && /status/i.test(sql)) {
    const q = s.questions.find((x) => x.id === params[params.length - 1]);
    if (!q) return { rows: [] };
    // PATCH /questions/:id uses: status, chapter, concept, topic, subject, reviewed_by, id
    if (params[0] != null) q.status = params[0];
    if (params[1] != null) q.chapter = params[1];
    if (params[2] != null) q.concept = params[2];
    if (params[3] != null) q.topic = params[3];
    if (params[4] != null) q.subject = params[4];
    if (params[0] != null) {
      q.reviewed_by = params[5];
      q.reviewed_at = now();
    }
    return { rows: [q] };
  }

  if (/UPDATE users SET plan/i.test(sql)) {
    const u = s.users.find((x) => x.id === params[1] && x.role === 'student');
    if (!u) return { rows: [] };
    u.plan = params[0];
    u.updated_at = now();
    const { password_hash, ...safe } = u;
    return { rows: [safe] };
  }

  if (/INSERT INTO practice_sets/i.test(sql) && /RETURNING/i.test(sql)) {
    const row = {
      id: randomUUID(),
      user_id: params[0],
      exam_id: params[1],
      title: params[2],
      mode: sql.includes("'ai_generated'") ? 'ai_generated' : params[3] || 'topic',
      subject: sql.includes("'ai_generated'") ? params[3] : params[4],
      topic: sql.includes("'ai_generated'") ? params[4] : params[5],
      difficulty: sql.includes("'ai_generated'") ? params[5] : params[6],
      question_count: sql.includes("'ai_generated'") ? params[6] : params[7],
      time_limit_minutes: sql.includes('time_limit') && !sql.includes("'ai_generated'") ? params[8] : null,
      is_public: sql.includes('TRUE') || false,
      created_at: now(),
    };
    // Fix for ai_generated insert pattern
    if (sql.includes("'ai_generated'")) {
      Object.assign(row, {
        user_id: params[0],
        exam_id: params[1],
        title: params[2],
        mode: 'ai_generated',
        subject: params[3],
        topic: params[4],
        difficulty: params[5],
        question_count: params[6],
        is_public: false,
      });
    }
    s.practice_sets.push(row);
    return { rows: [row] };
  }

  if (/INSERT INTO practice_set_questions/i.test(sql)) {
    s.practice_set_questions.push({ practice_set_id: params[0], question_id: params[1], sort_order: params[2] });
    return { rows: [] };
  }

  if (/FROM practice_sets ps/i.test(sql)) {
    let rows = s.practice_sets
      .filter((ps) => ps.is_public || ps.user_id == null)
      .map((ps) => {
        const e = s.exams.find((x) => x.id === ps.exam_id);
        return { ...ps, exam_name: e?.name };
      });
    return { rows };
  }

  if (/SELECT \* FROM practice_sets WHERE id/i.test(sql)) {
    return { rows: s.practice_sets.filter((p) => p.id === params[0]) };
  }

  if (/FROM practice_set_questions psq/i.test(sql) && /JOIN questions q/i.test(sql)) {
    const links = s.practice_set_questions
      .filter((x) => x.practice_set_id === params[0])
      .sort((a, b) => a.sort_order - b.sort_order);
    const rows = links.map((l) => {
      const q = s.questions.find((x) => x.id === l.question_id);
      if (!q) return null;
      if (/option_a, option_b, option_c, option_d\s+FROM/i.test(sql) || /q\.id, q\.subject/i.test(sql)) {
        if (sql.includes('correct_option') || sql.includes('q.*')) return q;
        const { correct_option, explanation, ...safe } = q;
        return safe;
      }
      return q;
    }).filter(Boolean);
    return { rows };
  }

  if (/FROM questions q LEFT JOIN exams/i.test(sql) && !/exam_name/i.test(sql)) {
    let rows = s.questions.filter((q) => !['sample', 'diagnostic'].includes(String(q.source || '')));
    if (/status/i.test(sql) && /approved/i.test(sql)) {
      rows = rows.filter((q) => (q.status || 'approved') === 'approved');
    }
    const limit = params[params.length - 1] || 20;
    rows = rows.slice(0, Math.min(Number(limit) || 20, 100)).map((q) => {
      const { correct_option, explanation, ...safe } = q;
      return safe;
    });
    return { rows };
  }

  if (/INSERT INTO practice_attempts/i.test(sql)) {
    const row = {
      id: randomUUID(),
      user_id: params[0],
      practice_set_id: params[1],
      score: params[2],
      total: params[3],
      accuracy: params[4],
      time_taken_seconds: params[5],
      answers: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
      analysis: typeof params[7] === 'string' ? JSON.parse(params[7]) : params[7],
      completed_at: now(),
    };
    s.practice_attempts.push(row);
    return { rows: [row] };
  }

  // CBT
  if (/FROM mock_tests mt LEFT JOIN exams/i.test(sql) || (/FROM mock_tests mt/i.test(sql) && /is_published/i.test(sql) && !/WHERE mt\.id/i.test(sql))) {
    let rows = s.mock_tests
      .filter((m) => m.is_published)
      .map((mt) => {
        const e = s.exams.find((x) => x.id === mt.exam_id);
        return { ...mt, exam_name: e?.name, exam_code: e?.code };
      });
    if (sql.includes('is_live = TRUE') && sql.includes('live')) {
      // handled by live filter in query string separately
    }
    return { rows };
  }

  if (/FROM mock_tests mt[\s\S]*WHERE mt\.id/i.test(sql) || /SELECT mt\.\*, e\.name AS exam_name FROM mock_tests mt/i.test(sql)) {
    const mt = s.mock_tests.find((x) => x.id === params[0]);
    if (!mt) return { rows: [] };
    const e = s.exams.find((x) => x.id === mt.exam_id);
    return { rows: [{ ...mt, exam_name: e?.name, exam_code: e?.code }] };
  }

  if (/SELECT \* FROM mock_tests WHERE id/i.test(sql)) {
    return { rows: s.mock_tests.filter((m) => m.id === params[0] && m.is_published) };
  }

  if (/COUNT\(\*\)::int AS count FROM mock_test_questions/i.test(sql)) {
    return { rows: [{ count: s.mock_test_questions.filter((x) => x.mock_test_id === params[0]).length }] };
  }

  if (/DISTINCT ON \(mock_test_id\)/i.test(sql) && /FROM exam_attempts/i.test(sql)) {
    const by = {};
    for (const a of s.exam_attempts.filter((x) => x.user_id === params[0])) {
      if (!by[a.mock_test_id] || String(a.started_at) > String(by[a.mock_test_id].started_at)) {
        by[a.mock_test_id] = a;
      }
    }
    return {
      rows: Object.values(by).map((a) => ({
        mock_test_id: a.mock_test_id,
        status: a.status,
        started_at: a.started_at,
      })),
    };
  }

  if (/FROM exam_attempts WHERE user_id/i.test(sql) && /mock_test_id/i.test(sql) && !/in_progress/i.test(sql)) {
    const rows = s.exam_attempts
      .filter((a) => a.user_id === params[0] && a.mock_test_id === params[1])
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    return { rows: rows.slice(0, 1) };
  }

  if (/FROM exam_attempts WHERE user_id/i.test(sql) && /in_progress/i.test(sql)) {
    const rows = s.exam_attempts
      .filter((a) => a.user_id === params[0] && a.mock_test_id === params[1] && a.status === 'in_progress')
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return { rows };
  }

  if (/INSERT INTO exam_attempts/i.test(sql)) {
    const row = {
      id: randomUUID(),
      user_id: params[0],
      mock_test_id: params[1],
      status: 'in_progress',
      answers: {},
      marked_for_review: [],
      visited: [],
      score: 0,
      total_marks: 0,
      correct_count: 0,
      wrong_count: 0,
      unattempted_count: 0,
      time_taken_seconds: 0,
      started_at: now(),
      submitted_at: null,
      analysis: null,
      autosave_at: null,
      timings: {},
      confidence: {},
      question_ids: [],
    };
    s.exam_attempts.push(row);
    return { rows: [row] };
  }

  if (/FROM mock_test_questions mtq/i.test(sql) && /JOIN questions q/i.test(sql)) {
    const links = s.mock_test_questions
      .filter((x) => x.mock_test_id === params[0])
      .sort((a, b) => a.sort_order - b.sort_order);
    const rows = links.map((l) => s.questions.find((q) => q.id === l.question_id)).filter(Boolean);
    if (!/correct_option|q\.\*/i.test(sql) && /option_d$/i.test(sql.replace(/\s+/g, ' '))) {
      return {
        rows: rows.map(({ correct_option, explanation, ...safe }) => safe),
      };
    }
    return { rows };
  }

  if (/UPDATE exam_attempts SET question_ids/i.test(sql)) {
    const a = s.exam_attempts.find((x) => x.id === params[1]);
    if (!a) return { rows: [] };
    a.question_ids = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
    return { rows: [a] };
  }

  if (/UPDATE exam_attempts SET/i.test(sql) && /autosave_at/i.test(sql)) {
    const idIdx = /timings = COALESCE/i.test(sql) ? 5 : 3;
    const userIdx = idIdx + 1;
    const a = s.exam_attempts.find(
      (x) => x.id === params[idIdx] && x.user_id === params[userIdx] && x.status === 'in_progress'
    );
    if (!a) return { rows: [] };
    if (params[0]) a.answers = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
    if (params[1]) a.marked_for_review = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
    if (params[2]) a.visited = typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2];
    if (idIdx === 5) {
      if (params[3]) a.timings = typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3];
      if (params[4]) a.confidence = typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4];
    }
    a.autosave_at = now();
    return { rows: [a] };
  }

  if (/UPDATE exam_attempts SET[\s\S]*status = 'evaluated'/i.test(sql) || (/UPDATE exam_attempts SET/i.test(sql) && /correct_count/i.test(sql))) {
    const idIdx = params.length >= 13 ? 12 : 10;
    const a = s.exam_attempts.find((x) => x.id === params[idIdx]);
    if (!a) return { rows: [] };
    a.status = 'evaluated';
    a.answers = typeof params[0] === 'string' ? JSON.parse(params[0]) : params[0];
    a.marked_for_review = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1];
    a.visited = typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2];
    a.score = params[3];
    a.total_marks = params[4];
    a.correct_count = params[5];
    a.wrong_count = params[6];
    a.unattempted_count = params[7];
    a.time_taken_seconds = params[8];
    a.analysis = typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9];
    if (params.length >= 13) {
      a.timings = typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10] || {};
      a.confidence = typeof params[11] === 'string' ? JSON.parse(params[11]) : params[11] || {};
    }
    a.submitted_at = now();
    return { rows: [a] };
  }

  if (/INSERT INTO certificates/i.test(sql)) {
    s.certificates.push({
      id: randomUUID(),
      user_id: params[0],
      course_id: null,
      mock_test_id: params[1],
      title: params[2],
      score: params[3],
      issued_at: now(),
      certificate_code: params[4],
    });
    return { rows: [] };
  }

  if (/INSERT INTO study_plans/i.test(sql)) {
    s.study_plans.push({
      id: randomUUID(),
      user_id: params[0],
      exam_id: params[1],
      plan: typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2],
      weak_topics: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
      strong_topics: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
      created_at: now(),
    });
    return { rows: [] };
  }

  if (/FROM exam_attempts WHERE id/i.test(sql) && /evaluated/i.test(sql)) {
    return { rows: s.exam_attempts.filter((a) => a.id === params[0] && a.user_id === params[1] && (a.status === 'submitted' || a.status === 'evaluated')) };
  }

  // Admin
  if (/COUNT\(\*\)::int AS count FROM users WHERE role = 'student'/i.test(sql)) {
    return { rows: [{ count: s.users.filter((u) => u.role === 'student').length }] };
  }
  if (/COUNT\(\*\)::int AS count FROM courses/i.test(sql)) return { rows: [{ count: s.courses.length }] };
  if (/COUNT\(\*\)::int AS count FROM questions/i.test(sql)) {
    const n = s.questions.filter((q) => String(q.source || '') !== 'sample').length;
    return { rows: [{ count: n }] };
  }
  if (/COUNT\(\*\)::int AS count FROM mock_tests/i.test(sql)) return { rows: [{ count: s.mock_tests.length }] };
  if (/COUNT\(\*\)::int AS count FROM exam_attempts WHERE status = 'evaluated'/i.test(sql)) {
    return { rows: [{ count: s.exam_attempts.filter((a) => a.status === 'evaluated').length }] };
  }
  if (/COUNT\(\*\)::int AS count FROM materials/i.test(sql)) return { rows: [{ count: s.materials.length }] };

  if (/FROM exam_attempts ea[\s\S]*JOIN users u/i.test(sql) && /evaluated/i.test(sql)) {
    const rows = s.exam_attempts
      .filter((a) => a.status === 'evaluated')
      .map((a) => {
        const u = s.users.find((x) => x.id === a.user_id);
        const mt = s.mock_tests.find((x) => x.id === a.mock_test_id);
        return { ...a, student_name: u?.name, email: u?.email, test_title: mt?.title };
      });
    return { rows };
  }

  if (/FROM users WHERE role = 'student'/i.test(sql)) {
    return {
      rows: s.users
        .filter((u) => u.role === 'student')
        .map(({ password_hash, ...safe }) => safe),
    };
  }

  if (/INSERT INTO courses/i.test(sql)) {
    const row = {
      id: randomUUID(),
      exam_id: params[0],
      title: params[1],
      slug: params[2],
      description: params[3],
      thumbnail_url: null,
      level: params[4],
      duration_hours: params[5],
      is_published: true,
      created_at: now(),
    };
    s.courses.push(row);
    return { rows: [row] };
  }

  if (/INSERT INTO materials/i.test(sql)) {
    const literalType = sql.match(/\$3,'(video|book|pdf|notes|previous_paper|mindmap|revision|current_affairs)'/)?.[1];
    const row = literalType
      ? {
          id: randomUUID(),
          course_id: params[0],
          exam_id: params[1],
          title: params[2],
          type: literalType,
          subject: params[3],
          topic: params[4],
          description: params[5],
          file_url: params[6],
          video_url: params[7],
          duration_minutes: params[8],
          content_text: null,
          is_published: true,
          created_at: now(),
        }
      : {
          id: randomUUID(),
          course_id: params[0],
          exam_id: params[1],
          title: params[2],
          type: params[3],
          subject: params[4],
          topic: params[5],
          description: params[6],
          file_url: params[7],
          video_url: params[8],
          duration_minutes: params[9],
          content_text: null,
          is_published: true,
          created_at: now(),
        };
    s.materials.push(row);
    return { rows: [row] };
  }

  if (/SELECT q\.\*, e\.name AS exam_name FROM questions q/i.test(sql)) {
    const rows = s.questions
      .filter((q) => !['sample', 'diagnostic'].includes(String(q.source || '')))
      .map((q) => {
        const e = s.exams.find((x) => x.id === q.exam_id);
        return { ...q, exam_name: e?.name };
      });
    return { rows };
  }

  if (/UPDATE mock_tests SET starts_at/i.test(sql)) {
    const m = s.mock_tests.find((x) => x.id === params[2]);
    if (!m) return { rows: [] };
    m.starts_at = params[0];
    m.ends_at = params[1];
    return { rows: [m] };
  }

  if (/INSERT INTO mock_tests/i.test(sql)) {
    const isLive = Boolean(params[6]);
    const duration = Number(params[3]) || 90;
    const start = isLive ? now() : null;
    const end = isLive ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
    const row = {
      id: randomUUID(),
      exam_id: params[0],
      title: params[1],
      description: params[2],
      duration_minutes: duration,
      total_questions: params[4],
      negative_marking: params[5],
      is_live: isLive,
      starts_at: start,
      ends_at: end,
      is_published: params[7] == null ? true : Boolean(params[7]),
      created_at: now(),
    };
    s.mock_tests.push(row);
    return { rows: [row] };
  }

  if (/INSERT INTO mock_test_questions/i.test(sql)) {
    s.mock_test_questions.push({ mock_test_id: params[0], question_id: params[1], sort_order: params[2] });
    return { rows: [] };
  }

  if (/GROUP BY e\.name/i.test(sql)) {
    const map = {};
    for (const a of s.exam_attempts.filter((x) => x.status === 'evaluated')) {
      const mt = s.mock_tests.find((x) => x.id === a.mock_test_id);
      const e = s.exams.find((x) => x.id === mt?.exam_id);
      const name = e?.name || 'Unknown';
      if (!map[name]) map[name] = { name, attempts: 0, total: 0 };
      map[name].attempts += 1;
      map[name].total += Number(a.score) || 0;
    }
    return {
      rows: Object.values(map).map((r) => ({
        name: r.name,
        attempts: r.attempts,
        avg_score: r.attempts ? Number((r.total / r.attempts).toFixed(2)) : 0,
      })),
    };
  }

  if (/GROUP BY source/i.test(sql)) {
    const map = {};
    for (const q of s.questions) {
      map[q.source] = (map[q.source] || 0) + 1;
    }
    return { rows: Object.entries(map).map(([source, count]) => ({ source, count })) };
  }

  console.warn('Unhandled memory SQL:', sql.slice(0, 120), params);
  return { rows: [] };
}
