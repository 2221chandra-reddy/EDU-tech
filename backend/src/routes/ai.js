import express from 'express';
import { query } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { askTutor, generateQuestions, analyzePerformance } from '../services/ai.js';
import { aiLimiter } from '../middleware/security.js';
import { checkAiChatLimit, bumpAiChatCount, computeReadiness, listSkills } from '../services/learning.js';

const router = express.Router();

router.use(authRequired);
router.use(aiLimiter);

router.get('/sessions', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM ai_chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sessions', async (req, res) => {
  try {
    const title = req.body.title || 'New chat';
    const { rows } = await query(
      `INSERT INTO ai_chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *`,
      [req.user.id, title]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const session = await query(
      `SELECT id FROM ai_chat_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!session.rows.length) return res.status(404).json({ error: 'Session not found' });
    const { rows } = await query(
      `SELECT * FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/chat', async (req, res) => {
  try {
    let { session_id, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const limit = await checkAiChatLimit(req.user.id);
    if (!limit.allowed) {
      const expired = limit.reason === 'expired';
      return res.status(402).json({
        error: expired
          ? 'Your free trial has ended. Upgrade to Premium to keep using AI Coach.'
          : `Free plan limit reached (${limit.limit} AI messages/day). Upgrade to Premium for unlimited coach chat.`,
        code: expired ? 'PLAN_EXPIRED' : 'FREE_LIMIT',
        remaining: 0,
      });
    }

    if (!session_id) {
      const created = await query(
        `INSERT INTO ai_chat_sessions (user_id, title) VALUES ($1, $2) RETURNING id`,
        [req.user.id, message.slice(0, 60)]
      );
      session_id = created.rows[0].id;
    } else {
      const own = await query(
        `SELECT id FROM ai_chat_sessions WHERE id = $1 AND user_id = $2`,
        [session_id, req.user.id]
      );
      if (!own.rows.length) return res.status(404).json({ error: 'Session not found' });
    }

    await query(
      `INSERT INTO ai_chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [session_id, message]
    );

    const historyRes = await query(
      `SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 12`,
      [session_id]
    );
    const history = historyRes.rows.reverse().slice(0, -1);

    let studentContext = {};
    try {
      const [readiness, skills] = await Promise.all([
        computeReadiness(req.user.id),
        listSkills(req.user.id),
      ]);
      studentContext = {
        target_exam: readiness.target_exam,
        readiness_percent: readiness.readiness_percent,
        current_expected_score: readiness.current_expected_score,
        target_score: readiness.target_score,
        gap_to_close: readiness.gap_to_close,
        status: readiness.status,
        guess_risk: readiness.behavioral?.guess_risk,
        weak_topics: (skills || [])
          .filter((s) => s.status === 'weak' || s.status === 'concept' || Number(s.accuracy) < 50)
          .slice(0, 5)
          .map((s) => `${s.subject}/${s.topic}`),
      };
    } catch {
      // coaching still works without context
    }

    const reply = await askTutor({ message, history, studentContext });

    await query(
      `INSERT INTO ai_chat_messages (session_id, role, content) VALUES ($1, 'assistant', $2)`,
      [session_id, reply]
    );
    await query(`UPDATE ai_chat_sessions SET updated_at = NOW(), title = CASE WHEN title = 'New chat' THEN $2 ELSE title END WHERE id = $1`, [
      session_id,
      message.slice(0, 60),
    ]);
    await bumpAiChatCount(req.user.id);

    res.json({ session_id, reply, remaining: Math.max(0, (limit.remaining || 1) - 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate-questions', async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    if (!isAdmin) {
      const limit = await checkAiChatLimit(req.user.id);
      if (!limit.allowed) {
        const expired = limit.reason === 'expired';
        return res.status(402).json({
          error: expired
            ? 'Your free trial has ended. Upgrade to Premium to generate questions.'
            : 'Daily free AI limit reached. Upgrade to Premium for unlimited generation.',
          code: expired ? 'PLAN_EXPIRED' : 'FREE_LIMIT',
        });
      }
    }
    const { exam, subject, topic, difficulty, count, save = true } = req.body;
    const maxCount = isAdmin ? 50 : 20;
    const safeCount = Math.min(Math.max(Number(count) || 5, 1), maxCount);

    const questions = await generateQuestions({
      exam,
      subject,
      topic,
      difficulty,
      count: safeCount,
    });

    let examId = null;
    if (exam) {
      const found = await query(`SELECT id FROM exams WHERE code = $1 OR name ILIKE $1 LIMIT 1`, [exam]);
      examId = found.rows[0]?.id || null;
    }

    const saved = [];
    if (save) {
      // Students may save into a private practice set only; still stored as AI questions linked to that set.
      // Global bank pollution is limited by rate limits + count caps.
      for (const q of questions) {
        const { rows } = await query(
          `INSERT INTO questions (exam_id, subject, topic, chapter, concept, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source, status)
           VALUES ($1, $2, $3, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *`,
          [
            examId,
            q.subject,
            q.topic,
            q.difficulty,
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_option,
            q.explanation,
            'ai',
            isAdmin ? 'pending' : 'approved',
          ]
        );
        saved.push(rows[0]);
      }

      const { rows: setRows } = await query(
        `INSERT INTO practice_sets (user_id, exam_id, title, mode, subject, topic, difficulty, question_count, is_public)
         VALUES ($1, $2, $3, 'ai_generated', $4, $5, $6, $7, FALSE)
         RETURNING *`,
        [
          req.user.id,
          examId,
          `AI: ${subject || 'Mixed'} — ${topic || 'Practice'}`,
          subject || null,
          topic || null,
          difficulty || 'medium',
          saved.length,
        ]
      );

      for (let i = 0; i < saved.length; i++) {
        await query(
          `INSERT INTO practice_set_questions (practice_set_id, question_id, sort_order) VALUES ($1, $2, $3)`,
          [setRows[0].id, saved[i].id, i + 1]
        );
      }

      if (!isAdmin) await bumpAiChatCount(req.user.id);

      return res.json({
        practice_set: setRows[0],
        questions: saved,
        source: questions[0]?.source || 'ai',
        note:
          questions[0]?.source === 'offline_bank'
            ? 'Gemini quota unavailable — served exam-style questions from the built-in topic bank.'
            : undefined,
      });
    }

    if (!isAdmin) await bumpAiChatCount(req.user.id);

    res.json({ questions, source: questions[0]?.source || 'ai' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const analysis = await analyzePerformance(req.body);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
