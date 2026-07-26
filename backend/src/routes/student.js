import express from 'express';
import { query } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.use(authRequired);

router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    const [courses, bookmarks, progress, attempts, practice, certificates] = await Promise.all([
      query(
        `SELECT c.*, e.name AS exam_name, en.progress_percent, en.enrolled_at
         FROM enrollments en
         JOIN courses c ON c.id = en.course_id
         LEFT JOIN exams e ON e.id = c.exam_id
         WHERE en.user_id = $1 ORDER BY en.enrolled_at DESC`,
        [userId]
      ),
      query(
        `SELECT b.*, m.title, m.type, m.subject
         FROM bookmarks b JOIN materials m ON m.id = b.material_id
         WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
        [userId]
      ),
      query(
        `SELECT wp.*, m.title, m.type, m.video_url, m.duration_minutes
         FROM watch_progress wp JOIN materials m ON m.id = wp.material_id
         WHERE wp.user_id = $1 AND m.type = 'video'
         ORDER BY wp.updated_at DESC LIMIT 8`,
        [userId]
      ),
      query(
        `SELECT ea.*, mt.title AS test_title, e.name AS exam_name
         FROM exam_attempts ea
         JOIN mock_tests mt ON mt.id = ea.mock_test_id
         LEFT JOIN exams e ON e.id = mt.exam_id
         WHERE ea.user_id = $1 ORDER BY ea.started_at DESC LIMIT 10`,
        [userId]
      ),
      query(
        `SELECT pa.*, ps.title AS set_title
         FROM practice_attempts pa
         JOIN practice_sets ps ON ps.id = pa.practice_set_id
         WHERE pa.user_id = $1 ORDER BY pa.completed_at DESC LIMIT 10`,
        [userId]
      ),
      query(`SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC`, [userId]),
    ]);

    const liveExams = await query(
      `SELECT mt.*, e.name AS exam_name, e.code AS exam_code FROM mock_tests mt
       LEFT JOIN exams e ON e.id = mt.exam_id
       WHERE mt.is_published = TRUE AND mt.is_live = TRUE ORDER BY mt.created_at DESC`
    );

    const me = await query(`SELECT role, target_exam FROM users WHERE id = $1`, [userId]);
    const profile = me.rows[0];
    let liveRows = liveExams.rows;
    if (profile?.role !== 'admin') {
      const target = profile?.target_exam;
      if (!target) {
        liveRows = [];
      } else {
        const norm = (s) =>
          String(s || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ');
        const t = norm(target);
        liveRows = liveRows.filter((m) => {
          const name = norm(m.exam_name);
          const code = norm(m.exam_code);
          return t === name || t === code || (name && (name.includes(t) || t.includes(name)));
        });
      }
    }

    res.json({
      courses: courses.rows,
      bookmarks: bookmarks.rows,
      continue_watching: progress.rows,
      exam_attempts: attempts.rows,
      practice_attempts: practice.rows,
      certificates: certificates.rows,
      live_exams: liveRows,
      target_exam: profile?.target_exam || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { name, phone, target_exam } = req.body;
    const { rows } = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
       target_exam = COALESCE($3, target_exam), updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, role, target_exam, phone, avatar_url`,
      [name, phone, target_exam, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bookmarks/:materialId', async (req, res) => {
  try {
    const { rows } = await query(
      `INSERT INTO bookmarks (user_id, material_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING *`,
      [req.user.id, req.params.materialId]
    );
    res.json(rows[0] || { message: 'Already bookmarked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bookmarks/:materialId', async (req, res) => {
  try {
    await query(`DELETE FROM bookmarks WHERE user_id = $1 AND material_id = $2`, [
      req.user.id,
      req.params.materialId,
    ]);
    res.json({ message: 'Removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/watch-progress', async (req, res) => {
  try {
    const { material_id, progress_percent, last_position_seconds } = req.body;
    const { rows } = await query(
      `INSERT INTO watch_progress (user_id, material_id, progress_percent, last_position_seconds, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, material_id)
       DO UPDATE SET progress_percent = EXCLUDED.progress_percent,
                     last_position_seconds = EXCLUDED.last_position_seconds,
                     updated_at = NOW()
       RETURNING *`,
      [req.user.id, material_id, progress_percent || 0, last_position_seconds || 0]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/results', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ea.*, mt.title AS test_title, e.name AS exam_name
       FROM exam_attempts ea
       JOIN mock_tests mt ON mt.id = ea.mock_test_id
       LEFT JOIN exams e ON e.id = mt.exam_id
       WHERE ea.user_id = $1 AND ea.status IN ('submitted', 'evaluated')
       ORDER BY ea.submitted_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/certificates', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
