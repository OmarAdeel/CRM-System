const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvtojson = require('csvtojson');
const { Parser } = require('json2csv');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'), false);
    }
  },
});

// ─── POST /api/import-export/import/:entityType ────────
router.post('/import/:entityType', auth, upload.single('file'), async (req, res) => {
  try {
    const { entityType } = req.params;
    if (!['contacts', 'companies', 'deals'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const csvData = req.file.buffer.toString('utf-8');
    const jsonArray = await csvtojson().fromString(csvData);

    let imported = 0;
    let errors = 0;

    for (const row of jsonArray) {
      try {
        if (entityType === 'contacts') {
          await pool.query(
            `INSERT INTO contacts (first_name, last_name, email, phone, job_title, company_id, owner_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [row.first_name || row['First Name'], row.last_name || row['Last Name'],
             row.email || row['Email'], row.phone || row['Phone'],
             row.job_title || row['Job Title'], row.company_id || null,
             req.user.id, req.user.id]
          );
        } else if (entityType === 'companies') {
          await pool.query(
            `INSERT INTO companies (name, domain, industry, company_size, phone, website, owner_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [row.name || row['Company Name'], row.domain || row['Domain'],
             row.industry || row['Industry'], row.company_size || row['Company Size'],
             row.phone || row['Phone'], row.website || row['Website'],
             req.user.id, req.user.id]
          );
        }
        imported++;
      } catch (err) {
        console.error(`Import error for row:`, row, err.message);
        errors++;
      }
    }

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, entityType, 0, 'import', req.ip]
    );

    res.json({
      success: true,
      data: { imported, errors, total: jsonArray.length },
      message: `Imported ${imported} of ${jsonArray.length} records.`,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ─── GET /api/import-export/export/:entityType ─────────
router.get('/export/:entityType', auth, async (req, res) => {
  try {
    const { entityType } = req.params;
    if (!['contacts', 'companies', 'deals', 'activities'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type.' });
    }

    let query;
    if (entityType === 'contacts') {
      query = `
        SELECT c.first_name, c.last_name, c.email, c.phone, c.job_title,
               comp.name AS company_name
        FROM contacts c
        LEFT JOIN companies comp ON c.company_id = comp.id
        WHERE c.is_active = TRUE
      `;
    } else if (entityType === 'companies') {
      query = 'SELECT name, domain, industry, company_size, phone, website, city, country FROM companies WHERE is_active = TRUE';
    } else if (entityType === 'deals') {
      query = `
        SELECT d.title, d.value, d.currency, s.name AS stage, d.status,
               d.expected_close_date, c.first_name AS contact_name
        FROM deals d
        LEFT JOIN stages s ON d.stage_id = s.id
        LEFT JOIN contacts c ON d.contact_id = c.id
        WHERE d.status != 'archived'
      `;
    } else {
      query = 'SELECT activity_type, subject, content, created_at FROM activities ORDER BY created_at DESC';
    }

    const [rows] = await pool.query(query);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No data to export.' });
    }

    const parser = new Parser();
    const csv = parser.parse(rows);

    // Audit
    await pool.query(
      'INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, entityType, 0, 'export', req.ip]
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${entityType}-export.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;