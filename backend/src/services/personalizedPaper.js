import { BLUEPRINTS, questionsForSection } from '../data/exam-blueprints.js';

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(items, seed) {
  const out = [...items];
  let h = hashSeed(seed);
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function matchesSection(question, sectionName) {
  const sub = String(question?.subject || '').toLowerCase();
  const name = String(sectionName || '').toLowerCase();
  if (!sub || !name) return false;
  if (name.includes('rajbhasha') || name.includes('gk')) {
    return /rajbhasha|gk|general knowledge|official language/.test(sub);
  }
  return sub === name || sub.includes(name) || name.includes(sub);
}

export function parseQuestionIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function pickStudentPaper(pool = [], examCode, userId, mockId) {
  const bp = BLUEPRINTS[examCode];
  const seed = `${userId}:${mockId}`;
  if (!bp?.paper_pattern?.sections?.length) {
    const want = Number(bp?.paper_pattern?.total_questions) || pool.length;
    return seededShuffle(pool, seed).slice(0, want);
  }

  const used = new Set();
  const picked = [];
  for (const section of bp.paper_pattern.sections) {
    const want = questionsForSection(section, bp.paper_pattern.total_questions);
    const bucket = pool.filter((q) => matchesSection(q, section.subject) && !used.has(q.id));
    const chosen = seededShuffle(bucket, `${seed}:${section.subject}`).slice(0, want);
    for (const q of chosen) {
      used.add(q.id);
      picked.push(q);
    }
  }

  if (picked.length < bp.paper_pattern.total_questions) {
    const fill = seededShuffle(
      pool.filter((q) => !used.has(q.id)),
      `${seed}:fill`
    ).slice(0, bp.paper_pattern.total_questions - picked.length);
    picked.push(...fill);
  }

  return picked;
}

export function stripAnswerKey(questions = []) {
  return questions.map(({ correct_option, explanation, ...safe }) => safe);
}

export function shouldVaryPerStudent(mock = {}) {
  if (mock.vary_per_student === true || mock.vary_per_student === 't') return true;
  return String(mock.exam_code || '') === 'RAILWAY_LDCE_COMM';
}
