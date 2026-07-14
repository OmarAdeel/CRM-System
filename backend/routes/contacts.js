const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');
const automationEngine = require('../utils/automationEngine');

// ─── GET /api/contacts ─────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { search, company_id, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT c.*, comp.name AS company_name
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.is_active = TRUE
    `;
    const params = [];

    if (search) {
      query += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (company_id) {
      query += ' AND c.company_id = ?';
      params.push(parseInt(company_id));
    }

    // Reps only see their own contacts
    if (req.user.role === 'rep') {
      query += ' AND c.owner_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/contacts/duplicates ──────────────────────
router.get('/duplicates', auth, async (req, res) => {
  try {
    // Find contacts with same email
    const [rows] = await pool.query(`
      SELECT email, COUNT(*) as count, GROUP_CONCAT(id) as ids,
             GROUP_CONCAT(CONCAT(first_name, ' ', last_name)) as names
      FROM contacts
      WHERE email IS NOT NULL AND email != '' AND is_active = TRUE
      GROUP BY email
      HAVING COUNT(*) > 1
      LIMIT 20
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Find duplicates error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/contacts/:id ─────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, comp.name AS company_name, comp.industry AS company_industry
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get contact error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/contacts ────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      first_name, last_name, first_name_ar, last_name_ar,
      email, email_alt, phone, phone_alt, mobile,
      job_title, job_title_ar, department, company_id,
      is_primary_contact, linkedin_url, notes,
      lead_source, language_preference, owner_id,
    } = req.body;

    // Check for duplicate by email
    if (email) {
      const [dup] = await pool.query(
        'SELECT id, first_name, last_name FROM contacts WHERE email = ? AND is_active = TRUE',
        [email]
      );
      if (dup.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A contact with this email already exists.',
          duplicate: dup[0],
        });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO contacts (first_name, last_name, first_name_ar, last_name_ar,
        email, email_alt, phone, phone_alt, mobile, job_title, job_title_ar,
        department, company_id, is_primary_contact, linkedin_url, notes,
        lead_source, language_preference, owner_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [first_name, last_name, first_name_ar, last_name_ar,
        email, email_alt, phone, phone_alt, mobile, job_title, job_title_ar,
        department, company_id, is_primary_contact || false, linkedin_url, notes,
        lead_source, language_preference || 'en', owner_id || req.user.id, req.user.id]
    );

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'contact', result.insertId, 'create', req.ip]
    );

    // Fire automations: contact_created (smart routing, etc.)
    const io = req.app && req.app.get ? req.app.get('io') : null;
    setImmediate(() => automationEngine.evaluateTrigger('contact_created', {
      entity_type: 'contact',
      entity_id: result.insertId,
      contact_id: result.insertId,
      company_id,
      user_id: req.user.id,
      language_preference: language_preference || 'en',
    }, io));

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create contact error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/contacts/:id ─────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const fields = [
      'first_name', 'last_name', 'first_name_ar', 'last_name_ar',
      'email', 'email_alt', 'phone', 'phone_alt', 'mobile',
      'job_title', 'job_title_ar', 'department', 'company_id',
      'is_primary_contact', 'linkedin_url', 'notes',
      'lead_source', 'language_preference', 'owner_id',
    ];

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

    // Update last_contacted_at if relevant fields change
    if (req.body.email || req.body.phone) {
      updates.push('last_contacted_at = NOW()');
    }

    values.push(req.params.id);
    await pool.query(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`, values);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'contact', req.params.id, 'update', req.ip]
    );

    res.json({ success: true, message: 'Contact updated.' });
  } catch (err) {
    console.error('Update contact error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/contacts/:id ──────────────────────────
router.delete('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('UPDATE contacts SET is_active = FALSE WHERE id = ?', [req.params.id]);
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'contact', req.params.id, 'delete', req.ip]
    );
    res.json({ success: true, message: 'Contact deactivated.' });
  } catch (err) {
    console.error('Delete contact error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/contacts/:id/enrich ─────────────────────
router.post('/:id/enrich', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, comp.name AS company_name, comp.industry AS company_industry,
             comp.company_size, comp.domain AS company_domain
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    const ai = require('../utils/openai');
    const enrichment = await ai.enrichContact(rows[0]);

    if (enrichment.lead_score !== undefined) {
      await pool.query('UPDATE contacts SET lead_score = ? WHERE id = ?', [enrichment.lead_score, req.params.id]);
    }

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'contact', req.params.id, 'update', req.ip]
    );

    res.json({
      success: true,
      data: {
        lead_score: enrichment.lead_score,
        reasoning: enrichment._scoring_reasoning,
        source: ai.HAS_OPENAI ? 'openai' : 'heuristic',
      },
    });
  } catch (err) {
    console.error('Enrich contact error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/contacts/merge ──────────────────────────
router.post('/merge', auth, async (req, res) => {
  try {
    const { primary_id, secondary_id } = req.body;

    // Move all activities from secondary to primary
    await pool.query('UPDATE activities SET contact_id = ? WHERE contact_id = ?', [primary_id, secondary_id]);

    // Move deals
    await pool.query('UPDATE deals SET contact_id = ? WHERE contact_id = ?', [primary_id, secondary_id]);

    // Deactivate secondary
    await pool.query('UPDATE contacts SET is_active = FALSE WHERE id = ?', [secondary_id]);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, new_value, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'contact', primary_id, 'merge', `Merged contact ${secondary_id}`, req.ip]
    );

    res.json({ success: true, message: 'Contacts merged successfully.' });
  } catch (err) {
    console.error('Merge contacts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
