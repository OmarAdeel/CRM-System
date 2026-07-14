const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/automations ──────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM automations ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get automations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/automations/:id ──────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM automations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Automation not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get automation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/automations ─────────────────────────────
router.post('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config, action_type, action_config } = req.body;

    const [result] = await pool.query(
      `INSERT INTO automations (name, description, trigger_type, trigger_config, action_type, action_config, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description, trigger_type, JSON.stringify(trigger_config), action_type, JSON.stringify(action_config), req.user.id]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create automation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/automations/:id ──────────────────────────
router.put('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, description, trigger_type, trigger_config, action_type, action_config } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (trigger_type !== undefined) { updates.push('trigger_type = ?'); values.push(trigger_type); }
    if (trigger_config !== undefined) { updates.push('trigger_config = ?'); values.push(JSON.stringify(trigger_config)); }
    if (action_type !== undefined) { updates.push('action_type = ?'); values.push(action_type); }
    if (action_config !== undefined) { updates.push('action_config = ?'); values.push(JSON.stringify(action_config)); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE automations SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Automation updated.' });
  } catch (err) {
    console.error('Update automation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/automations/:id ───────────────────────
router.delete('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM automations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Automation deleted.' });
  } catch (err) {
    console.error('Delete automation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/automations/:id/toggle ─────────────────
router.patch('/:id/toggle', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('UPDATE automations SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Automation toggled.' });
  } catch (err) {
    console.error('Toggle automation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;