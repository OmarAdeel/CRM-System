const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');
const whatsappService = require('../utils/whatsappService');

/**
 * GET /conversations
 * Auth required. Returns a list of conversation threads (one per contact/number),
 * each with the latest message, counts, and unread (inbound since last outbound) count.
 * This powers the in-app WhatsApp-style Messages tab without any paid WhatsApp API.
 */
router.get('/conversations', auth, async (req, res) => {
  try {
    // Group by contact_id when available, otherwise by to_number.
    const [rows] = await pool.query(`
      SELECT
        c.id            AS contact_id,
        c.first_name,
        c.last_name,
        c.first_name_ar,
        c.last_name_ar,
        c.phone,
        c.email,
        comp.name        AS company_name,
        comp.name_ar     AS company_name_ar,
        latest.message   AS last_message,
        latest.direction  AS last_direction,
        latest.created_at AS last_at,
        stats.total_msgs,
        stats.inbound_msgs
      FROM (
        SELECT
          COALESCE(contact_id, 0) AS cid,
          MAX(id) AS max_id
        FROM whatsapp_logs
        GROUP BY COALESCE(contact_id, 0)
      ) AS g
      JOIN whatsapp_logs latest ON latest.id = g.max_id
      LEFT JOIN contacts c ON c.id = g.cid
      LEFT JOIN companies comp ON comp.id = c.company_id
      LEFT JOIN (
        SELECT
          COALESCE(contact_id, 0) AS cid,
          COUNT(*) AS total_msgs,
          SUM(CASE WHEN direction='inbound' THEN 1 ELSE 0 END) AS inbound_msgs
        FROM whatsapp_logs
        GROUP BY COALESCE(contact_id, 0)
      ) stats ON stats.cid = g.cid
      ORDER BY latest.created_at DESC
      LIMIT 100
    `);

    // Compute unread: inbound messages created after the most recent outbound message
    // in each thread (a simple proxy for "new since I last replied").
    const conversations = [];
    for (const r of rows) {
      let unread = 0;
      if (r.contact_id) {
        const [[ub]] = await pool.query(
          `SELECT MAX(created_at) AS last_outbound_at
             FROM whatsapp_logs
            WHERE contact_id = ? AND direction = 'outbound'`,
          [r.contact_id]
        );
        if (ub && ub.last_outbound_at) {
          const [[uc]] = await pool.query(
            `SELECT COUNT(*) AS cnt FROM whatsapp_logs
              WHERE contact_id = ? AND direction = 'inbound'
                AND created_at > ?`,
            [r.contact_id, ub.last_outbound_at]
          );
          unread = uc ? Number(uc.cnt) : 0;
        } else {
          const [[uc]] = await pool.query(
            `SELECT COUNT(*) AS cnt FROM whatsapp_logs
              WHERE contact_id = ? AND direction = 'inbound'`,
            [r.contact_id]
          );
          unread = uc ? Number(uc.cnt) : 0;
        }
      }
      conversations.push({
        contact_id: r.contact_id || null,
        first_name: r.first_name,
        last_name: r.last_name,
        first_name_ar: r.first_name_ar,
        last_name_ar: r.last_name_ar,
        phone: r.phone || null,
        email: r.email || null,
        company_name: r.company_name,
        company_name_ar: r.company_name_ar,
        last_message: r.last_message,
        last_direction: r.last_direction,
        last_at: r.last_at,
        total_messages: Number(r.total_msgs || 0),
        inbound_count: Number(r.inbound_msgs || 0),
        unread,
      });
    }

    return res.status(200).json({ success: true, data: conversations });
  } catch (err) {
    console.error('[whatsapp:conversations] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * PATCH /mark-read/:contactId
 * Auth required. Marks all inbound messages from a contact as read (status='read').
 */
router.patch('/mark-read/:contactId', auth, async (req, res) => {
  try {
    await pool.query(
      `UPDATE whatsapp_logs SET status = 'read'
        WHERE contact_id = ? AND direction = 'inbound'`,
      [req.params.contactId]
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[whatsapp:mark-read] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * POST /simulate-inbound
 * Auth required. FREE dev-mode only: creates an inbound message in the database
 * without calling any paid WhatsApp API. Useful for demos and local testing.
 * Emits a 'whatsapp:received' socket event for real-time UI updates.
 */
router.post('/simulate-inbound', auth, async (req, res) => {
  try {
    const { contact_id, message } = req.body;
    if (!contact_id || !message) {
      return res.status(400).json({
        success: false,
        message: '`contact_id` and `message` are required.',
      });
    }

    const [cRows] = await pool.query(
      'SELECT id, phone, first_name, last_name FROM contacts WHERE id = ?',
      [contact_id]
    );
    if (cRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }
    const contact = cRows[0];
    const fromNumber = contact.phone || 'unknown';

    await pool.query(
      `INSERT INTO whatsapp_logs
        (contact_id, to_number, message, direction, status, wa_message_id)
       VALUES (?, ?, ?, 'inbound', 'read', ?)`,
      [contact_id, fromNumber, message, `sim_${Date.now()}`]
    );

    // Also log an inbound activity for completeness.
    await pool.query(
      `INSERT INTO activities
        (activity_type, subject, content, contact_id, user_id, direction)
       VALUES ('whatsapp', ?, ?, ?, ?, 'inbound')`,
      [
        `WhatsApp from ${contact.first_name} ${contact.last_name}`,
        message,
        contact_id,
        req.user ? req.user.id : null,
      ]
    );

    const io = req.app.get('io');
    if (io && typeof io.emit === 'function') {
      io.emit('whatsapp:received', { contactId: Number(contact_id), body: message, from: fromNumber });
    }

    return res.status(200).json({
      success: true,
      data: { contact_id: Number(contact_id), message, from: fromNumber },
    });
  } catch (err) {
    console.error('[whatsapp:simulate-inbound] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * POST /send
 * Auth required. Sends a text message via WhatsApp Cloud API (or dev-mode fallback).
 * Always emits a 'whatsapp:sent' socket event for real-time UI updates.
 */
router.post('/send', auth, async (req, res) => {
  try {
    const { to, message, contact_id, deal_id } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: '`to` and `message` are required.',
      });
    }

    const result = await whatsappService.sendTextMessage({
      to,
      message,
      userId: req.user ? req.user.id : null,
      contactId: contact_id,
      dealId: deal_id,
    });

    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: 'WhatsApp API call failed.',
        error: result.error,
      });
    }

    // Real-time update for the Messages tab.
    const io = req.app.get('io');
    if (io && typeof io.emit === 'function') {
      io.emit('whatsapp:sent', { contactId: contact_id || null, body: message, to });
    }

    return res.status(200).json({
      success: true,
      data: {
        devMode: result.devMode,
        messageId: result.messageId,
      },
    });
  } catch (err) {
    console.error('[whatsapp:send] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * GET /history/:contactId
 * Auth required. Returns recent whatsapp_logs for a contact.
 */
router.get('/history/:contactId', auth, async (req, res) => {
  try {
    const { contactId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM whatsapp_logs
       WHERE contact_id = ?
       ORDER BY created_at ASC
       LIMIT 100`,
      [contactId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[whatsapp:history] error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

/**
 * GET /status
 * Auth required. Returns whether WhatsApp is configured.
 */
router.get('/status', auth, (req, res) => {
  return res.status(200).json({ configured: whatsappService.isConfigured() });
});

/**
 * GET /webhook
 * NO auth. Meta webhook verification flow.
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && whatsappService.verifyWebhookToken(token)) {
    return res.status(200).send(challenge);
  }
  return res.status(403).send('Forbidden');
});

/**
 * POST /webhook
 * NO auth. Receives inbound WhatsApp events from Meta.
 * Always responds 200 to avoid Meta retries.
 */
router.post('/webhook', async (req, res) => {
  try {
    const inbound = whatsappService.parseIncoming(req.body);
    const io = req.app.get('io');

    for (const msg of inbound) {
      await pool.query(
        `INSERT INTO whatsapp_logs
          (to_number, message, direction, status, wa_message_id)
         VALUES (?, ?, 'inbound', 'read', ?)`,
        [msg.from, msg.body, msg.waMessageId]
      );

      let contactId = null;
      try {
        const [rows] = await pool.query(
          'SELECT id FROM contacts WHERE phone = ? LIMIT 1',
          [msg.from]
        );
        if (rows.length > 0) contactId = rows[0].id;
      } catch (_) {
        // ignore lookup failure
      }

      if (io && typeof io.emit === 'function') {
        io.emit('whatsapp:received', {
          from: msg.from,
          body: msg.body,
          contactId,
        });
      }
    }
  } catch (err) {
    console.error('[whatsapp:webhook POST] error:', err);
  }

  return res.status(200).json({ received: true });
});

module.exports = router;