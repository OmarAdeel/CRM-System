const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const ai = require('../utils/openai');

// ─── GET /api/ai/recommendations ───────────────────────
router.get('/recommendations', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT ar.*, d.title AS deal_title, c.first_name AS contact_name
      FROM ai_recommendations ar
      LEFT JOIN deals d ON ar.deal_id = d.id
      LEFT JOIN contacts c ON ar.contact_id = c.id
      WHERE ar.is_dismissed = FALSE
      ORDER BY ar.priority_score DESC
      LIMIT 10
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get AI recommendations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── PATCH /api/ai/recommendations/:id/dismiss ─────────
router.patch('/recommendations/:id/dismiss', auth, async (req, res) => {
  try {
    await pool.query('UPDATE ai_recommendations SET is_dismissed = TRUE WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Recommendation dismissed.' });
  } catch (err) {
    console.error('Dismiss recommendation error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/draft-email ──────────────────────────
router.post('/draft-email', auth, async (req, res) => {
  try {
    const { deal_id, contact_id, language, tone, context } = req.body;

    // Fetch contact info (with company join)
    let contact = {};
    if (contact_id) {
      const [rows] = await pool.query(`
        SELECT c.*, comp.name AS company_name, comp.industry AS company_industry
        FROM contacts c LEFT JOIN companies comp ON c.company_id = comp.id
        WHERE c.id = ?
      `, [contact_id]);
      if (rows.length > 0) contact = rows[0];
    }

    // Fetch deal info
    let deal = null;
    if (deal_id) {
      const [rows] = await pool.query(`
        SELECT d.*, s.name AS stage_name FROM deals d
        LEFT JOIN stages s ON d.stage_id = s.id WHERE d.id = ?
      `, [deal_id]);
      if (rows.length > 0) deal = rows[0];
    }

    const draft = await ai.draftEmail({
      contact,
      deal,
      language: language || 'en',
      tone: tone || 'professional',
      context: context || '',
    });

    res.json({ success: true, data: draft });
  } catch (err) {
    console.error('Draft email error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/score-lead/:contactId ───────────────
router.post('/score-lead/:contactId', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, comp.name AS company_name, comp.industry AS company_industry,
             comp.company_size AS company_size
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `, [req.params.contactId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    const { score, reasoning } = await ai.scoreLead(rows[0]);
    await pool.query('UPDATE contacts SET lead_score = ? WHERE id = ?', [score, req.params.contactId]);

    res.json({ success: true, data: { lead_score: score, reasoning } });
  } catch (err) {
    console.error('Score lead error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/translate ────────────────────────────
router.post('/translate', auth, async (req, res) => {
  try {
    const { text, target_language } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required.' });
    }
    const translated = await ai.translate(text, target_language || 'ar');
    res.json({ success: true, data: { translated_text: translated, target_language } });
  } catch (err) {
    console.error('Translate error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/enrich-contact/:contactId ───────────
router.post('/enrich-contact/:contactId', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, comp.name AS company_name, comp.industry AS company_industry,
             comp.company_size, comp.domain AS company_domain
      FROM contacts c
      LEFT JOIN companies comp ON c.company_id = comp.id
      WHERE c.id = ?
    `, [req.params.contactId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    const enrichment = await ai.enrichContact(rows[0]);

    // Update contact lead score
    if (enrichment.lead_score !== undefined) {
      await pool.query('UPDATE contacts SET lead_score = ? WHERE id = ?', [enrichment.lead_score, req.params.contactId]);
    }

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

// ─── POST /api/ai/enrich-company/:companyId ───────────
router.post('/enrich-company/:companyId', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.companyId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    const company = rows[0];
    const enrichment = await ai.enrichCompany(company);

    // Build update query from enrichment data
    const updates = [];
    const values = [];
    const allowedFields = ['logo_url', 'website', 'industry', 'company_size', 'description', 'enrichment_source', 'enrichment_date'];

    for (const key of allowedFields) {
      if (enrichment[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(enrichment[key]);
      }
    }

    if (updates.length > 0) {
      values.push(req.params.companyId);
      await pool.query(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    res.json({
      success: true,
      data: { enrichment, source: ai.HAS_OPENAI ? 'openai+clearbit' : 'clearbit' },
    });
  } catch (err) {
    console.error('Enrich company error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/generate-summary/:dealId ────────────
router.post('/generate-summary/:dealId', auth, async (req, res) => {
  try {
    const [dealRows] = await pool.query(`
      SELECT d.*, s.name AS stage_name, c.first_name AS contact_name,
             comp.name AS company_name
      FROM deals d
      LEFT JOIN stages s ON d.stage_id = s.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN companies comp ON d.company_id = comp.id
      WHERE d.id = ?
    `, [req.params.dealId]);

    if (dealRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Deal not found.' });
    }

    const [activities] = await pool.query(
      'SELECT * FROM activities WHERE deal_id = ? ORDER BY created_at DESC LIMIT 10',
      [req.params.dealId]
    );

    const summary = await ai.generateDealSummary(dealRows[0], activities);

    res.json({ success: true, data: { summary, source: ai.HAS_OPENAI ? 'openai' : 'heuristic' } });
  } catch (err) {
    console.error('Generate summary error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/ai/scan-stagnant ────────────────────────
// Can be called manually or by the scheduler
router.post('/scan-stagnant', auth, async (req, res) => {
  try {
    const recommendations = await ai.scanStagnantDeals();
    res.json({
      success: true,
      data: { recommendations_created: recommendations.length, recommendations },
    });
  } catch (err) {
    console.error('Scan stagnant error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/ai/status ───────────────────────────────
router.get('/status', auth, async (req, res) => {
  res.json({
    success: true,
    data: {
      openai_enabled: ai.HAS_OPENAI,
      provider: ai.PROVIDER_LABEL,
      model: ai.DEFAULT_MODEL,
      message: ai.HAS_OPENAI
        ? `AI integration is active (${ai.PROVIDER_LABEL}).`
        : 'OpenAI API key not configured. Using heuristic fallbacks for all AI features.',
    },
  });
});

// ─── POST /api/ai/report-insights ───────────────────
// Returns natural-language insights generated from CRM report data.
// Uses the configured OpenAI-compatible endpoint when available.
router.post('/report-insights', auth, async (req, res) => {
  try {
    const result = await ai.generateReportInsights(req.body && req.body.snapshot ? req.body.snapshot : undefined);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Report insights error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
