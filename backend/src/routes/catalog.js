import express from 'express';
import { query } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { contactLimiter } from '../middleware/security.js';

import { attachExamBlueprint } from '../data/exam-blueprints.js';

const router = express.Router();

router.get('/exams', async (_req, res) => {
  try {
    const { rows } = await query('SELECT * FROM exams WHERE is_active = TRUE ORDER BY category, name');
    res.json(rows.map(attachExamBlueprint));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const { exam, q } = req.query;
    let sql = `SELECT c.*, e.name AS exam_name, e.code AS exam_code
               FROM courses c LEFT JOIN exams e ON e.id = c.exam_id
               WHERE c.is_published = TRUE`;
    const params = [];
    if (exam) {
      params.push(exam);
      sql += ` AND (e.code = $${params.length} OR e.name ILIKE $${params.length})`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
    }
    sql += ' ORDER BY c.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/courses/:slug', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, e.name AS exam_name FROM courses c
       LEFT JOIN exams e ON e.id = c.exam_id WHERE c.slug = $1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Course not found' });
    const materials = await query(
      `SELECT * FROM materials WHERE course_id = $1 AND is_published = TRUE ORDER BY type, title`,
      [rows[0].id]
    );
    res.json({ ...rows[0], materials: materials.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/courses/:id/enroll', authRequired, async (req, res) => {
  try {
    const { rows } = await query(
      `INSERT INTO enrollments (user_id, course_id)
       VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    res.json(rows[0] || { message: 'Already enrolled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/materials', async (req, res) => {
  try {
    const { type, exam, subject, q } = req.query;
    let sql = `SELECT m.*, e.name AS exam_name, c.title AS course_title
               FROM materials m
               LEFT JOIN exams e ON e.id = m.exam_id
               LEFT JOIN courses c ON c.id = m.course_id
               WHERE m.is_published = TRUE`;
    const params = [];
    if (type) {
      params.push(type);
      sql += ` AND m.type = $${params.length}`;
    }
    if (exam) {
      params.push(exam);
      sql += ` AND (e.code = $${params.length} OR e.name ILIKE $${params.length})`;
    }
    if (subject) {
      params.push(subject);
      sql += ` AND m.subject ILIKE $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (m.title ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
    }
    sql += ' ORDER BY m.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/materials/:id', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM materials WHERE id = $1 AND is_published = TRUE',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load material' });
  }
});

router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }
    const emailOk = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return res.status(400).json({ error: 'Valid email is required' });
    if (String(message).length > 4000) {
      return res.status(400).json({ error: 'Message is too long (max 4000 characters)' });
    }
    await query(
      `INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)`,
      [
        String(name).trim().slice(0, 120),
        String(email).toLowerCase().trim().slice(0, 180),
        subject ? String(subject).trim().slice(0, 200) : null,
        String(message).trim().slice(0, 4000),
      ]
    );
    res.json({ message: 'Message received. We will get back to you soon.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
