const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/users ────────────────────────────────────
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { role, search, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT id, first_name, last_name, email, role, language, territory, is_active, last_login_at, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) { query += ' AND role = ?'; params.push(role); }
    if (search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // If manager, only show their team
    if (req.user.role === 'manager') {
      query += ' AND (manager_id = ? OR id = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/users/:id ────────────────────────────────
router.get('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, role, language, territory, is_active, last_login_at, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/users ───────────────────────────────────
router.post('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, language, territory, manager_id } = req.body;
    const bcrypt = require('bcryptjs');

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already exists.' });
    }

    const password_hash = await bcrypt.hash(password || 'changeme123', 12);

    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, language, territory, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, password_hash, role || 'rep', language || 'en', territory || null, manager_id || null]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'user', result.insertId, 'create', req.ip]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId, first_name, last_name, email, role: role || 'rep' },
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/users/:id ────────────────────────────────
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    const { first_name, last_name, role, language, territory, manager_id } = req.body;
    const updates = [];
    const values = [];

    if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }
    if (territory !== undefined) { updates.push('territory = ?'); values.push(territory); }
    if (manager_id !== undefined) { updates.push('manager_id = ?'); values.push(manager_id); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/users/:id/toggle-active ────────────────
router.patch('/:id/toggle-active', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User status toggled.' });
  } catch (err) {
    console.error('Toggle user error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
