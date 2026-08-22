/** Official paper patterns used by catalog, scheduler, and AI generation. */

export const NEGATIVE_ONE_THIRD = Number((1 / 3).toFixed(4)); // 0.3333

export const RAILWAY_LDCE_COMM = {
  name: 'Railway Group C to B (Commercial)',
  code: 'RAILWAY_LDCE_COMM',
  category: 'Railway Emp',
  description:
    'Departmental LDCE / EMPS paper for serving Railway Commercial employees (Group C to Group B). AI-generated CBT. 180 questions in 3 hours: Commercial 90 + Rajbhasha/GK 55 (combined, not 55 each) + HR/Establishment 35. Negative marking 1/3. Duration is fixed at 3 hours; admin only sets the exam date/time.',
  duration_minutes: 180,
  total_questions: 180,
};

export const LDCE_COMM_SUBJECTS = [
  {
    name: 'Commercial',
    code: 'COMMERCIAL',
    marks: 90,
    description: 'Railway commercial work — the professional paper for Commercial staff.',
    topics: [
      'Passenger ticketing',
      'Reservation rules',
      'Fare rules',
      'Goods traffic',
      'Rates and classification',
      'Parcel traffic',
      'Refund rules',
      'Excess fare',
      'Ticket checking',
      'Commercial statistics',
      'Passenger amenities',
      'Claims',
      'Commercial forms and procedures',
      'Railway Commercial Manual',
      'Coaching and traffic rules',
      'Railway Board commercial circulars',
    ],
  },
  {
    name: 'Rajbhasha / GK',
    code: 'RAJBHASHA_GK',
    marks: 55,
    description:
      'Rajbhasha (Official Language) and General Knowledge together — 55 questions in total, not 55 each.',
    topics: [
      'Official Languages Act, 1963',
      'Official Language Rules',
      'Constitutional provisions relating to Hindi',
      'Hindi implementation in Government and Railways',
      'Section 3(3)',
      'Hindi correspondence',
      'Official-language targets',
      'Rajbhasha policy',
      'Indian history',
      'Geography',
      'Indian Constitution',
      'General science',
      'Indian economy',
      'Important national institutions',
      'Railway-related general knowledge',
      'General awareness',
    ],
  },
  {
    name: 'HR / Establishment',
    code: 'HR_ESTABLISHMENT',
    marks: 35,
    description: 'Railway employee / service rules (Establishment).',
    topics: [
      'Recruitment',
      'Seniority',
      'Promotion',
      'Transfer',
      'Leave',
      'Conduct Rules',
      'Discipline and Appeal Rules',
      'Reservation',
      'Pass / PTO',
      'Retirement and pension',
      'APAR',
      'Medical decategorisation',
      'Staff welfare',
      'Service conditions',
      'Railway Establishment Code',
    ],
  },
];

function ldceSections() {
  const total = LDCE_COMM_SUBJECTS.reduce((s, x) => s + x.marks, 0);
  return LDCE_COMM_SUBJECTS.map((s) => ({
    subject: s.name,
    question_type: 'mcq',
    marks: s.marks,
    percentage: Number(((s.marks / total) * 100).toFixed(2)),
    topic: '',
  }));
}

export const BLUEPRINTS = {
  [RAILWAY_LDCE_COMM.code]: {
    exam: RAILWAY_LDCE_COMM,
    paper_pattern: {
      total_questions: 180,
      total_marks: 180,
      duration_minutes: 180,
      negative_marking: NEGATIVE_ONE_THIRD,
      mark_per_question: 1,
      duration_locked: true,
      pool_multiplier: 2,
      vary_per_student: true,
      sections: ldceSections(),
      ai_direction:
        'Generate a Railway Group C to B Commercial LDCE paper of exactly 180 MCQs (1 mark each) for a 3-hour CBT. Split: Commercial 90; Rajbhasha AND GK together 55 questions (mix both — NOT 55 Rajbhasha plus 55 GK); HR/Establishment 35. Negative marking 1/3. Cover Railway Commercial Manual, ticketing, goods/parcel, refunds, claims; Official Languages Act 1963, Rules, Section 3(3); history, geography, Constitution, science, economy, Railway GK; IREC, D&A, leave, pass/PTO, seniority, promotion. Four options and a short explanation. Hindi terms may appear in Rajbhasha items with an English gloss in the explanation.',
    },
    subjects: LDCE_COMM_SUBJECTS,
  },
};

export function attachExamBlueprint(exam) {
  if (!exam) return exam;
  const bp = BLUEPRINTS[exam.code];
  if (!bp) return exam;
  return {
    ...exam,
    paper_pattern: bp.paper_pattern,
    ldce_subjects: bp.subjects,
  };
}

export function findBlueprint({ code, name } = {}) {
  if (code && BLUEPRINTS[code]) return BLUEPRINTS[code];
  const n = String(name || '').toLowerCase();
  return (
    Object.values(BLUEPRINTS).find((bp) => {
      const en = bp.exam.name.toLowerCase();
      return n && (n.includes(en) || en.includes(n) || n.includes('ldce') || n.includes('group c to b'));
    }) || null
  );
}

export function syllabusPrompt(examNameOrCode, subject) {
  const bp =
    findBlueprint({ code: examNameOrCode }) || findBlueprint({ name: examNameOrCode });
  if (!bp) return '';
  const sub = bp.subjects.find(
    (s) => String(s.name).toLowerCase() === String(subject || '').toLowerCase()
  );
  if (!sub) return '';
  return `This is ${bp.exam.name}. Subject ${sub.name} (${sub.marks} marks, 1 mark = 1 MCQ). Cover these topics: ${sub.topics.join('; ')}.`;
}

export function questionsForSection(section, totalQuestions = 100) {
  const marks = Number(section?.marks);
  if (Number.isFinite(marks) && marks > 0) return Math.max(1, Math.round(marks));
  const pct = Number(section?.percentage) || 0;
  return Math.max(1, Math.round((pct / 100) * Number(totalQuestions || 100)));
}

export function normalizePatternSections(pattern_sections = []) {
  if (!Array.isArray(pattern_sections)) return [];
  return pattern_sections.map((s) => ({
    subject: s.subject || 'General',
    question_type: s.question_type || 'mcq',
    percentage: Number(s.percentage) || 0,
    marks: Number(s.marks) || 0,
    topic: s.topic || '',
  }));
}

export function validatePatternSections(sections, totalQuestions) {
  const list = normalizePatternSections(sections);
  if (!list.length) return { ok: true, sections: list, total_questions: Number(totalQuestions) || 100 };
  const marksSum = list.reduce((s, x) => s + (x.marks || 0), 0);
  if (marksSum > 0) {
    return { ok: true, sections: list, total_questions: marksSum, mode: 'marks' };
  }
  const pct = list.reduce((s, x) => s + x.percentage, 0);
  if (Math.abs(pct - 100) > 0.5) {
    return { ok: false, error: `Pattern percentages must total 100% (currently ${pct}%)` };
  }
  return { ok: true, sections: list, total_questions: Number(totalQuestions) || 100, mode: 'percent' };
}

export function formatNegativeMarking(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'None';
  if (Math.abs(n - 1 / 3) < 0.02) return '1/3 mark per wrong answer';
  return `${n} mark per wrong answer`;
}
