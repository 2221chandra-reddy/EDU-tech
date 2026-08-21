import { randomUUID } from 'crypto';
import { getStore, schedulePersist } from '../db/memory.js';
import { isMemoryMode, query } from '../config/db.js';
import { generateQuestions, buildDiagnosticStudyPlan } from './ai.js';
import { getEntitlements } from './billing.js';

function nowIso() {
  return new Date().toISOString();
}

function masteryStatus(accuracy, avgSeconds) {
  if (accuracy >= 70 && avgSeconds <= 90) return 'strong';
  if (accuracy < 50) return avgSeconds && avgSeconds < 25 ? 'guessing' : 'weak';
  if (avgSeconds && avgSeconds > 90) return 'speed';
  return 'average';
}

/** Map guessing -> concept for skill status enum */
function skillStatusFrom(accuracy, avgSeconds) {
  const s = masteryStatus(accuracy, avgSeconds);
  if (s === 'guessing') return 'concept';
  return s;
}

export function classifyMistake({ correct, seconds, confidence } = {}) {
  if (correct) return null;
  const conf = String(confidence || '').toLowerCase();
  if (conf === 'wild' || conf === 'guess') return 'guessing';
  const t = Number(seconds) || 0;
  if (t > 0 && t < 20) return 'guessing';
  if (t > 90) return 'time_pressure';
  if (t > 45) return 'concept';
  return 'unknown';
}

export async function getUserProfile(userId) {
  if (isMemoryMode()) {
    const u = getStore().users.find((x) => x.id === userId);
    if (!u) return null;
    const { password_hash, ...safe } = u;
    return safe;
  }
  const { rows } = await query(
    `SELECT id, name, email, role, target_exam, phone, avatar_url,
            exam_date, daily_study_minutes, preferred_language, target_score,
            qualification, previous_attempt, onboarding_done, diagnostic_done, plan,
            plan_started_at, plan_expires_at, plan_status, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function updateUserLearningProfile(userId, body = {}) {
  const fields = [
    'name',
    'phone',
    'target_exam',
    'exam_date',
    'daily_study_minutes',
    'preferred_language',
    'target_score',
    'qualification',
    'previous_attempt',
    'onboarding_done',
    'diagnostic_done',
    'plan',
  ];

  if (isMemoryMode()) {
    const u = getStore().users.find((x) => x.id === userId);
    if (!u) throw new Error('User not found');
    for (const key of fields) {
      if (body[key] !== undefined) u[key] = body[key];
    }
    u.updated_at = nowIso();
    schedulePersist();
    const { password_hash, ...safe } = u;
    return safe;
  }

  const sets = [];
  const params = [];
  for (const key of fields) {
    if (body[key] !== undefined) {
      params.push(body[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (!sets.length) return getUserProfile(userId);
  params.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING id, name, email, role, target_exam, phone, avatar_url,
               exam_date, daily_study_minutes, preferred_language, target_score,
               qualification, previous_attempt, onboarding_done, diagnostic_done, plan, created_at`,
    params
  );
  return rows[0];
}

export async function upsertSkillsFromResults(userId, questionResults = []) {
  // questionResults: [{ subject, topic, correct, seconds }]
  const byKey = {};
  for (const r of questionResults) {
    const subject = r.subject || 'General';
    const topic = r.topic || 'Mixed';
    const key = `${subject}::${topic}`;
    if (!byKey[key]) byKey[key] = { subject, topic, correct: 0, total: 0, seconds: 0 };
    byKey[key].total += 1;
    if (r.correct) byKey[key].correct += 1;
    byKey[key].seconds += Number(r.seconds) || 45;
  }

  const updated = [];
  for (const row of Object.values(byKey)) {
    const accuracy = row.total ? Math.round((row.correct / row.total) * 100) : 0;
    const avg_seconds = row.total ? Math.round(row.seconds / row.total) : 0;
    const mastery = accuracy;
    const status = skillStatusFrom(accuracy, avg_seconds);

    if (isMemoryMode()) {
      const s = getStore();
      if (!s.user_skills) s.user_skills = [];
      let skill = s.user_skills.find(
        (x) => x.user_id === userId && x.subject === row.subject && x.topic === row.topic
      );
      if (!skill) {
        skill = {
          id: randomUUID(),
          user_id: userId,
          subject: row.subject,
          topic: row.topic,
          mastery: 0,
          accuracy: 0,
          avg_seconds: 0,
          attempts: 0,
          status: 'average',
          updated_at: nowIso(),
        };
        s.user_skills.push(skill);
      }
      const prevN = skill.attempts || 0;
      const nextN = prevN + row.total;
      skill.accuracy = nextN ? Math.round(((skill.accuracy * prevN) + accuracy * row.total) / nextN) : accuracy;
      skill.avg_seconds = nextN
        ? Math.round(((skill.avg_seconds * prevN) + avg_seconds * row.total) / nextN)
        : avg_seconds;
      skill.attempts = nextN;
      skill.mastery = skill.accuracy;
      skill.status = skillStatusFrom(skill.accuracy, skill.avg_seconds);
      skill.updated_at = nowIso();
      updated.push(skill);
    } else {
      const { rows } = await query(
        `INSERT INTO user_skills (user_id, subject, topic, mastery, accuracy, avg_seconds, attempts, status, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         ON CONFLICT (user_id, subject, topic) DO UPDATE SET
           attempts = user_skills.attempts + EXCLUDED.attempts,
           accuracy = ((user_skills.accuracy * user_skills.attempts) + (EXCLUDED.accuracy * EXCLUDED.attempts))
                      / NULLIF(user_skills.attempts + EXCLUDED.attempts, 0),
           avg_seconds = ((user_skills.avg_seconds * user_skills.attempts) + (EXCLUDED.avg_seconds * EXCLUDED.attempts))
                         / NULLIF(user_skills.attempts + EXCLUDED.attempts, 0),
           mastery = ((user_skills.accuracy * user_skills.attempts) + (EXCLUDED.accuracy * EXCLUDED.attempts))
                     / NULLIF(user_skills.attempts + EXCLUDED.attempts, 0),
           status = EXCLUDED.status,
           updated_at = NOW()
         RETURNING *`,
        [userId, row.subject, row.topic, mastery, accuracy, avg_seconds, row.total, status]
      );
      updated.push(rows[0]);
    }
  }
  if (isMemoryMode()) schedulePersist();
  return updated;
}

export async function listSkills(userId) {
  if (isMemoryMode()) {
    const s = getStore();
    return (s.user_skills || [])
      .filter((x) => x.user_id === userId)
      .slice()
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));
  }
  const { rows } = await query(
    `SELECT * FROM user_skills WHERE user_id = $1 ORDER BY subject, topic`,
    [userId]
  );
  return rows;
}

export async function recordMistakes(userId, items = []) {
  const saved = [];
  for (const m of items) {
    if (isMemoryMode()) {
      const s = getStore();
      if (!s.mistakes) s.mistakes = [];
      const row = {
        id: randomUUID(),
        user_id: userId,
        question_id: m.question_id,
        attempt_type: m.attempt_type || 'practice',
        attempt_id: m.attempt_id || null,
        mistake_type: m.mistake_type || 'unknown',
        student_answer: m.student_answer || null,
        correct_option: m.correct_option || null,
        subject: m.subject || null,
        topic: m.topic || null,
        resolved: false,
        created_at: nowIso(),
      };
      s.mistakes.push(row);
      saved.push(row);
    } else {
      const { rows } = await query(
        `INSERT INTO mistakes (user_id, question_id, attempt_type, attempt_id, mistake_type, student_answer, correct_option, subject, topic)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          userId,
          m.question_id,
          m.attempt_type || 'practice',
          m.attempt_id || null,
          m.mistake_type || 'unknown',
          m.student_answer || null,
          m.correct_option || null,
          m.subject || null,
          m.topic || null,
        ]
      );
      saved.push(rows[0]);
    }
  }
  if (isMemoryMode()) schedulePersist();
  return saved;
}

export async function listMistakes(userId, { unresolvedOnly = false } = {}) {
  if (isMemoryMode()) {
    const s = getStore();
    let rows = (s.mistakes || []).filter((m) => m.user_id === userId);
    if (unresolvedOnly) rows = rows.filter((m) => !m.resolved);
    return rows
      .slice()
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((m) => {
        const q = (s.questions || []).find((x) => x.id === m.question_id);
        return { ...m, question_text: q?.question_text || null };
      });
  }
  const { rows } = await query(
    unresolvedOnly
      ? `SELECT m.*, q.question_text FROM mistakes m LEFT JOIN questions q ON q.id = m.question_id
         WHERE m.user_id = $1 AND m.resolved = FALSE ORDER BY m.created_at DESC`
      : `SELECT m.*, q.question_text FROM mistakes m LEFT JOIN questions q ON q.id = m.question_id
         WHERE m.user_id = $1 ORDER BY m.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function resolveMistake(userId, mistakeId) {
  if (isMemoryMode()) {
    const row = (getStore().mistakes || []).find((m) => m.id === mistakeId && m.user_id === userId);
    if (!row) throw new Error('Mistake not found');
    row.resolved = true;
    schedulePersist();
    return row;
  }
  const { rows } = await query(
    `UPDATE mistakes SET resolved = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
    [mistakeId, userId]
  );
  if (!rows.length) throw new Error('Mistake not found');
  return rows[0];
}

export async function ensureUserStats(userId) {
  if (isMemoryMode()) {
    const s = getStore();
    if (!s.user_stats) s.user_stats = [];
    let st = s.user_stats.find((x) => x.user_id === userId);
    if (!st) {
      st = {
        user_id: userId,
        xp: 0,
        streak_days: 0,
        last_active_date: null,
        badges: [],
        ai_chat_count_today: 0,
        ai_chat_date: null,
        live_mocks_this_week: 0,
        live_mocks_week_start: null,
        updated_at: nowIso(),
      };
      s.user_stats.push(st);
      schedulePersist();
    }
    return st;
  }
  const existing = await query(`SELECT * FROM user_stats WHERE user_id = $1`, [userId]);
  if (existing.rows.length) return existing.rows[0];
  const { rows } = await query(
    `INSERT INTO user_stats (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  return rows[0];
}

export async function awardXp(userId, amount, { activity = 'practice' } = {}) {
  const st = await ensureUserStats(userId);
  const today = new Date().toISOString().slice(0, 10);
  let streak = st.streak_days || 0;
  const last = st.last_active_date ? String(st.last_active_date).slice(0, 10) : null;
  if (last !== today) {
    if (last) {
      const prev = new Date(last);
      const cur = new Date(today);
      const diff = Math.round((cur - prev) / 86400000);
      streak = diff === 1 ? streak + 1 : 1;
    } else {
      streak = 1;
    }
  }

  if (isMemoryMode()) {
    st.xp = (st.xp || 0) + amount;
    st.streak_days = streak;
    st.last_active_date = today;
    st.updated_at = nowIso();
    const badges = Array.isArray(st.badges) ? st.badges : [];
    if (st.xp >= 100 && !badges.includes('starter')) badges.push('starter');
    if (streak >= 3 && !badges.includes('streak3')) badges.push('streak3');
    if (activity === 'diagnostic' && !badges.includes('diagnostic')) badges.push('diagnostic');
    st.badges = badges;
    schedulePersist();
    return st;
  }

  const { rows } = await query(
    `UPDATE user_stats SET
       xp = xp + $2,
       streak_days = $3,
       last_active_date = $4::date,
       badges = CASE
         WHEN xp + $2 >= 100 AND NOT (badges ? 'starter') THEN badges || '"starter"'::jsonb
         ELSE badges END,
       updated_at = NOW()
     WHERE user_id = $1 RETURNING *`,
    [userId, amount, streak, today]
  );
  return rows[0];
}

export async function checkAiChatLimit(userId) {
  const entitlements = await getEntitlements(userId);
  if (entitlements.ai_unlimited) return { allowed: true, remaining: 999 };
  if (!entitlements.trial_active) {
    return { allowed: false, remaining: 0, count: 0, limit: 0, reason: 'expired' };
  }
  const st = await ensureUserStats(userId);
  const today = new Date().toISOString().slice(0, 10);
  const date = st.ai_chat_date ? String(st.ai_chat_date).slice(0, 10) : null;
  let count = st.ai_chat_count_today || 0;
  if (date !== today) count = 0;
  const limit = 20;
  return { allowed: count < limit, remaining: Math.max(0, limit - count), count, limit };
}

export async function bumpAiChatCount(userId) {
  const st = await ensureUserStats(userId);
  const today = new Date().toISOString().slice(0, 10);
  const date = st.ai_chat_date ? String(st.ai_chat_date).slice(0, 10) : null;
  if (isMemoryMode()) {
    if (date !== today) {
      st.ai_chat_count_today = 1;
      st.ai_chat_date = today;
    } else {
      st.ai_chat_count_today = (st.ai_chat_count_today || 0) + 1;
    }
    schedulePersist();
    return st;
  }
  await query(
    `UPDATE user_stats SET
       ai_chat_count_today = CASE WHEN ai_chat_date = $2::date THEN ai_chat_count_today + 1 ELSE 1 END,
       ai_chat_date = $2::date,
       updated_at = NOW()
     WHERE user_id = $1`,
    [userId, today]
  );
  return ensureUserStats(userId);
}

export async function checkLiveMockLimit(userId) {
  const entitlements = await getEntitlements(userId);
  if (entitlements.live_unlimited) return { allowed: true, remaining: 999 };
  if (!entitlements.trial_active) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return {
      allowed: false,
      remaining: 0,
      count: 0,
      limit: 0,
      reason: 'expired',
      weekStart: weekStart.toISOString().slice(0, 10),
    };
  }
  const st = await ensureUserStats(userId);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const ws = weekStart.toISOString().slice(0, 10);
  const stored = st.live_mocks_week_start ? String(st.live_mocks_week_start).slice(0, 10) : null;
  const count = stored === ws ? st.live_mocks_this_week || 0 : 0;
  const limit = 1;
  return { allowed: count < limit, remaining: Math.max(0, limit - count), count, limit, weekStart: ws };
}

export async function bumpLiveMockCount(userId) {
  const st = await ensureUserStats(userId);
  const check = await checkLiveMockLimit(userId);
  const ws = check.weekStart || new Date().toISOString().slice(0, 10);
  if (isMemoryMode()) {
    const stored = st.live_mocks_week_start ? String(st.live_mocks_week_start).slice(0, 10) : null;
    if (stored !== ws) {
      st.live_mocks_this_week = 1;
      st.live_mocks_week_start = ws;
    } else {
      st.live_mocks_this_week = (st.live_mocks_this_week || 0) + 1;
    }
    schedulePersist();
    return st;
  }
  await query(
    `UPDATE user_stats SET
       live_mocks_this_week = CASE WHEN live_mocks_week_start = $2::date THEN live_mocks_this_week + 1 ELSE 1 END,
       live_mocks_week_start = $2::date,
       updated_at = NOW()
     WHERE user_id = $1`,
    [userId, ws]
  );
  return ensureUserStats(userId);
}

async function approvedQuestions({ examName, subject, topic, difficulty, limit = 25 }) {
  if (isMemoryMode()) {
    const s = getStore();
    let rows = (s.questions || []).filter(
      (q) =>
        (q.status || 'approved') === 'approved' &&
        !['sample', 'diagnostic'].includes(String(q.source || ''))
    );
    if (examName) {
      const exam = s.exams.find(
        (e) =>
          e.name.toLowerCase() === String(examName).toLowerCase() ||
          e.code.toLowerCase().replace(/_/g, ' ') === String(examName).toLowerCase()
      );
      if (exam) rows = rows.filter((q) => !q.exam_id || q.exam_id === exam.id);
    }
    if (subject) rows = rows.filter((q) => String(q.subject).toLowerCase() === String(subject).toLowerCase());
    if (topic) rows = rows.filter((q) => String(q.topic || '').toLowerCase().includes(String(topic).toLowerCase()));
    if (difficulty) rows = rows.filter((q) => q.difficulty === difficulty);
    return rows.sort(() => Math.random() - 0.5).slice(0, limit);
  }
  const params = [];
  let sql = `SELECT q.* FROM questions q LEFT JOIN exams e ON e.id = q.exam_id
             WHERE COALESCE(q.status, 'approved') = 'approved'
               AND COALESCE(q.source, '') NOT IN ('sample', 'diagnostic')`;
  if (examName) {
    params.push(examName);
    sql += ` AND (e.name ILIKE $${params.length} OR e.code ILIKE $${params.length})`;
  }
  if (subject) {
    params.push(subject);
    sql += ` AND q.subject ILIKE $${params.length}`;
  }
  if (topic) {
    params.push(`%${topic}%`);
    sql += ` AND q.topic ILIKE $${params.length}`;
  }
  if (difficulty) {
    params.push(difficulty);
    sql += ` AND q.difficulty = $${params.length}`;
  }
  params.push(limit);
  sql += ` ORDER BY RANDOM() LIMIT $${params.length}`;
  const { rows } = await query(sql, params);
  return rows;
}

export async function startDiagnostic(userId) {
  const profile = await getUserProfile(userId);
  const examName = String(profile?.target_exam || '').trim();
  if (!examName) {
    throw new Error('Set your target CBT exam in onboarding/profile first. AI prepares the diagnostic for that exam.');
  }

  let examId = null;
  if (isMemoryMode()) {
    const e = getStore().exams.find(
      (x) =>
        x.name.toLowerCase() === examName.toLowerCase() ||
        x.code.toLowerCase().replace(/_/g, ' ') === examName.toLowerCase()
    );
    examId = e?.id || null;
  } else {
    const { rows } = await query(
      `SELECT id FROM exams WHERE name ILIKE $1 OR code ILIKE $1 LIMIT 1`,
      [examName]
    );
    examId = rows[0]?.id || null;
  }

  const sections = [
    { subject: 'Mathematics', topic: 'Arithmetic & Quant', count: 6 },
    { subject: 'Reasoning', topic: 'Logical & Puzzles', count: 6 },
    { subject: 'English', topic: 'Grammar & Vocab', count: 6 },
    { subject: 'General Awareness', topic: 'GK & Current Affairs', count: 6 },
  ];

  const batches = await Promise.all(
    sections.map((sec) =>
      generateQuestions({
        exam: examName,
        subject: sec.subject,
        topic: sec.topic,
        difficulty: 'medium',
        count: sec.count,
        extra: `Student diagnostic for ${examName} CBT. Cover typical official syllabus breadth for this exam. Mix easy and medium. Unique stems only.`,
      })
    )
  );

  const generated = batches.flat().filter((q) => q?.question_text && q.option_a);
  if (generated.length < 8) {
    throw new Error('AI could not prepare the diagnostic paper. Check AI keys and try again.');
  }

  const saved = [];
  for (const q of generated.slice(0, 24)) {
    const row = {
      id: randomUUID(),
      exam_id: examId,
      subject: q.subject || 'General',
      topic: q.topic || 'Mixed',
      chapter: q.topic || 'Mixed',
      concept: q.topic || 'Mixed',
      difficulty: q.difficulty || 'medium',
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: String(q.correct_option || 'A').toUpperCase().charAt(0),
      explanation: q.explanation || null,
      source: 'diagnostic',
      status: 'approved',
      created_at: nowIso(),
    };
    if (isMemoryMode()) {
      getStore().questions.push(row);
      saved.push(row);
    } else {
      const { rows } = await query(
        `INSERT INTO questions (id, exam_id, subject, topic, chapter, concept, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'diagnostic','approved') RETURNING *`,
        [
          row.id,
          examId,
          row.subject,
          row.topic,
          row.chapter,
          row.concept,
          row.difficulty,
          row.question_text,
          row.option_a,
          row.option_b,
          row.option_c,
          row.option_d,
          row.correct_option,
          row.explanation,
        ]
      );
      saved.push(rows[0] || row);
    }
  }
  if (isMemoryMode()) schedulePersist();

  return {
    exam: examName,
    conducted_by: 'ai',
    question_count: saved.length,
    questions: saved.map((q) => ({
      id: q.id,
      subject: q.subject,
      topic: q.topic,
      difficulty: q.difficulty,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
    })),
  };
}

export async function submitDiagnostic(userId, { answers = {}, question_ids = [], timings = {} } = {}) {
  let questions = [];
  if (isMemoryMode()) {
    questions = (getStore().questions || []).filter((q) => question_ids.includes(q.id));
  } else {
    const { rows } = await query(`SELECT * FROM questions WHERE id = ANY($1::uuid[])`, [question_ids]);
    questions = rows;
  }

  let score = 0;
  const results = [];
  const mistakeItems = [];
  for (const q of questions) {
    const ans = answers[q.id];
    const correct = ans && String(ans).toUpperCase() === String(q.correct_option).toUpperCase();
    if (correct) score += 1;
    const seconds = timings[q.id] || 40;
    results.push({ subject: q.subject, topic: q.topic || 'Mixed', correct: !!correct, seconds });
    if (!correct) {
      mistakeItems.push({
        question_id: q.id,
        attempt_type: 'diagnostic',
        mistake_type: classifyMistake({ correct: false, seconds }),
        student_answer: ans || null,
        correct_option: q.correct_option,
        subject: q.subject,
        topic: q.topic,
      });
    }
  }

  await upsertSkillsFromResults(userId, results);
  await recordMistakes(userId, mistakeItems);
  await updateUserLearningProfile(userId, { diagnostic_done: true });
  await awardXp(userId, 50, { activity: 'diagnostic' });

  const skills = await listSkills(userId);
  const profile = await getUserProfile(userId);
  let study_plan = null;
  try {
    study_plan = await buildDiagnosticStudyPlan({
      exam: profile?.target_exam,
      score,
      total: questions.length,
      skills,
      examDate: profile?.exam_date,
      dailyMinutes: profile?.daily_study_minutes || 60,
    });
  } catch {
    study_plan = null;
  }
  try {
    await buildDailyPlan(userId);
  } catch {
    /* plan still returned on diagnostic */
  }

  const attempt = {
    id: randomUUID(),
    user_id: userId,
    question_ids,
    answers,
    score,
    total: questions.length,
    analysis: {
      accuracy: questions.length ? Math.round((score / questions.length) * 100) : 0,
      skills,
      study_plan,
    },
    completed_at: nowIso(),
  };

  if (isMemoryMode()) {
    const s = getStore();
    if (!s.diagnostic_attempts) s.diagnostic_attempts = [];
    s.diagnostic_attempts.push(attempt);
    schedulePersist();
  } else {
    await query(
      `INSERT INTO diagnostic_attempts (id, user_id, question_ids, answers, score, total, analysis)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        attempt.id,
        userId,
        JSON.stringify(question_ids),
        JSON.stringify(answers),
        score,
        questions.length,
        JSON.stringify(attempt.analysis),
      ]
    );
  }

  return attempt;
}

export async function buildDailyPlan(userId) {
  const profile = await getUserProfile(userId);
  const skills = await listSkills(userId);
  const minutes = Number(profile?.daily_study_minutes) || 60;
  const weak = skills.filter((s) => s.status === 'weak' || s.status === 'concept' || s.accuracy < 50);
  const avg = skills.filter((s) => s.status === 'average' || s.status === 'speed');
  const focus = (weak.length ? weak : avg.length ? avg : skills).slice(0, 3);
  const revision_topics = focus.map((s) => `${s.subject} / ${s.topic}`);

  const plan = {
    for_date: new Date().toISOString().slice(0, 10),
    minutes,
    revision_topics,
    easy: 10,
    moderate: 10,
    hard: 5,
    steps: [
      '5-minute revision of weak topics',
      '10 easy questions',
      '10 moderate questions',
      '5 difficult questions',
      'Review mistakes in Mistake Book',
      'Optional mini mock if time remains',
    ],
    week: Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const topic = focus[i % Math.max(focus.length, 1)];
      return {
        day: d.toISOString().slice(0, 10),
        focus: topic ? `${topic.subject} — ${topic.topic}` : profile?.target_exam || 'Mixed',
        tasks: ['Revision', 'Adaptive practice', i % 3 === 2 ? 'Mini mock' : 'Mistake review'],
      };
    }),
  };

  if (isMemoryMode()) {
    const s = getStore();
    s.study_plans.push({
      id: randomUUID(),
      user_id: userId,
      exam_id: null,
      plan,
      weak_topics: revision_topics,
      strong_topics: skills.filter((x) => x.status === 'strong').map((x) => `${x.subject}/${x.topic}`),
      created_at: nowIso(),
    });
    schedulePersist();
  } else {
    await query(
      `INSERT INTO study_plans (user_id, plan, weak_topics, strong_topics) VALUES ($1,$2,$3,$4)`,
      [
        userId,
        JSON.stringify(plan),
        JSON.stringify(revision_topics),
        JSON.stringify(skills.filter((x) => x.status === 'strong').map((x) => `${x.subject}/${x.topic}`)),
      ]
    );
  }

  return plan;
}

export async function buildAdaptivePractice(userId) {
  const profile = await getUserProfile(userId);
  const skills = await listSkills(userId);
  const weak = skills.filter((s) => s.accuracy < 60 || s.status === 'weak' || s.status === 'concept');
  const focus = weak[0] || skills[0] || { subject: 'Mathematics', topic: 'Percentage' };

  let easy = await approvedQuestions({
    examName: profile?.target_exam,
    subject: focus.subject,
    topic: focus.topic,
    difficulty: 'easy',
    limit: 10,
  });
  let medium = await approvedQuestions({
    examName: profile?.target_exam,
    subject: focus.subject,
    topic: focus.topic,
    difficulty: 'medium',
    limit: 10,
  });
  let hard = await approvedQuestions({
    examName: profile?.target_exam,
    subject: focus.subject,
    topic: focus.topic,
    difficulty: 'hard',
    limit: 5,
  });

  if (easy.length + medium.length + hard.length < 10) {
    const generated = await generateQuestions({
      exam: profile?.target_exam || 'RRB NTPC',
      subject: focus.subject,
      topic: focus.topic,
      difficulty: 'medium',
      count: 15,
    });
    // persist generated as pending/approved private bank entries in memory
    if (isMemoryMode()) {
      const s = getStore();
      for (const g of generated) {
        const row = {
          id: randomUUID(),
          exam_id: null,
          ...g,
          chapter: focus.topic,
          concept: focus.topic,
          status: 'approved',
          created_at: nowIso(),
        };
        s.questions.push(row);
        if (medium.length < 10) medium.push(row);
        else easy.push(row);
      }
      schedulePersist();
    }
  }

  const picked = [...easy.slice(0, 10), ...medium.slice(0, 10), ...hard.slice(0, 5)];
  const setId = randomUUID();
  if (isMemoryMode()) {
    const s = getStore();
    s.practice_sets.push({
      id: setId,
      user_id: userId,
      exam_id: null,
      title: `Adaptive — ${focus.subject} / ${focus.topic}`,
      mode: 'daily',
      subject: focus.subject,
      topic: focus.topic,
      difficulty: 'mixed',
      question_count: picked.length,
      time_limit_minutes: 30,
      is_public: false,
      created_at: nowIso(),
    });
    picked.forEach((q, i) => {
      s.practice_set_questions.push({ practice_set_id: setId, question_id: q.id, sort_order: i + 1 });
    });
    schedulePersist();
  } else {
    await query(
      `INSERT INTO practice_sets (id, user_id, title, mode, subject, topic, question_count, time_limit_minutes, is_public)
       VALUES ($1,$2,$3,'daily',$4,$5,$6,30,FALSE)`,
      [setId, userId, `Adaptive — ${focus.subject} / ${focus.topic}`, focus.subject, focus.topic, picked.length]
    );
    for (let i = 0; i < picked.length; i++) {
      await query(
        `INSERT INTO practice_set_questions (practice_set_id, question_id, sort_order) VALUES ($1,$2,$3)`,
        [setId, picked[i].id, i + 1]
      );
    }
  }

  return {
    practice_set_id: setId,
    focus,
    question_count: picked.length,
    breakdown: { easy: Math.min(10, easy.length), moderate: Math.min(10, medium.length), hard: Math.min(5, hard.length) },
  };
}

export function enrichMockAnalysis(
  base,
  { questions = [], answers = {}, timings = {}, confidence = {}, negative = 0.25 } = {}
) {
  const analysis = { ...base };
  let timeWasted = 0;
  let lostMarks = 0;
  const byDifficulty = {};
  const TARGET_SEC = 30;
  const buckets = [
    { label: 'Q1-10', start: 0, end: 10, totalSec: 0, count: 0, wrong: 0 },
    { label: 'Q11-15', start: 10, end: 15, totalSec: 0, count: 0, wrong: 0 },
    { label: 'Q16-25', start: 15, end: 25, totalSec: 0, count: 0, wrong: 0 },
    { label: 'Q26+', start: 25, end: Infinity, totalSec: 0, count: 0, wrong: 0 },
  ];
  const timeSinks = [];
  const shield = {
    sure: { attempted: 0, correct: 0, wrong: 0, net: 0 },
    guess: { attempted: 0, correct: 0, wrong: 0, net: 0 },
    wild: { attempted: 0, correct: 0, wrong: 0, net: 0 },
  };
  const neg = Number(negative) || 0;

  questions.forEach((q, idx) => {
    const ans = answers[q.id];
    const correct = ans && String(ans).toUpperCase() === String(q.correct_option).toUpperCase();
    const sec = Number(timings[q.id]) || 0;
    const diff = q.difficulty || 'medium';
    if (!byDifficulty[diff]) byDifficulty[diff] = { correct: 0, total: 0 };
    byDifficulty[diff].total += 1;
    if (correct) byDifficulty[diff].correct += 1;
    else if (ans) {
      lostMarks += 1 + neg;
      if (sec > 60) {
        timeWasted += sec - 45;
        timeSinks.push({
          index: idx + 1,
          question_id: q.id,
          subject: q.subject,
          topic: q.topic,
          seconds: sec,
          result: 'WRONG',
          cost: Math.round((1 + neg) * 100) / 100,
        });
      }
    }

    const bucket = buckets.find((b) => idx >= b.start && idx < b.end);
    if (bucket && sec > 0) {
      bucket.totalSec += sec;
      bucket.count += 1;
      if (ans && !correct) bucket.wrong += 1;
    }

    if (ans) {
      let level = String(confidence[q.id] || '').toLowerCase();
      if (!level) {
        if (sec > 0 && sec < 20) level = 'wild';
        else if (sec > 90) level = 'guess';
        else level = 'sure';
      }
      if (!shield[level]) level = 'guess';
      const bucketShield = shield[level];
      bucketShield.attempted += 1;
      if (correct) {
        bucketShield.correct += 1;
        bucketShield.net += 1;
      } else {
        bucketShield.wrong += 1;
        bucketShield.net -= neg;
      }
    }
  });

  analysis.difficulty_breakdown = Object.entries(byDifficulty).map(([difficulty, s]) => ({
    difficulty,
    accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
    correct: s.correct,
    total: s.total,
  }));
  analysis.lost_marks_estimate = Math.round(lostMarks * 10) / 10;
  analysis.time_wasted_seconds = Math.round(timeWasted);
  analysis.coaching_summary = `Lost ~${analysis.lost_marks_estimate} marks; ~${Math.round(timeWasted / 60)} min may have been reclaimable with better selection.`;

  const timeLeakBuckets = buckets
    .filter((b) => b.count > 0)
    .map((b) => {
      const avg = Math.round(b.totalSec / b.count);
      let verdict = 'SAFE & ACCURATE';
      if (avg >= TARGET_SEC * 2) verdict = 'TIME TRAP';
      else if (avg < TARGET_SEC * 0.7 && b.wrong > 0) verdict = 'RUSHED & CARELESS';
      else if (avg > TARGET_SEC * 1.3) verdict = 'SLOW ZONE';
      return {
        label: b.label,
        avg_seconds: avg,
        count: b.count,
        wrong: b.wrong,
        verdict,
        bar: Math.min(100, Math.round((avg / (TARGET_SEC * 3)) * 100)),
      };
    });

  const skipAdvice =
    timeSinks.length > 0
      ? `If you skipped ${timeSinks
          .slice(0, 2)
          .map((t) => `Q${t.index}`)
          .join(' and ')} after ${TARGET_SEC + 15}s, you could reclaim time for easier questions.`
      : 'Keep enforcing a hard skip after ~45s on stuck questions.';

  analysis.time_leak = {
    target_seconds: TARGET_SEC,
    buckets: timeLeakBuckets,
    time_sinks: timeSinks.slice(0, 8),
    advice: skipAdvice,
  };

  const round2 = (n) => Math.round(n * 100) / 100;
  analysis.negative_marking_shield = {
    sure: { ...shield.sure, net: round2(shield.sure.net) },
    guess: { ...shield.guess, net: round2(shield.guess.net) },
    wild: { ...shield.wild, net: round2(shield.wild.net) },
    negative_penalty: round2(shield.sure.wrong * neg + shield.guess.wrong * neg + shield.wild.wrong * neg),
    recommendation:
      shield.wild.wrong >= 3
        ? 'Stop attempting wild guesses — skip when confidence is low.'
        : shield.guess.wrong > shield.guess.correct
          ? 'Tighten skip strategy on educated guesses in weak sections.'
          : 'Confidence calibration looks healthy — keep Sure attempts high-quality.',
  };

  return analysis;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

async function recentEvaluatedAttempts(userId, limit = 10) {
  const { rows } = await query(
    `SELECT ea.*, mt.title AS test_title, e.name AS exam_name
     FROM exam_attempts ea
     JOIN mock_tests mt ON mt.id = ea.mock_test_id
     LEFT JOIN exams e ON e.id = mt.exam_id
     WHERE ea.user_id = $1 AND ea.status IN ('submitted', 'evaluated')
     ORDER BY ea.submitted_at DESC`,
    [userId]
  );
  return rows
    .slice()
    .sort((a, b) => String(b.submitted_at || b.started_at || '').localeCompare(String(a.submitted_at || a.started_at || '')))
    .slice(0, limit)
    .map((row) => ({
      ...row,
      analysis: parseJsonField(row.analysis, {}),
      confidence: parseJsonField(row.confidence, {}),
      timings: parseJsonField(row.timings, {}),
    }));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export async function computeReadiness(userId) {
  const profile = await getUserProfile(userId);
  const skills = await listSkills(userId);
  const attempts = await recentEvaluatedAttempts(userId, 8);
  const target = Number(profile?.target_score) || 80;
  const totalScale = 100;

  const mockPercents = attempts
    .map((a) => {
      const total = Number(a.total_marks) || 0;
      if (!total) return null;
      return (Number(a.score) / total) * totalScale;
    })
    .filter((x) => x != null);

  const expectedScore =
    mockPercents.length > 0
      ? Math.round(mockPercents.reduce((s, x) => s + x, 0) / mockPercents.length)
      : skills.length
        ? Math.round(skills.reduce((s, x) => s + Number(x.accuracy || 0), 0) / skills.length)
        : Math.round(target * 0.7);

  const gap = Math.round(expectedScore - target);
  const skillAvg = skills.length
    ? skills.reduce((s, x) => s + Number(x.accuracy || 0), 0) / skills.length
    : expectedScore;

  let guessRisk = 'LOW';
  let timeTraps = 0;
  let carelessLoss = 0;
  let accuracyRate = Math.round(skillAvg);
  let speedRating = 70;
  let strategyScore = 70;

  for (const a of attempts.slice(0, 5)) {
    const analysis = a.analysis || {};
    const shield = analysis.negative_marking_shield;
    const leak = analysis.time_leak;
    if (shield) {
      const riskyWrong = (shield.wild?.wrong || 0) + (shield.guess?.wrong || 0);
      carelessLoss += Number(analysis.lost_marks_estimate) || 0;
      if (riskyWrong >= 5) guessRisk = 'HIGH';
      else if (riskyWrong >= 2 && guessRisk !== 'HIGH') guessRisk = 'MEDIUM';
    }
    if (leak?.buckets) {
      timeTraps += leak.buckets.filter((b) => String(b.verdict).includes('TIME TRAP')).length;
    }
    if (analysis.accuracy != null) accuracyRate = Math.round((accuracyRate + Number(analysis.accuracy)) / 2);
    if (analysis.time_management?.avg_seconds_per_question) {
      const avg = Number(analysis.time_management.avg_seconds_per_question);
      speedRating = clamp(Math.round(100 - Math.max(0, avg - 30) * 1.5), 20, 95);
    }
  }

  strategyScore = clamp(
    Math.round(100 - (guessRisk === 'HIGH' ? 25 : guessRisk === 'MEDIUM' ? 12 : 0) - timeTraps * 4),
    20,
    95
  );

  const behaviorPenalty =
    (guessRisk === 'HIGH' ? 8 : guessRisk === 'MEDIUM' ? 4 : 0) + Math.min(12, timeTraps * 2);
  const readiness = clamp(
    Math.round(expectedScore * 0.55 + skillAvg * 0.35 + strategyScore * 0.1 - behaviorPenalty),
    0,
    100
  );

  let status = 'DEVELOPING';
  if (readiness >= 85) status = 'EXAM READY';
  else if (readiness >= 70) status = 'ON TRACK';
  else if (readiness < 45) status = 'AT RISK';

  const bySubject = {};
  for (const s of skills) {
    const key = s.subject || 'General';
    if (!bySubject[key]) bySubject[key] = { total: 0, weight: 0, weak: 0 };
    bySubject[key].total += Number(s.accuracy || 0);
    bySubject[key].weight += 1;
    if (s.status === 'weak' || s.status === 'concept' || Number(s.accuracy) < 50) bySubject[key].weak += 1;
  }

  const sectional = Object.entries(bySubject).map(([subject, s]) => {
    const pct = Math.round(s.total / Math.max(s.weight, 1));
    const ptsLeft = Math.max(0, Math.round((100 - pct) / 10));
    return { subject, mastery: pct, pts_left: ptsLeft };
  });

  if (!sectional.length) {
    ['Mathematics', 'General Intelligence', 'General Science', 'General Awareness'].forEach((subject) => {
      sectional.push({ subject, mastery: Math.round(expectedScore * 0.9), pts_left: 5 });
    });
  }

  const daysLeft = profile?.exam_date
    ? Math.max(0, Math.ceil((new Date(profile.exam_date) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const critical = gap < -5 || guessRisk === 'HIGH' || timeTraps >= 3 || readiness < 70;

  return {
    readiness_percent: readiness,
    status,
    target_score: target,
    current_expected_score: expectedScore,
    gap_to_close: gap,
    days_left: daysLeft,
    target_exam: profile?.target_exam || null,
    critical_diagnosis: critical,
    sectional,
    behavioral: {
      accuracy_rate: accuracyRate,
      speed_rating: speedRating,
      strategy_score: strategyScore,
      guess_risk: guessRisk,
      time_traps: timeTraps,
      careless_loss: Math.round(carelessLoss * 10) / 10,
    },
    recent_scores: attempts.slice(0, 5).map((a) => ({
      title: a.test_title,
      score: Number(a.score),
      total: Number(a.total_marks),
      submitted_at: a.submitted_at,
    })),
    mission_hint: [
      '5-min revision on weakest section',
      '10 accuracy questions (avoid negative marking traps)',
      'Mistake-to-Mastery re-test',
    ],
  };
}

export async function whyNotImproving(userId) {
  const readiness = await computeReadiness(userId);
  const attempts = await recentEvaluatedAttempts(userId, 5);
  const mistakes = await listMistakes(userId, { unresolvedOnly: true });
  const skills = await listSkills(userId);

  const scores = attempts
    .map((a) => {
      const total = Number(a.total_marks) || 0;
      if (!total) return null;
      return Math.round((Number(a.score) / total) * 100);
    })
    .filter((x) => x != null)
    .reverse();

  let plateau = false;
  if (scores.length >= 3) {
    const spread = Math.max(...scores) - Math.min(...scores);
    plateau = spread <= 8;
  }

  let negLoss = 0;
  let wildWrong = 0;
  let guessWrong = 0;
  let timeTrapMinutes = 0;
  const trapSubjects = new Set();

  for (const a of attempts) {
    const analysis = a.analysis || {};
    const shield = analysis.negative_marking_shield;
    const leak = analysis.time_leak;
    if (shield) {
      wildWrong += shield.wild?.wrong || 0;
      guessWrong += shield.guess?.wrong || 0;
      negLoss += Number(shield.negative_penalty) || 0;
    } else {
      negLoss += Number(analysis.lost_marks_estimate) || 0;
    }
    if (leak?.time_sinks) {
      for (const sink of leak.time_sinks) {
        timeTrapMinutes += (Number(sink.seconds) || 0) / 60;
        if (sink.subject) trapSubjects.add(sink.subject);
      }
    }
  }

  const conceptCluster = {};
  for (const m of mistakes) {
    if (m.mistake_type === 'concept' || m.mistake_type === 'unknown' || !m.mistake_type) {
      const key = `${m.subject || 'General'} / ${m.topic || 'Mixed'}`;
      conceptCluster[key] = (conceptCluster[key] || 0) + 1;
    }
  }
  for (const s of skills.filter((x) => x.status === 'weak' || x.status === 'concept' || x.accuracy < 50)) {
    const key = `${s.subject} / ${s.topic}`;
    conceptCluster[key] = (conceptCluster[key] || 0) + 2;
  }
  const topConcepts = Object.entries(conceptCluster)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const causes = [];
  if (wildWrong + guessWrong > 0 || negLoss > 0) {
    const marks = Math.round(negLoss * 10) / 10 || Math.round((wildWrong + guessWrong) * 1.25 * 10) / 10;
    causes.push({
      id: 'negative_marking',
      title: 'Negative marking & wild guessing',
      marks_impact: -marks,
      detail: `You lost about ${marks} marks to low-confidence attempts (${wildWrong} wild + ${guessWrong} guess wrong). Skipping those would lift readiness.`,
    });
  }
  if (timeTrapMinutes > 0 || readiness.behavioral.time_traps > 0) {
    causes.push({
      id: 'time_traps',
      title: 'Time traps',
      marks_impact: -Math.min(15, Math.round(timeTrapMinutes * 2)),
      detail: `About ${Math.round(timeTrapMinutes)} minutes leaked on hard questions${
        trapSubjects.size ? ` in ${[...trapSubjects].join(', ')}` : ''
      }, forcing rushes elsewhere.`,
    });
  }
  if (topConcepts.length) {
    causes.push({
      id: 'concept_cluster',
      title: 'Unmastered concept cluster',
      marks_impact: -Math.min(12, topConcepts.length * 4),
      detail: `Repeated failures in: ${topConcepts.join(', ')}.`,
    });
  }
  if (!causes.length) {
    causes.push({
      id: 'baseline',
      title: 'Need more mock data',
      marks_impact: 0,
      detail: 'Complete 2–3 full mocks so EduGate can pinpoint guessing, time, and concept leaks.',
    });
  }

  const recovery_outline = [
    {
      day: 1,
      theme: 'CONCEPT DRILL',
      focus: topConcepts.slice(0, 2).join(' + ') || 'Weak topics',
      tasks: ['AI Tutor concept review', '15 targeted accuracy questions', 'Log remaining mistakes'],
    },
    {
      day: 2,
      theme: 'NEGATIVE MARKING SHIELD',
      focus: 'Skip strategy calibration',
      tasks: ['30 questions with Sure/Guess discipline', 'Skip any Wild urge', 'Review guess outcomes'],
    },
    {
      day: 3,
      theme: 'TIMED SPEED MINI-CBT',
      focus: trapSubjects.size ? [...trapSubjects].join(', ') : 'Full paper pace',
      tasks: ['20-min timed set', 'Hard skip after 45s', 'Recompute readiness'],
    },
  ];

  return {
    plateau_detected: plateau,
    recent_scores: scores,
    mock_labels: attempts
      .slice()
      .reverse()
      .map((a, i) => ({ label: `Mock ${i + 1}`, score: scores[i], title: a.test_title })),
    causes,
    recovery_outline,
    readiness,
  };
}

export async function buildRecoveryPlan(userId) {
  const diagnosis = await whyNotImproving(userId);
  const profile = await getUserProfile(userId);
  const plan = {
    type: 'recovery_3day',
    created_at: nowIso(),
    for_date: new Date().toISOString().slice(0, 10),
    target_exam: profile?.target_exam || null,
    days: diagnosis.recovery_outline,
    causes: diagnosis.causes,
    status: 'active',
    steps: diagnosis.recovery_outline.flatMap((d) =>
      d.tasks.map((t) => `Day ${d.day} (${d.theme}): ${t}`)
    ),
  };

  if (isMemoryMode()) {
    const s = getStore();
    s.study_plans.push({
      id: randomUUID(),
      user_id: userId,
      exam_id: null,
      plan,
      weak_topics: (diagnosis.causes || []).map((c) => c.title),
      strong_topics: [],
      created_at: nowIso(),
    });
    schedulePersist();
  } else {
    await query(
      `INSERT INTO study_plans (user_id, plan, weak_topics, strong_topics) VALUES ($1,$2,$3,$4)`,
      [
        userId,
        JSON.stringify(plan),
        JSON.stringify((diagnosis.causes || []).map((c) => c.title)),
        JSON.stringify([]),
      ]
    );
  }

  return plan;
}
