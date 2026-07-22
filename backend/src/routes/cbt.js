import express from 'express';
import { query } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { analyzePerformance } from '../services/ai.js';

const router = express.Router();

router.get('/mocks', async (req, res) => {
  try {
    const { exam, live } = req.query;
    let sql = `SELECT mt.*, e.name AS exam_name, e.code AS exam_code
               FROM mock_tests mt LEFT JOIN exams e ON e.id = mt.exam_id
               WHERE mt.is_published = TRUE`;
    const params = [];
    if (exam) {
      params.push(exam);
      sql += ` AND (e.code = $${params.length} OR e.name ILIKE $${params.length})`;
    }
    if (live === 'true') sql += ' AND mt.is_live = TRUE';
    sql += ' ORDER BY mt.is_live DESC, mt.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mocks/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mt.*, e.name AS exam_name FROM mock_tests mt
       LEFT JOIN exams e ON e.id = mt.exam_id WHERE mt.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mock test not found' });
    const count = await query(
      `SELECT COUNT(*)::int AS count FROM mock_test_questions WHERE mock_test_id = $1`,
      [req.params.id]
    );
    res.json({ ...rows[0], question_count: count.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mocks/:id/start', authRequired, async (req, res) => {
  try {
    const mock = await query(`SELECT * FROM mock_tests WHERE id = $1 AND is_published = TRUE`, [
      req.params.id,
    ]);
    if (!mock.rows.length) return res.status(404).json({ error: 'Mock not found' });

    const existing = await query(
      `SELECT * FROM exam_attempts WHERE user_id = $1 AND mock_test_id = $2 AND status = 'in_progress'
       ORDER BY started_at DESC LIMIT 1`,
      [req.user.id, req.params.id]
    );
    if (existing.rows.length) {
      const questions = await getExamQuestions(req.params.id);
      return res.json({ attempt: existing.rows[0], questions, mock: mock.rows[0] });
    }

    const { rows } = await query(
      `INSERT INTO exam_attempts (user_id, mock_test_id, status, answers, marked_for_review, visited)
       VALUES ($1, $2, 'in_progress', '{}', '[]', '[]') RETURNING *`,
      [req.user.id, req.params.id]
    );
    const questions = await getExamQuestions(req.params.id);
    res.status(201).json({ attempt: rows[0], questions, mock: mock.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function getExamQuestions(mockId) {
  const { rows } = await query(
    `SELECT q.id, q.subject, q.topic, q.difficulty, q.question_text,
            q.option_a, q.option_b, q.option_c, q.option_d
     FROM mock_test_questions mtq
     JOIN questions q ON q.id = mtq.question_id
     WHERE mtq.mock_test_id = $1
     ORDER BY mtq.sort_order`,
    [mockId]
  );
  return rows;
}

router.patch('/attempts/:id/autosave', authRequired, async (req, res) => {
  try {
    const { answers, marked_for_review, visited } = req.body;
    const { rows } = await query(
      `UPDATE exam_attempts SET
         answers = COALESCE($1, answers),
         marked_for_review = COALESCE($2, marked_for_review),
         visited = COALESCE($3, visited),
         autosave_at = NOW()
       WHERE id = $4 AND user_id = $5 AND status = 'in_progress'
       RETURNING *`,
      [
        answers ? JSON.stringify(answers) : null,
        marked_for_review ? JSON.stringify(marked_for_review) : null,
        visited ? JSON.stringify(visited) : null,
        req.params.id,
        req.user.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Attempt not found or already submitted' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attempts/:id/submit', authRequired, async (req, res) => {
  try {
    const { answers = {}, marked_for_review = [], visited = [], time_taken_seconds = 0 } = req.body;

    const attemptRes = await query(
      `SELECT ea.*, mt.negative_marking, mt.total_questions, mt.title, mt.exam_id
       FROM exam_attempts ea JOIN mock_tests mt ON mt.id = ea.mock_test_id
       WHERE ea.id = $1 AND ea.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!attemptRes.rows.length) return res.status(404).json({ error: 'Attempt not found' });
    const attempt = attemptRes.rows[0];
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ error: 'Already submitted' });
    }

    const questions = await query(
      `SELECT q.* FROM mock_test_questions mtq
       JOIN questions q ON q.id = mtq.question_id
       WHERE mtq.mock_test_id = $1 ORDER BY mtq.sort_order`,
      [attempt.mock_test_id]
    );

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;
    const neg = Number(attempt.negative_marking) || 0;

    for (const q of questions.rows) {
      const ans = answers[q.id];
      if (!ans) {
        unattempted += 1;
      } else if (ans === q.correct_option) {
        correct += 1;
      } else {
        wrong += 1;
      }
    }

    const score = correct - wrong * neg;
    const totalMarks = questions.rows.length;

    const analysis = await analyzePerformance({
      score: correct,
      total: questions.rows.length,
      answers,
      questions: questions.rows,
      timeTakenSeconds: time_taken_seconds,
    });

    const { rows } = await query(
      `UPDATE exam_attempts SET
         status = 'evaluated',
         answers = $1,
         marked_for_review = $2,
         visited = $3,
         score = $4,
         total_marks = $5,
         correct_count = $6,
         wrong_count = $7,
         unattempted_count = $8,
         time_taken_seconds = $9,
         submitted_at = NOW(),
         analysis = $10
       WHERE id = $11
       RETURNING *`,
      [
        JSON.stringify(answers),
        JSON.stringify(marked_for_review),
        JSON.stringify(visited),
        score,
        totalMarks,
        correct,
        wrong,
        unattempted,
        time_taken_seconds,
        JSON.stringify(analysis),
        req.params.id,
      ]
    );

    if (score >= totalMarks * 0.6) {
      const code = `EG-${Date.now().toString(36).toUpperCase()}`;
      await query(
        `INSERT INTO certificates (user_id, mock_test_id, title, score, certificate_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [req.user.id, attempt.mock_test_id, `Certificate — ${attempt.title}`, score, code]
      );
    }

    // Persist study plan from analysis
    await query(
      `INSERT INTO study_plans (user_id, exam_id, plan, weak_topics, strong_topics)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user.id,
        attempt.exam_id,
        JSON.stringify(analysis),
        JSON.stringify(analysis.weak_subjects || []),
        JSON.stringify(analysis.strong_subjects || []),
      ]
    );

    const answerKey = questions.rows.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: q.explanation,
      your_answer: answers[q.id] || null,
      is_correct: answers[q.id] === q.correct_option,
      subject: q.subject,
      topic: q.topic,
    }));

    res.json({ attempt: rows[0], answer_key: answerKey, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attempts/:id', authRequired, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ea.*, mt.title AS test_title, mt.duration_minutes, e.name AS exam_name
       FROM exam_attempts ea
       JOIN mock_tests mt ON mt.id = ea.mock_test_id
       LEFT JOIN exams e ON e.id = mt.exam_id
       WHERE ea.id = $1 AND ea.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attempts/:id/answer-key', authRequired, async (req, res) => {
  try {
    const attempt = await query(
      `SELECT * FROM exam_attempts WHERE id = $1 AND user_id = $2 AND status IN ('submitted', 'evaluated')`,
      [req.params.id, req.user.id]
    );
    if (!attempt.rows.length) return res.status(404).json({ error: 'Result not available' });

    const questions = await query(
      `SELECT q.* FROM mock_test_questions mtq
       JOIN questions q ON q.id = mtq.question_id
       WHERE mtq.mock_test_id = $1 ORDER BY mtq.sort_order`,
      [attempt.rows[0].mock_test_id]
    );

    const answers = attempt.rows[0].answers || {};
    const key = questions.rows.map((q) => ({
      ...q,
      your_answer: answers[q.id] || null,
      is_correct: answers[q.id] === q.correct_option,
    }));

    res.json({ attempt: attempt.rows[0], answer_key: key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
