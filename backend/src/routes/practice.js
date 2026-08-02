import express from 'express';
import { query } from '../config/db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { analyzePerformance } from '../services/ai.js';
import {
  upsertSkillsFromResults,
  recordMistakes,
  classifyMistake,
  awardXp,
  enrichMockAnalysis,
} from '../services/learning.js';

const router = express.Router();

router.get('/sets', async (req, res) => {
  try {
    const { mode, exam } = req.query;
    let sql = `SELECT ps.*, e.name AS exam_name FROM practice_sets ps
               LEFT JOIN exams e ON e.id = ps.exam_id
               WHERE (ps.is_public = TRUE OR ps.user_id IS NULL)`;
    const params = [];
    if (mode) {
      params.push(mode);
      sql += ` AND ps.mode = $${params.length}`;
    }
    if (exam) {
      params.push(exam);
      sql += ` AND (e.code = $${params.length} OR e.name ILIKE $${params.length})`;
    }
    sql += ' ORDER BY ps.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sets/:id', optionalAuth, async (req, res) => {
  try {
    const set = await query(`SELECT * FROM practice_sets WHERE id = $1`, [req.params.id]);
    if (!set.rows.length) return res.status(404).json({ error: 'Not found' });
    const row = set.rows[0];
    const isOwner = req.user?.id && row.user_id === req.user.id;
    const isPublic = row.is_public === true || row.user_id == null;
    if (!isPublic && !isOwner) {
      return res.status(403).json({ error: 'This practice set is private' });
    }
    const questions = await query(
      `SELECT q.id, q.subject, q.topic, q.difficulty, q.question_text,
              q.option_a, q.option_b, q.option_c, q.option_d
       FROM practice_set_questions psq
       JOIN questions q ON q.id = psq.question_id
       WHERE psq.practice_set_id = $1
       ORDER BY psq.sort_order`,
      [req.params.id]
    );
    res.json({ ...row, questions: questions.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load practice set' });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const { exam, subject, topic, difficulty, source, limit = 20 } = req.query;
    let sql = `SELECT q.id, q.exam_id, q.subject, q.topic, q.difficulty, q.question_text,
                      q.option_a, q.option_b, q.option_c, q.option_d, q.source
               FROM questions q LEFT JOIN exams e ON e.id = q.exam_id
               WHERE COALESCE(q.status, 'approved') = 'approved'`;
    const params = [];
    if (exam) {
      params.push(exam);
      sql += ` AND (e.code = $${params.length} OR e.name ILIKE $${params.length})`;
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
    if (source) {
      params.push(source);
      sql += ` AND q.source = $${params.length}`;
    }
    params.push(Math.min(Number(limit) || 20, 100));
    sql += ` ORDER BY RANDOM() LIMIT $${params.length}`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/submit', authRequired, async (req, res) => {
  try {
    const { practice_set_id, answers = {}, time_taken_seconds = 0, timings = {} } = req.body;
    const qRes = await query(
      `SELECT q.* FROM practice_set_questions psq
       JOIN questions q ON q.id = psq.question_id
       WHERE psq.practice_set_id = $1`,
      [practice_set_id]
    );
    const questions = qRes.rows;
    let score = 0;
    const perQ = Math.max(1, Math.round((Number(time_taken_seconds) || questions.length * 40) / Math.max(questions.length, 1)));
    const skillRows = [];
    const mistakeItems = [];
    for (const q of questions) {
      const correct = answers[q.id] === q.correct_option;
      if (correct) score += 1;
      const seconds = Number(timings[q.id]) || perQ;
      skillRows.push({ subject: q.subject, topic: q.topic || 'Mixed', correct, seconds });
      if (!correct && answers[q.id]) {
        mistakeItems.push({
          question_id: q.id,
          attempt_type: 'practice',
          mistake_type: classifyMistake({ correct: false, seconds }),
          student_answer: answers[q.id],
          correct_option: q.correct_option,
          subject: q.subject,
          topic: q.topic,
        });
      }
    }
    let analysis = await analyzePerformance({
      score,
      total: questions.length,
      answers,
      questions,
      timeTakenSeconds: time_taken_seconds,
    });
    analysis = enrichMockAnalysis(analysis, { questions, answers, timings });

    const { rows } = await query(
      `INSERT INTO practice_attempts (user_id, practice_set_id, score, total, accuracy, time_taken_seconds, answers, analysis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.user.id,
        practice_set_id,
        score,
        questions.length,
        questions.length ? ((score / questions.length) * 100).toFixed(2) : 0,
        time_taken_seconds,
        JSON.stringify(answers),
        JSON.stringify(analysis),
      ]
    );

    await upsertSkillsFromResults(req.user.id, skillRows);
    await recordMistakes(
      req.user.id,
      mistakeItems.map((m) => ({ ...m, attempt_id: rows[0].id }))
    );
    await awardXp(req.user.id, 15, { activity: 'practice' });

    const answerKey = questions.map((q) => ({
      id: q.id,
      correct_option: q.correct_option,
      explanation: q.explanation,
      your_answer: answers[q.id] || null,
      is_correct: answers[q.id] === q.correct_option,
    }));

    res.json({ attempt: rows[0], answer_key: answerKey, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
