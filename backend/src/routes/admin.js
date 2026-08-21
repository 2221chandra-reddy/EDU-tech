import express from 'express';
import { query } from '../config/db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { generateQuestions } from '../services/ai.js';
import { uploadVideo, uploadDoc, publicUploadUrl } from '../middleware/upload.js';
import {
  listSubjects,
  createSubject,
  deleteSubject,
  deleteUnusedSubjects,
  deleteCourse,
  listMaterialsAdmin,
  updateMaterial,
  deleteMaterial,
  listSchedules,
  createSchedule,
  createNotebookJob,
  listNotebookJobs,
  processDueSchedules,
  deleteQuestion,
  purgeUnwantedContent,
  questionStemExists,
} from '../services/scheduler.js';
import { notifyCbtPublished } from '../services/notifications.js';
import {
  getPlanSettings,
  updatePlanSettings,
  listPayments,
  adminSetStudentPlan,
  presentUser,
} from '../services/billing.js';

const router = express.Router();
router.use(authRequired, adminRequired);

function runUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
      next();
    });
  };
}

router.get('/dashboard', async (_req, res) => {
  try {
    const [students, courses, questions, mocks, attempts, materials] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'student'`),
      query(`SELECT COUNT(*)::int AS count FROM courses`),
      query(`SELECT COUNT(*)::int AS count FROM questions WHERE COALESCE(source, '') <> 'sample'`),
      query(`SELECT COUNT(*)::int AS count FROM mock_tests`),
      query(`SELECT COUNT(*)::int AS count FROM exam_attempts WHERE status = 'evaluated'`),
      query(`SELECT COUNT(*)::int AS count FROM materials`),
    ]);
    const recent = await query(
      `SELECT ea.id, ea.score, ea.total_marks, ea.submitted_at, u.name AS student_name, mt.title AS test_title
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       JOIN mock_tests mt ON mt.id = ea.mock_test_id
       WHERE ea.status = 'evaluated'
       ORDER BY ea.submitted_at DESC LIMIT 8`
    );
    res.json({
      stats: {
        students: students.rows[0].count,
        courses: courses.rows[0].count,
        questions: questions.rows[0].count,
        mocks: mocks.rows[0].count,
        attempts: attempts.rows[0].count,
        materials: materials.rows[0].count,
      },
      recent_attempts: recent.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/students', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, name, email, target_exam, phone, plan, plan_status, plan_expires_at, onboarding_done, diagnostic_done, created_at
       FROM users WHERE role = 'student' ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/students/:id/plan', async (req, res) => {
  try {
    const plan = req.body.plan === 'premium' ? 'premium' : 'free';
    const { rows } = await query(`SELECT id FROM users WHERE id = $1 AND role = 'student'`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    const result = await adminSetStudentPlan(req.params.id, plan);
    res.json(await presentUser(result.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plan-settings', async (_req, res) => {
  try {
    res.json(await getPlanSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plan-settings', async (req, res) => {
  try {
    res.json(await updatePlanSettings(req.body || {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payments', async (_req, res) => {
  try {
    res.json(await listPayments({ limit: 80 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/courses', async (req, res) => {
  try {
    const { exam_id, title, slug, description, level, duration_hours } = req.body;
    const { rows } = await query(
      `INSERT INTO courses (exam_id, title, slug, description, level, duration_hours)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [exam_id || null, title, slug, description || null, level || 'Beginner', duration_hours || 40]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const removed = await deleteCourse(req.params.id);
    res.json({ message: 'Course deleted', course: removed });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/materials', async (req, res) => {
  try {
    const {
      course_id,
      exam_id,
      title,
      type,
      subject,
      topic,
      description,
      content_text,
      file_url,
      video_url,
      duration_minutes,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!file_url?.trim() && !video_url?.trim() && !content_text?.trim()) {
      return res.status(400).json({ error: 'Add textbook matter text, a file URL, or a video URL' });
    }
    const { rows } = await query(
      `INSERT INTO materials (course_id, exam_id, title, type, subject, topic, description, file_url, video_url, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        course_id || null,
        exam_id || null,
        title,
        type,
        subject || null,
        topic || null,
        [description, content_text].filter(Boolean).join('\n\n') || null,
        file_url || null,
        video_url || null,
        duration_minutes || null,
      ]
    );
    // Persist content_text on memory/postgres via update when column exists
    let material = rows[0];
    if (content_text?.trim()) {
      try {
        material = await updateMaterial(material.id, { content_text: content_text.trim(), description: description || material.description });
      } catch {
        material = { ...material, content_text: content_text.trim() };
      }
    }
    res.status(201).json(material);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Direct video file upload + create material in one step */
router.post('/materials/upload-video', runUpload(uploadVideo), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Video file is required' });
    const {
      exam_id,
      title,
      subject,
      topic,
      description,
      duration_minutes,
      course_id,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const video_url = publicUploadUrl(req.file.filename, 'videos');
    const { rows } = await query(
      `INSERT INTO materials (course_id, exam_id, title, type, subject, topic, description, file_url, video_url, duration_minutes)
       VALUES ($1,$2,$3,'video',$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        course_id || null,
        exam_id || null,
        title.trim(),
        subject || null,
        topic || null,
        description || null,
        null,
        video_url,
        duration_minutes ? Number(duration_minutes) : null,
      ]
    );
    res.status(201).json({
      material: rows[0],
      video_url,
      original_name: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Direct PDF/textbook file upload + create material */
router.post('/materials/upload-doc', runUpload(uploadDoc), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Document file is required' });
    const {
      exam_id,
      title,
      subject,
      topic,
      description,
      type = 'book',
      course_id,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const allowed = ['book', 'pdf', 'notes', 'previous_paper'];
    const materialType = allowed.includes(type) ? type : 'book';
    const file_url = publicUploadUrl(req.file.filename, 'docs');

    const { rows } = await query(
      `INSERT INTO materials (course_id, exam_id, title, type, subject, topic, description, file_url, video_url, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        course_id || null,
        exam_id || null,
        title.trim(),
        materialType,
        subject || null,
        topic || null,
        description || null,
        file_url,
        null,
        null,
      ]
    );
    res.status(201).json({
      material: rows[0],
      file_url,
      original_name: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT q.*, e.name AS exam_name FROM questions q
       LEFT JOIN exams e ON e.id = q.exam_id
       WHERE COALESCE(q.source, '') NOT IN ('sample', 'diagnostic')
       ORDER BY q.created_at DESC LIMIT 200`
    );
    const seen = new Set();
    const unique = [];
    for (const q of rows) {
      const key = String(q.question_text || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(q);
    }
    res.json(unique);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/questions', async (req, res) => {
  try {
    const q = req.body;
    if (!String(q.question_text || '').trim()) {
      return res.status(400).json({ error: 'Question text is required' });
    }
    if (await questionStemExists(q.question_text)) {
      return res.status(409).json({ error: 'Duplicate question. This question is already in the bank.' });
    }
    const { rows } = await query(
      `INSERT INTO questions (exam_id, subject, topic, chapter, concept, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending') RETURNING *`,
      [
        q.exam_id || null,
        q.subject,
        q.topic,
        q.chapter || q.topic || null,
        q.concept || q.topic || null,
        q.difficulty || 'medium',
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        q.explanation || null,
        q.source || 'manual',
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/questions/:id', async (req, res) => {
  try {
    const { status, chapter, concept, topic, subject } = req.body || {};
    if (status && !['draft', 'pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await query(
      `UPDATE questions SET
         status = COALESCE($1, status),
         chapter = COALESCE($2, chapter),
         concept = COALESCE($3, concept),
         topic = COALESCE($4, topic),
         subject = COALESCE($5, subject),
         reviewed_by = CASE WHEN $1 IS NOT NULL THEN $6 ELSE reviewed_by END,
         reviewed_at = CASE WHEN $1 IS NOT NULL THEN NOW() ELSE reviewed_at END
       WHERE id = $7 RETURNING *`,
      [status || null, chapter || null, concept || null, topic || null, subject || null, req.user.id, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Question not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/questions/samples', async (_req, res) => {
  try {
    const result = await purgeUnwantedContent();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const row = await deleteQuestion(req.params.id);
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/generate-questions', async (req, res) => {
  try {
    const { exam, subject, topic, difficulty, count, exam_id } = req.body;
    const generated = await generateQuestions({ exam, subject, topic, difficulty, count });
    const saved = [];
    const skipped = [];
    for (const q of generated) {
      if (await questionStemExists(q.question_text)) {
        skipped.push(q.question_text);
        continue;
      }
      const { rows } = await query(
        `INSERT INTO questions (exam_id, subject, topic, chapter, concept, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, source, status)
         VALUES ($1,$2,$3,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ai','pending') RETURNING *`,
        [
          exam_id || null,
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
        ]
      );
      saved.push(rows[0]);
    }
    res.json({ questions: saved, skipped_duplicates: skipped.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mocks', async (req, res) => {
  try {
    const {
      exam_id,
      title,
      description,
      duration_minutes,
      total_questions,
      negative_marking,
      is_live,
      question_ids = [],
    } = req.body;
    const { rows } = await query(
      `INSERT INTO mock_tests (exam_id, title, description, duration_minutes, total_questions, negative_marking, is_live, starts_at, ends_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
         CASE WHEN $7 THEN NOW() ELSE NULL END,
         CASE WHEN $7 THEN NOW() + ($4 * INTERVAL '1 minute') ELSE NULL END
       ) RETURNING *`,
      [
        exam_id,
        title,
        description || null,
        duration_minutes || 90,
        total_questions || question_ids.length,
        negative_marking ?? 0.25,
        !!is_live,
      ]
    );
    for (let i = 0; i < question_ids.length; i++) {
      await query(
        `INSERT INTO mock_test_questions (mock_test_id, question_id, sort_order) VALUES ($1,$2,$3)`,
        [rows[0].id, question_ids[i], i + 1]
      );
    }
    if (rows[0].is_live) {
      try {
        await notifyCbtPublished(rows[0]);
      } catch (err) {
        console.error('[notify] CBT publish failed:', err.message);
      }
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/results', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT ea.*, u.name AS student_name, u.email, mt.title AS test_title
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       JOIN mock_tests mt ON mt.id = ea.mock_test_id
       WHERE ea.status = 'evaluated'
       ORDER BY ea.submitted_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/analytics', async (_req, res) => {
  try {
    const byExam = await query(
      `SELECT e.name, COUNT(ea.id)::int AS attempts, ROUND(AVG(ea.score)::numeric, 2) AS avg_score
       FROM exam_attempts ea
       JOIN mock_tests mt ON mt.id = ea.mock_test_id
       JOIN exams e ON e.id = mt.exam_id
       WHERE ea.status = 'evaluated'
       GROUP BY e.name ORDER BY attempts DESC`
    );
    const bySource = await query(
      `SELECT source, COUNT(*)::int AS count FROM questions GROUP BY source`
    );
    res.json({ by_exam: byExam.rows, by_question_source: bySource.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/subjects', async (_req, res) => {
  try {
    res.json(await listSubjects());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/subjects', async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject name required' });
    res.status(201).json(await createSubject({ name, code, description }));
  } catch (err) {
    const msg = err.message || 'Could not add subject';
    const code = /already exists/i.test(msg) ? 409 : 400;
    res.status(code).json({ error: msg });
  }
  try {
    const result = await deleteUnusedSubjects();
    res.json({
      message:
        result.deleted > 0
          ? `Deleted ${result.deleted} unused subject(s)`
          : 'No unused subjects to delete',
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/subjects/:id', async (req, res) => {
  try {
    const removed = await deleteSubject(req.params.id);
    res.json({ message: 'Subject deleted', subject: removed });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/materials', async (req, res) => {
  try {
    res.json(await listMaterialsAdmin({ type: req.query.type, subject: req.query.subject }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/materials/:id', async (req, res) => {
  try {
    const updated = await updateMaterial(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.delete('/materials/:id', async (req, res) => {
  try {
    const removed = await deleteMaterial(req.params.id);
    res.json({ message: 'Material deleted', material: removed });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/schedules', async (_req, res) => {
  try {
    res.json(await listSchedules());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/schedules', async (req, res) => {
  try {
    const schedule = await createSchedule(req.body);
    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/schedules/process-due', async (_req, res) => {
  try {
    const results = await processDueSchedules();
    res.json({ processed: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notebook-llm', async (req, res) => {
  try {
    const {
      direction,
      exam_id,
      subject,
      topic,
      material_ids,
      content_text,
      total_questions,
      duration_minutes,
      publish,
      is_live,
      title,
    } = req.body;
    if (!exam_id) return res.status(400).json({ error: 'exam_id is required' });
    if (!subject?.trim() && !content_text?.trim() && !(Array.isArray(material_ids) && material_ids.length)) {
      return res.status(400).json({
        error: 'Select a subject, paste textbook matter, or choose materials',
      });
    }
    const result = await createNotebookJob({
      direction:
        direction ||
        (subject
          ? `Generate exam MCQs for subject "${subject}"${topic ? ` topic "${topic}"` : ''}. Include answers and explanations.`
          : 'Take the textbook matter, generate MCQ questions with correct answers and explanations, then publish.'),
      exam_id,
      subject: subject || 'General',
      topic,
      material_ids: material_ids || [],
      content_text: content_text || '',
      total_questions: total_questions || 20,
      duration_minutes: duration_minutes || 60,
      publish: publish !== false,
      is_live: is_live !== false,
      title,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notebook-jobs', async (_req, res) => {
  try {
    res.json(await listNotebookJobs());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
