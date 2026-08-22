export function formatNegativeMarking(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'None';
  if (Math.abs(n - 1 / 3) < 0.02) return '1/3 mark per wrong answer';
  return `${n} per wrong answer`;
}

export function applyPaperPattern(exam, current = {}) {
  const p = exam?.paper_pattern;
  if (!p) return { ...current, exam_id: exam?.id || current.exam_id };
  return {
    ...current,
    exam_id: exam.id,
    duration_minutes: p.duration_minutes,
    total_questions: p.total_questions,
    negative_marking: p.negative_marking,
    notebook_direction: p.ai_direction || current.notebook_direction,
    pattern_sections: (p.sections || []).map((s) => ({ ...s })),
  };
}
