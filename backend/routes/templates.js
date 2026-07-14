const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// ─── GET /api/templates ────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM email_templates WHERE 1=1';
    const params = [];

    // Show shared templates + user's own
    query += ' AND (is_shared = TRUE OR created_by = ?)';
    params.push(req.user.id);

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY updated_at DESC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/templates/:id ────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM email_templates WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/templates ───────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { name, subject, subject_ar, body, body_ar, category, is_shared } = req.body;

    const [result] = await pool.query(
      `INSERT INTO email_templates (name, subject, subject_ar, body, body_ar, category, is_shared, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, subject, subject_ar, body, body_ar, category, is_shared || false, req.user.id]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/templates/:id ────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, subject, subject_ar, body, body_ar, category, is_shared } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (subject !== undefined) { updates.push('subject = ?'); values.push(subject); }
    if (subject_ar !== undefined) { updates.push('subject_ar = ?'); values.push(subject_ar); }
    if (body !== undefined) { updates.push('body = ?'); values.push(body); }
    if (body_ar !== undefined) { updates.push('body_ar = ?'); values.push(body_ar); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (is_shared !== undefined) { updates.push('is_shared = ?'); values.push(is_shared); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Template updated.' });
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/templates/:id ─────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM email_templates WHERE id = ? AND created_by = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Template deleted.' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;