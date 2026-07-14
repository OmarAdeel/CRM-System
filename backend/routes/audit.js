const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/audit ────────────────────────────────────
router.get('/', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { entity_type, action, user_id, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT al.*, u.first_name AS user_name, u.last_name AS user_last_name, u.email AS user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) { query += ' AND al.entity_type = ?'; params.push(entity_type); }
    if (action) { query += ' AND al.action = ?'; params.push(action); }
    if (user_id) { query += ' AND al.user_id = ?'; params.push(parseInt(user_id)); }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) AS total FROM audit_logs al WHERE 1=1';
    const countParams = [];
    if (entity_type) { countQuery += ' AND al.entity_type = ?'; countParams.push(entity_type); }
    if (action) { countQuery += ' AND al.action = ?'; countParams.push(action); }
    if (user_id) { countQuery += ' AND al.user_id = ?'; countParams.push(parseInt(user_id)); }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: { total: countResult[0].total, limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;