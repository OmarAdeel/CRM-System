const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// ─── GET /api/notifications ───────────────────────────
// Returns the current user's notifications (newest first).
// ?unread=1 returns only unread notifications.
router.get('/', auth, async (req, res) => {
  try {
    const { unread } = req.query;
    const params = [req.user.id];

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    if (unread === '1' || unread === 'true') {
      query += ' AND is_read = 0';
    }
    query += ' ORDER BY created_at DESC LIMIT 50';

    const [rows] = await pool.query(query, params);

    // Unread count for badge
    const [[{ unread_count }]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({ success: true, data: rows, unread_count });
  } catch (err) {
    console.error('Notifications list error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/notifications/unread-count ───────────────
router.get('/unread-count', auth, async (req, res) => {
  try {
    const [[{ unread_count }]] = await pool.query(
      'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, unread_count });
  } catch (err) {
    console.error('Notifications unread-count error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/notifications/:id/read ─────────────────
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/notifications/read-all ─────────────────
router.patch('/read-all', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, message: 'All marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/notifications/:id ─────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;