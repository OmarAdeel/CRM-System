// ============================================================
// Email Service — SMTP send + open/click tracking
// CommonJS module. Uses nodemailer (already a project dep).
// ============================================================

const nodemailer = require('nodemailer');
const pool = require('../config/db');

// --- Transparent 1x1 GIF (43 bytes) used for open tracking pixel ---
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// --- Base URL used to build tracking URLs ---
const BASE_URL =
  process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`;

// --- Cached nodemailer transport (created once) ---
let transport = null;

/**
 * Returns true if SMTP_HOST is configured (production sending mode).
 */
function isConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

/**
 * Returns a cached nodemailer transport, creating it on first use.
 * In dev mode (no SMTP_HOST) returns null.
 */
function getTransport() {
  if (transport) return transport;
  if (!isConfigured()) return null;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: (parseInt(process.env.SMTP_PORT, 10) || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transport;
}

/**
 * Ensure the email_logs table exists. Called once at module load
 * and safe to call again (CREATE TABLE IF NOT EXISTS).
 */
async function ensureEmailLogsTable() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS email_logs (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      contact_id INT UNSIGNED,
      deal_id INT UNSIGNED,
      to_email VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      body TEXT,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME,
      clicked_at DATETIME,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
      INDEX idx_email_log_user (user_id, sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try {
    await pool.query(ddl);
  } catch (err) {
    // Defer fatal errors to first send attempt rather than crashing module load.
    console.error('emailService: failed to ensure email_logs table:', err.message);
  }
}

// Kick off table creation at module load (fire-and-forget).
ensureEmailLogsTable();

/**
 * Insert a row into email_logs and return its id.
 */
async function insertLog({
  userId,
  contactId,
  dealId,
  toEmail,
  subject,
  body,
}) {
  const [result] = await pool.query(
    `INSERT INTO email_logs
       (user_id, contact_id, deal_id, to_email, subject, body)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      contactId || null,
      dealId || null,
      toEmail,
      subject || null,
      body || null,
    ]
  );
  return result.insertId;
}

/**
 * Send an email via nodemailer, with optional open/click tracking.
 *
 * @param {Object} opts
 * @param {string} opts.to        recipient address
 * @param {string} opts.subject   subject line
 * @param {string} [opts.html]    HTML body
 * @param {string} [opts.text]    plain-text fallback
 * @param {string} [opts.from]    override sender
 * @param {number} [opts.contactId]
 * @param {number} [opts.dealId]
 * @param {number} [opts.userId]
 * @param {boolean} [opts.track=true]  wrap tracking pixel + link rewriting
 * @returns {Promise<{ messageId: string|null, devMode: boolean, id: number|null }>}
 */
async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  contactId,
  dealId,
  userId,
  track = true,
}) {
  const sender = from || process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost';

  // 1. Create an email_logs row up-front so we have an id for tracking,
  //    regardless of whether sending succeeds.
  const logId = await insertLog({
    userId,
    contactId,
    dealId,
    toEmail: to,
    subject,
    body: html || text || '',
  });

  let finalHtml = html;
  if (track && finalHtml) {
    finalHtml = wrapTracking(finalHtml, logId);
  }

  // 2. Dev mode: just log instead of sending.
  if (!isConfigured()) {
    console.log('────────── EMAIL (dev mode — SMTP not configured) ──────────');
    console.log('From:    ', sender);
    console.log('To:      ', to);
    console.log('Subject: ', subject);
    console.log('Text:    ', text || '(no plain text body)');
    if (finalHtml) console.log('HTML:    ', finalHtml);
    console.log('emailLogId:', logId);
    console.log('-------------------------------------------------------------');
    return { messageId: null, devMode: true, id: logId };
  }

  // 3. Production send.
  const t = getTransport();
  const info = await t.sendMail({
    from: sender,
    to,
    subject,
    html: finalHtml,
    text: text,
  });

  return { messageId: info.messageId, devMode: false, id: logId };
}

/**
 * Inject open-tracking pixel and rewrite anchor links through click tracker.
 *
 * @param {string} html  original HTML body
 * @param {number} emailLogId
 * @returns {string} modified HTML
 */
function wrapTracking(html, emailLogId) {
  let out = html;

  // Rewrite <a href="http(s)://..."> links to route through the click tracker.
  // Capture the original URL and pass it as ?u=<encoded>.
  out = out.replace(
    /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>/gi,
    (match, pre, url, post) => {
      const tracked = `${BASE_URL}/api/email/track/click/${emailLogId}?u=${encodeURIComponent(url)}`;
      return `<a ${pre}href="${tracked}"${post}>`;
    }
  );

  // Inject tracking pixel before </body>, otherwise append at end.
  const pixel = `<img src="${BASE_URL}/api/email/track/open/${emailLogId}" width="1" height="1" alt="" style="display:none;" />`;
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${pixel}</body>`);
  } else {
    out = out + pixel;
  }

  return out;
}

module.exports = {
  sendEmail,
  wrapTracking,
  getTransport,
  isConfigured,
  ensureEmailLogsTable,
  PIXEL,
  BASE_URL,
};