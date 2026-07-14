const axios = require('axios');
const pool = require('../config/db');

const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';
const WHATSAPP_TIMEOUT_MS = 10000;

/**
 * Create the whatsapp_logs table on module load if it doesn't already exist.
 */
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED,
      contact_id INT UNSIGNED,
      deal_id INT UNSIGNED,
      to_number VARCHAR(32) NOT NULL,
      message TEXT NOT NULL,
      direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
      status ENUM('sent','delivered','read','failed','dev') NOT NULL DEFAULT 'sent',
      wa_message_id VARCHAR(128),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
      INDEX idx_wa_log_contact (contact_id, created_at)
    ) ENGINE=InnoDB;
  `;
  try {
    await pool.query(sql);
  } catch (err) {
    console.error('[whatsappService] Failed to ensure whatsapp_logs table:', err.message);
  }
}

// Kick off table creation at module load (fire-and-forget).
ensureTable();

/**
 * Returns true if WhatsApp Cloud API credentials are configured.
 */
function isConfigured() {
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN) &&
         Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Insert a row into whatsapp_logs.
 */
async function insertLog({ userId, contactId, dealId, toNumber, message, direction, status, waMessageId }) {
  await pool.query(
    `INSERT INTO whatsapp_logs
      (user_id, contact_id, deal_id, to_number, message, direction, status, wa_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      contactId || null,
      dealId || null,
      toNumber,
      message,
      direction,
      status,
      waMessageId || null,
    ]
  );
}

/**
 * Send a text message via WhatsApp Business Cloud API.
 * Falls back to dev-mode logging when not configured.
 */
async function sendTextMessage({ to, message, userId, contactId, dealId }) {
  const configured = isConfigured();

  if (!configured) {
    console.warn(
      '[whatsappService] Dev mode: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set. ' +
      'Message not actually sent.'
    );
    await insertLog({
      userId,
      contactId,
      dealId,
      toNumber: to,
      message,
      direction: 'outbound',
      status: 'dev',
      waMessageId: null,
    });
    return { success: true, devMode: true, messageId: null };
  }

  const url = `${GRAPH_API_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  };

  try {
    const response = await axios.post(url, body, {
      timeout: WHATSAPP_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const waMessageId =
      (response && response.data && response.data.messages && response.data.messages[0] && response.data.messages[0].id) || null;

    await insertLog({
      userId,
      contactId,
      dealId,
      toNumber: to,
      message,
      direction: 'outbound',
      status: 'sent',
      waMessageId,
    });

    return { success: true, devMode: false, messageId: waMessageId };
  } catch (err) {
    const detail = err.response
      ? JSON.stringify(err.response.data || err.response.status)
      : err.message;
    console.error('[whatsappService] WhatsApp API error:', detail);

    await insertLog({
      userId,
      contactId,
      dealId,
      toNumber: to,
      message,
      direction: 'outbound',
      status: 'failed',
      waMessageId: null,
    });

    return { success: false, devMode: false, messageId: null, error: detail };
  }
}

/**
 * Send a template message via WhatsApp Business Cloud API.
 * Stub — not yet implemented.
 */
async function sendTemplateMessage({ to, templateName, languageCode, templateParams }) {
  throw new Error('Not implemented');
}

/**
 * Verify the Meta webhook verification token for the GET webhook flow.
 */
function verifyWebhookToken(token) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  return Boolean(verifyToken) && token === verifyToken;
}

/**
 * Parse an incoming Meta webhook POST body and return an array of inbound
 * text messages: { from, body, waMessageId, timestamp }
 */
function parseIncoming(payload) {
  const results = [];

  if (!payload || !Array.isArray(payload.entry)) {
    return results;
  }

  for (const entry of payload.entry) {
    if (!entry || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      const value = change && change.value;
      if (!value || !Array.isArray(value.messages)) continue;

      for (const msg of value.messages) {
        if (!msg || msg.type !== 'text') continue;
        const text = msg.text || {};
        results.push({
          from: msg.from,
          body: text.body || '',
          waMessageId: msg.id,
          timestamp: msg.timestamp,
        });
      }
    }
  }

  return results;
}

module.exports = {
  isConfigured,
  sendTextMessage,
  sendTemplateMessage,
  verifyWebhookToken,
  parseIncoming,
};