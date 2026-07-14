const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// ─── Gmail / Google OAuth (graceful no-op when not configured) ───
const googleOAuthClient = (() => {
  const { google } = require('googleapis');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/auth/google/callback';
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
})();

// ─── POST /api/auth/register ───────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { first_name, last_name, email, password, role, language } = req.body;

    // Check for existing user
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered.',
        message_ar: 'البريد الإلكتروني مسجل مسبقاً.',
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role, language)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, email, password_hash, role || 'rep', language || 'en']
    );

    const token = jwt.sign(
      { id: result.insertId, email, role: role || 'rep' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: result.insertId,
          first_name,
          last_name,
          email,
          role: role || 'rep',
          language: language || 'en',
        },
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        message_ar: 'بريد إلكتروني أو كلمة مرور غير صالحة.',
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        message_ar: 'بريد إلكتروني أو كلمة مرور غير صالحة.',
      });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Log login audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address, user_agent)
       VALUES (?, 'user', ?, 'login', ?, ?)`,
      [user.id, user.id, req.ip, req.headers['user-agent'] || null]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          language: user.language,
          territory: user.territory,
        },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, role, language, territory,
              avatar_url, manager_id, is_active, last_login_at, created_at
       FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/auth/profile ─────────────────────────────
router.put('/profile', auth, [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('language').optional().isIn(['en', 'ar']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const allowedFields = ['first_name', 'last_name', 'phone', 'language', 'territory'];
    const updates = [];
    const values = [];

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    values.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/auth/password ────────────────────────────
router.put('/password', auth, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 6 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { current_password, new_password } = req.body;

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
        message_ar: 'كلمة المرور الحالية غير صحيحة.',
      });
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id]);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'user', req.user.id, 'update', req.ip]
    );

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/auth/google ─────────────────────────────
// Kicks off the Gmail OAuth flow. Called from the browser (Settings page),
// so we can't use the standard auth middleware (no Authorization header on
// a top-level GET navigation). Instead, accept the JWT via ?token= and
// decode it to identify the user; pass user_id through Google's `state`.
router.get('/google', async (req, res) => {
  if (!googleOAuthClient) {
    return res.status(503).json({
      success: false,
      message: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in the backend .env.',
    });
  }
  let userId = req.query.userId;
  if (!userId && req.query.token) {
    try {
      const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'crm_dev_secret');
      userId = decoded.id;
    } catch (e) { /* fall through */ }
  }
  if (!userId) return res.status(400).send('Missing user identity (provide ?token= or ?userId=)');
  const url = googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: String(userId),
    prompt: 'consent',
  });
  res.redirect(url);
});

// ─── GET /api/auth/google/callback ────────────────────────
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: userIdStr } = req.query;
    if (!code) return res.status(400).send('Missing code');
    const { tokens } = await googleOAuthClient.getToken(code);
    const oauth2 = require('googleapis').google.oauth2({
      auth: googleOAuthClient,
      version: 'v2',
    });
    googleOAuthClient.setCredentials(tokens);
    const profile = await oauth2.userinfo.get();
    const emailAddress = profile.data.email || null;
    const userId = parseInt(userIdStr, 10) || 0;
    if (!userId) return res.status(400).send('Invalid user state');

    await pool.query(
      `INSERT INTO oauth_tokens (user_id, provider, access_token, refresh_token, token_expires_at, email_address)
       VALUES (?, 'google', ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = VALUES(refresh_token),
         token_expires_at = VALUES(token_expires_at),
         email_address = VALUES(email_address)`,
      [
        userId,
        tokens.access_token || '',
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        emailAddress,
      ]
    );
    res.send('<!DOCTYPE html><html><body><h2>Gmail connected! You can close this tab.</h2></body></html>');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.status(500).send('Google OAuth failed: ' + err.message);
  }
});

// ─── GET /api/auth/microsoft ─────────────────────────────
router.get('/microsoft', auth, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Microsoft Outlook OAuth not yet configured. Set up MSAL credentials and install @azure/msal-node to enable.',
  });
});

// ─── GET /api/auth/oauth/status ──────────────────────────
// Reports which email integrations the current user has connected.
router.get('/oauth/status', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT provider, email_address, created_at FROM oauth_tokens WHERE user_id = ? AND provider IN (?, ?)',
      [req.user.id, 'google', 'microsoft']
    );
    const connected = {};
    rows.forEach((r) => { connected[r.provider] = r.email_address || true; });
    res.json({
      success: true,
      data: {
        google: !!connected.google,
        gmail_email: connected.google || null,
        microsoft: !!connected.microsoft,
        outlook_email: connected.microsoft || null,
        google_available: !!googleOAuthClient,
      },
    });
  } catch (err) {
    console.error('OAuth status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/auth/oauth/sync-emails ─────────────────────
// Pulls recent Gmail messages and logs them as email activities on matching contacts.
router.post('/oauth/sync-emails', auth, async (req, res) => {
  try {
    if (!googleOAuthClient) {
      return res.status(503).json({ success: false, message: 'Google OAuth not configured' });
    }
    const [tokenRow] = await pool.query(
      "SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = 'google' LIMIT 1",
      [req.user.id]
    );
    if (!tokenRow.length) {
      return res.status(400).json({ success: false, message: 'Gmail not connected for this user' });
    }
    googleOAuthClient.setCredentials({
      access_token: tokenRow[0].access_token,
      refresh_token: tokenRow[0].refresh_token,
    });
    const { google } = require('googleapis');
    const gmail = google.gmail({ version: 'v1', auth: googleOAuthClient });
    const list = await gmail.users.messages.list({
      userId: 'me',
      maxResults: parseInt(req.query.limit, 10) || 20,
    });
    const synced = [];
    for (const msg of list.data.messages || []) {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'To', 'Date'] });
      const headers = {};
      (full.data.payload.headers || []).forEach((h) => { headers[h.name] = h.value; });
      const senderEmail = (headers.From || '').match(/<([^>]+)>/) ? (headers.From.match(/<([^>]+)>/)[1]) : (headers.From || '').trim();
      // Match to a contact by email
      const [contact] = await pool.query('SELECT id FROM contacts WHERE email = ? AND is_active = TRUE LIMIT 1', [senderEmail]);
      if (contact.length) {
        await pool.query(
          `INSERT INTO activities (activity_type, subject, content, contact_id, user_id, direction)
           VALUES ('email', ?, ?, ?, ?, 'inbound')`,
          [headers.Subject || '(no subject)', `Synced from Gmail on ${headers.Date || new Date().toISOString()}`, contact[0].id, req.user.id]
        );
        synced.push({ subject: headers.Subject, from: headers.From, contactId: contact[0].id });
      }
    }
    res.json({ success: true, data: { syncedCount: synced.length, items: synced } });
  } catch (err) {
    console.error('Gmail sync error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
