// ============================================================
// Email routes — send + open/click tracking + logs
// ============================================================

const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const pool = require('../config/db');
const emailService = require('../utils/emailService');

// Transparent 1x1 GIF returned by the open-tracking endpoint.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * POST /api/email/send
 * Body: { to, subject, body, contact_id, deal_id, track (default true) }
 * Auth required.
 */
router.post('/send', auth, async (req, res) => {
  try {
    const {
      to,
      subject,
      body,
      contact_id,
      deal_id,
      track = true,
    } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        message: '`to` and `subject` are required.',
      });
    }

    const result = await emailService.sendEmail({
      to,
      subject,
      html: body,
      from: process.env.SMTP_FROM,
      contactId: contact_id,
      dealId: deal_id,
      userId: req.user.id,
      track: track !== false,
    });

    return res.json({
      success: true,
      data: {
        id: result.id,
        messageId: result.messageId,
        devMode: result.devMode,
      },
    });
  } catch (err) {
    console.error('POST /api/email/send error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send email.',
      error: err.message,
    });
  }
});

/**
 * GET /api/email/track/open/:id
 * Public (no auth) — invoked by email client loading the tracking pixel.
 * Marks the email as read and returns a 1x1 transparent GIF.
 */
router.get('/track/open/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isFinite(id) && id > 0) {
      await pool.query(
        'UPDATE email_logs SET is_read = 1, read_at = NOW() WHERE id = ? AND is_read = 0',
        [id]
      );
    }
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    });
    return res.status(200).send(PIXEL);
  } catch (err) {
    // Still return the pixel on error so the client rendering isn't disturbed.
    console.error('GET /track/open error:', err.message);
    res.set('Content-Type', 'image/gif');
    return res.status(200).send(PIXEL);
  }
});

/**
 * GET /api/email/track/click/:id?u=<encoded url>
 * Public (no auth). Records the click and 302-redirects to the original URL.
 */
router.get('/track/click/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const target = req.query.u ? decodeURIComponent(req.query.u) : '/';

  try {
    if (Number.isFinite(id) && id > 0) {
      // Only stamp clicked_at on the first click.
      await pool.query(
        'UPDATE email_logs SET clicked_at = NOW() WHERE id = ? AND clicked_at IS NULL',
        [id]
      );
    }
  } catch (err) {
    console.error('GET /track/click error:', err.message);
  }

  return res.redirect(302, target);
});

/**
 * GET /api/email/logs
 * Auth required. Returns recent email logs for the authenticated user.
 */
router.get('/logs', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, contact_id, deal_id, to_email, subject,
              is_read, read_at, clicked_at, sent_at
         FROM email_logs
        WHERE user_id = ?
        ORDER BY sent_at DESC
        LIMIT 50`,
      [req.user.id]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/email/logs error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch email logs.',
      error: err.message,
    });
  }
});

/**
 * GET /api/email/logs/:id
 * Auth required. Returns a single email log by id (must belong to the user).
 */
router.get('/logs/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }

    const [rows] = await pool.query(
      `SELECT id, user_id, contact_id, deal_id, to_email, subject, body,
              is_read, read_at, clicked_at, sent_at
         FROM email_logs
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Email log not found.' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('GET /api/email/logs/:id error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch email log.',
      error: err.message,
    });
  }
});

module.exports = router;