const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const pool = require('../config/db');
const whatsappService = require('../utils/whatsappService');

/**
 * POST /send
 * Auth required. Sends a text message via WhatsApp Cloud API (or dev-mode fallback).
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