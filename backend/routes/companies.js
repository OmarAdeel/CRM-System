const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth, authorize } = require('../middleware/auth');

// ─── GET /api/companies ────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { search, industry, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM companies WHERE is_active = TRUE';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR domain LIKE ? OR city LIKE ? OR country LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (industry) {
      query += ' AND industry = ?';
      params.push(industry);
    }

    // Reps only see their own companies
    if (req.user.role === 'rep') {
      query += ' AND owner_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/companies/:id ────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    // Get contacts for this company
    const [contacts] = await pool.query(
      'SELECT id, first_name, last_name, email, phone, job_title FROM contacts WHERE company_id = ? AND is_active = TRUE ORDER BY is_primary_contact DESC',
      [req.params.id]
    );

    const company = rows[0];
    company.contacts = contacts;

    res.json({ success: true, data: company });
  } catch (err) {
    console.error('Get company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/companies ───────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const {
      name, name_ar, domain, industry, company_size, annual_revenue,
      website, phone, address_line1, address_line2, city, state,
      country, postal_code, linkedin_url, description, description_ar, owner_id,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO companies (name, name_ar, domain, industry, company_size, annual_revenue,
        website, phone, address_line1, address_line2, city, state, country, postal_code,
        linkedin_url, description, description_ar, owner_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name_ar, domain, industry, company_size, annual_revenue,
        website, phone, address_line1, address_line2, city, state, country, postal_code,
        linkedin_url, description, description_ar, owner_id || req.user.id, req.user.id]
    );

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'company', result.insertId, 'create', req.ip]
    );

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error('Create company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PUT /api/companies/:id ────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const fields = [
      'name', 'name_ar', 'domain', 'industry', 'company_size', 'annual_revenue',
      'website', 'phone', 'address_line1', 'address_line2', 'city', 'state',
      'country', 'postal_code', 'linkedin_url', 'description', 'description_ar', 'owner_id',
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

    values.push(req.params.id);
    await pool.query(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, values);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'company', req.params.id, 'update', req.ip]
    );

    res.json({ success: true, message: 'Company updated.' });
  } catch (err) {
    console.error('Update company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── DELETE /api/companies/:id ─────────────────────────
router.delete('/:id', auth, authorize('admin', 'manager'), async (req, res) => {
  try {
    await pool.query('UPDATE companies SET is_active = FALSE WHERE id = ?', [req.params.id]);
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'company', req.params.id, 'delete', req.ip]
    );
    res.json({ success: true, message: 'Company deactivated.' });
  } catch (err) {
    console.error('Delete company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/companies/:id/enrich ────────────────────
router.post('/:id/enrich', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    const ai = require('../utils/openai');
    const enrichment = await ai.enrichCompany(rows[0]);

    const allowedFields = ['logo_url', 'website', 'industry', 'company_size', 'description', 'enrichment_source', 'enrichment_date'];
    const updates = [];
    const values = [];
    for (const key of allowedFields) {
      if (enrichment[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(enrichment[key]);
      }
    }
    if (updates.length > 0) {
      values.push(req.params.id);
      await pool.query(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'company', req.params.id, 'update', req.ip]
    );

    res.json({ success: true, data: enrichment });
  } catch (err) {
    console.error('Enrich company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
