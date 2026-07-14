const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');
const automationEngine = require('../utils/automationEngine');

// ─── GET /api/deals ────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { status, pipeline_id, stage_id, search, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT d.*, s.name AS stage_name, s.color_hex AS stage_color, s.probability_pct,
             c.first_name AS contact_name, comp.name AS company_name,
             u.first_name AS owner_name,
             DATEDIFF(CURRENT_DATE, COALESCE(d.last_activity_at, d.created_at)) AS days_inactive
      FROM deals d
      LEFT JOIN stages s ON d.stage_id = s.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies comp ON d.company_id = comp.id
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) { query += ' AND d.status = ?'; params.push(status); }
    if (pipeline_id) { query += ' AND d.pipeline_id = ?'; params.push(parseInt(pipeline_id)); }
    if (stage_id) { query += ' AND d.stage_id = ?'; params.push(parseInt(stage_id)); }
    if (search) {
      query += ' AND (d.title LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR comp.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Reps only see their own deals
    if (req.user.role === 'rep') {
      query += ' AND d.owner_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY d.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);

    // Mark rotting deals
    const deals = rows.map(d => ({
      ...d,
      is_rotting: d.status === 'open' && d.days_inactive > (d.rotting_threshold_days || 14),
    }));

    res.json({ success: true, data: deals });
  } catch (err) {
    console.error('Get deals error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/deals/:id ────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, s.name AS stage_name, s.probability_pct, p.name AS pipeline_name,
             c.first_name AS contact_name, comp.name AS company_name,
             u.first_name AS owner_name
      FROM deals d
      LEFT JOIN stages s ON d.stage_id = s.id
      LEFT JOIN pipelines p ON d.pipeline_id = p.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies comp ON d.company_id = comp.id
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found.' });
    }

    // Get deal products
    const [products] = await pool.query(`
      SELECT dp.*, pr.name AS product_name, pr.sku
      FROM deal_products dp
      JOIN products pr ON dp.product_id = pr.id
      WHERE dp.deal_id = ?
    `, [req.params.id]);

    const deal = rows[0];
    deal.products = products;
    deal.total_products_value = products.reduce((sum, p) => sum + parseFloat(p.line_total), 0);

    res.json({ success: true, data: deal });
  } catch (err) {
    console.error('Get deal error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/deals ───────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      title, title_ar, value, currency, pipeline_id, stage_id,
      contact_id, company_id, owner_id, expected_close_date,
      priority, notes, rotting_threshold_days,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO deals (title, title_ar, value, currency, pipeline_id, stage_id,
        contact_id, company_id, owner_id, expected_close_date, priority, notes,
        rotting_threshold_days, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, title_ar, value || 0, currency || 'USD', pipeline_id, stage_id,
        contact_id, company_id, owner_id || req.user.id, expected_close_date,
        priority || 'medium', notes, rotting_threshold_days || 14, req.user.id]
    );

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'deal', result.insertId, 'create', req.ip]
    );

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('deal:created', { id: result.insertId, title });

    // Fire automations: deal_created
    setImmediate(() => automationEngine.evaluateTrigger('deal_created', {
      entity_type: 'deal',
      entity_id: result.insertId,
      deal_id: result.insertId,
      contact_id,
      company_id,
      user_id: req.user.id,
    }, io));

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create deal error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/deals/:id ────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const fields = [
      'title', 'title_ar', 'value', 'currency', 'pipeline_id', 'stage_id',
      'contact_id', 'company_id', 'owner_id', 'expected_close_date',
      'status', 'priority', 'notes', 'loss_reason', 'rotting_threshold_days',
    ];

    const updates = [];
    const values = [];

    for (const key of fields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);

        // Special handling for status changes
        if (key === 'status' && req.body[key] === 'won') {
          updates.push('actual_close_date = CURDATE()');
        }
      }
    }

    // Always update last_activity_at
    updates.push('last_activity_at = NOW()');

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`, values);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'deal', req.params.id, 'update', req.ip]
    );

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('deal:updated', { id: parseInt(req.params.id) });

    res.json({ success: true, message: 'Deal updated.' });
  } catch (err) {
    console.error('Update deal error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/deals/:id/move ─────────────────────────
router.patch('/:id/move', auth, async (req, res) => {
  try {
    const { stage_id } = req.body;

    // Get the stage to check if it's won/lost
    const [stageRows] = await pool.query('SELECT * FROM stages WHERE id = ?', [stage_id]);
    if (stageRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Stage not found.' });
    }

    const stage = stageRows[0];
    const updates = ['stage_id = ?', 'last_activity_at = NOW()'];
    const values = [stage_id];

    if (stage.is_won) {
      updates.push("status = 'won'", 'actual_close_date = CURDATE()');
    } else if (stage.is_lost) {
      updates.push("status = 'lost'");
    }

    values.push(req.params.id);
    await pool.query(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`, values);

    // Emit real-time event
    const io = req.app.get('io');
    io.emit('deal:moved', { id: parseInt(req.params.id), stage_id });

    // Fire automations: deal_stage_changed
    setImmediate(() => automationEngine.evaluateTrigger('deal_stage_changed', {
      entity_type: 'deal',
      entity_id: parseInt(req.params.id),
      deal_id: parseInt(req.params.id),
      new_stage_id: stage_id,
      new_stage_name: stage.name,
      user_id: req.user.id,
    }, io));

    res.json({ success: true, message: 'Deal moved.', data: { stage } });
  } catch (err) {
    console.error('Move deal error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/deals/:id ─────────────────────────────
router.delete('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query("UPDATE deals SET status = 'archived' WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Deal archived.' });
  } catch (err) {
    console.error('Delete deal error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/deals/:id/products ──────────────────────
router.post('/:id/products', auth, async (req, res) => {
  try {
    const { product_id, quantity, unit_price } = req.body;

    await pool.query(
      'INSERT INTO deal_products (deal_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?, unit_price = ?',
      [req.params.id, product_id, quantity || 1, unit_price, quantity || 1, unit_price]
    );

    res.status(201).json({ success: true, message: 'Product added to deal.' });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/deals/:id/products/:productId ─────────
router.delete('/:id/products/:productId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM deal_products WHERE deal_id = ? AND product_id = ?',
      [req.params.id, req.params.productId]);
    res.json({ success: true, message: 'Product removed from deal.' });
  } catch (err) {
    console.error('Remove product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
