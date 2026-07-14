const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/products ─────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { search, category, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = TRUE';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/products/:id ─────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/products ────────────────────────────────
router.post('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, name_ar, sku, description, description_ar, unit_price, currency, category } = req.body;

    const [result] = await pool.query(
      `INSERT INTO products (name, name_ar, sku, description, description_ar, unit_price, currency, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_ar, sku, description, description_ar, unit_price || 0, currency || 'USD', category]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/products/:id ─────────────────────────────
router.put('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const fields = ['name', 'name_ar', 'sku', 'description', 'description_ar', 'unit_price', 'currency', 'category'];
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
    await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/products/:id ──────────────────────────
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;