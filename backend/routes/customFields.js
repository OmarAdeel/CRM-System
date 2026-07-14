const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/custom-fields ────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { entity_type } = req.query;
    let query = 'SELECT * FROM custom_fields WHERE is_active = TRUE';
    const params = [];

    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }

    query += ' ORDER BY sort_order ASC';

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get custom fields error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/custom-fields ───────────────────────────
router.post('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { entity_type, field_name, field_label, field_label_ar, field_type, field_options, is_required, sort_order } = req.body;

    const [result] = await pool.query(
      `INSERT INTO custom_fields (entity_type, field_name, field_label, field_label_ar, field_type, field_options, is_required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_type, field_name, field_label, field_label_ar, field_type, JSON.stringify(field_options || []), is_required || false, sort_order || 0]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A field with this name already exists for this entity.' });
    }
    console.error('Create custom field error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/custom-fields/:id ────────────────────────
router.put('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { field_label, field_label_ar, field_type, field_options, is_required, sort_order } = req.body;
    const updates = [];
    const values = [];

    if (field_label !== undefined) { updates.push('field_label = ?'); values.push(field_label); }
    if (field_label_ar !== undefined) { updates.push('field_label_ar = ?'); values.push(field_label_ar); }
    if (field_type !== undefined) { updates.push('field_type = ?'); values.push(field_type); }
    if (field_options !== undefined) { updates.push('field_options = ?'); values.push(JSON.stringify(field_options)); }
    if (is_required !== undefined) { updates.push('is_required = ?'); values.push(is_required); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE custom_fields SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Custom field updated.' });
  } catch (err) {
    console.error('Update custom field error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/custom-fields/:id ─────────────────────
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE custom_fields SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Custom field deactivated.' });
  } catch (err) {
    console.error('Delete custom field error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/custom-fields/values ────────────────────
router.post('/values', auth, async (req, res) => {
  try {
    const { custom_field_id, entity_type, entity_id, value } = req.body;

    await pool.query(
      `INSERT INTO custom_field_values (custom_field_id, entity_type, entity_id, value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = ?`,
      [custom_field_id, entity_type, entity_id, value, value]
    );

    res.json({ success: true, message: 'Custom field value saved.' });
  } catch (err) {
    console.error('Save custom field value error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;