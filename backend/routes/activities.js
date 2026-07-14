const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/activities ───────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT a.*, u.first_name AS user_name, u.last_name AS user_last_name,
             c.first_name AS contact_name, d.title AS deal_title
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN deals d ON a.deal_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (type) { query += ' AND a.activity_type = ?'; params.push(type); }

    // Reps only see their own activities
    if (req.user.role === 'rep') {
      query += ' AND a.user_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get activities error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/activities/contact/:contactId ────────────
router.get('/contact/:contactId', auth, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const [rows] = await pool.query(`
      SELECT a.*, u.first_name AS user_name
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.contact_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.params.contactId, parseInt(limit), parseInt(offset)]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get contact activities error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/activities/deal/:dealId ──────────────────
router.get('/deal/:dealId', auth, async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const [rows] = await pool.query(`
      SELECT a.*, u.first_name AS user_name
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.deal_id = ?
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.params.dealId, parseInt(limit), parseInt(offset)]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get deal activities error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/activities ──────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      activity_type, subject, content, content_ar,
      contact_id, deal_id, company_id, direction,
      call_duration_sec, scheduled_at,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO activities (activity_type, subject, content, content_ar,
        contact_id, deal_id, company_id, user_id, direction,
        call_duration_sec, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [activity_type, subject, content, content_ar,
        contact_id, deal_id, company_id, req.user.id, direction || 'internal',
        call_duration_sec, scheduled_at]
    );

    // Update last_contacted_at and last_activity_at
    if (contact_id) {
      await pool.query('UPDATE contacts SET last_contacted_at = NOW() WHERE id = ?', [contact_id]);
    }
    if (deal_id) {
      await pool.query('UPDATE deals SET last_activity_at = NOW() WHERE id = ?', [deal_id]);
    }

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('activity:created', { id: result.insertId, activity_type, contact_id, deal_id });

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create activity error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/activities/:id ───────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const fields = ['subject', 'content', 'content_ar', 'activity_type', 'direction', 'call_duration_sec', 'scheduled_at'];
    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Activity updated.' });
  } catch (err) {
    console.error('Update activity error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/activities/:id ────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM activities WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Activity deleted.' });
  } catch (err) {
    console.error('Delete activity error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;