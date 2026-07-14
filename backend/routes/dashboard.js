const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// ─── GET /api/dashboard/stats ──────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const repFilter = role === 'rep' ? 'AND d.owner_id = ?' : '';
    const repParams = role === 'rep' ? [userId] : [];

    // Total revenue (won deals)
    const [revenue] = await pool.query(
      `SELECT COALESCE(SUM(d.value), 0) AS total
       FROM deals d
       WHERE d.status = 'won' ${repFilter}`,
      repParams
    );

    // Deals won count
    const [won] = await pool.query(
      `SELECT COUNT(*) AS count FROM deals d WHERE d.status = 'won' ${repFilter}`,
      repParams
    );

    // Active pipeline count
    const [pipeline] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS total_value
       FROM deals d
       JOIN stages s ON d.stage_id = s.id
       WHERE d.status = 'open' AND s.is_won = FALSE AND s.is_lost = FALSE ${repFilter}`,
      repParams
    );

    // Conversion rate
    const [total] = await pool.query(
      `SELECT COUNT(*) AS count FROM deals d WHERE 1=1 ${repFilter}`,
      repParams
    );
    const conversionRate = total[0].count > 0
      ? Math.round((won[0].count / total[0].count) * 100)
      : 0;

    // Weighted forecast by stage
    const [forecast] = await pool.query(
      `SELECT s.name, s.name_ar, s.probability_pct,
              COUNT(d.id) AS deal_count,
              COALESCE(SUM(d.value * s.probability_pct / 100), 0) AS weighted_value
       FROM stages s
       LEFT JOIN deals d ON d.stage_id = s.id AND d.status = 'open'
       WHERE s.is_won = FALSE AND s.is_lost = FALSE
       GROUP BY s.id, s.name, s.name_ar, s.probability_pct
       ORDER BY s.sort_order ASC`
    );

    // AI recommendations
    const [recommendations] = await pool.query(
      `SELECT * FROM ai_recommendations
       WHERE is_dismissed = FALSE
       ORDER BY priority_score DESC
       LIMIT 5`
    );

    // Monthly recurring revenue (sum of won deals count this month / 12 as proxy, or use subscription price)
    const [mrr] = await pool.query(`
      SELECT COALESCE(SUM(d.value / 12), 0) AS mrr
      FROM deals d
      WHERE d.status = 'won'
        AND d.actual_close_date IS NOT NULL
        AND d.actual_close_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      ${repFilter}
    `, repParams);

    // Lost deals count + lost value (for lost analysis)
    const [lost] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS total_value
       FROM deals d WHERE d.status = 'lost' ${repFilter}`,
      repParams
    );

    // Deals created this month
    const [newDeals] = await pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS total_value
       FROM deals d
       WHERE d.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) ${repFilter}`,
      repParams
    );

    // Stagnant deals (no activity in 14+ days, still open)
    const [stagnant] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM deals d
       WHERE d.status = 'open'
         AND (d.last_activity_at IS NULL
              OR d.last_activity_at < DATE_SUB(CURDATE(), INTERVAL 14 DAY)) ${repFilter}`,
      repParams
    );

    const data = {
      totalRevenue: parseFloat(revenue[0].total) || 0,
      dealsWon: won[0].count,
      activePipelineCount: pipeline[0].count,
      activePipelineValue: parseFloat(pipeline[0].total_value) || 0,
      conversionRate,
      forecast,
      recommendations,
      mrr: parseFloat(mrr[0].mrr) || 0,
      dealsLost: lost[0].count,
      lostValue: parseFloat(lost[0].total_value) || 0,
      newDealsThisMonth: newDeals[0].count,
      newDealsValue: parseFloat(newDeals[0].total_value) || 0,
      stagnantDeals: stagnant[0].count,
      totalDeals: total[0].count,
    };

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/dashboard/leaderboard ────────────────────
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.id, u.first_name, u.last_name,
        COUNT(CASE WHEN a.activity_type = 'call' THEN 1 END) AS calls,
        COUNT(CASE WHEN a.activity_type = 'email' THEN 1 END) AS emails,
        COUNT(CASE WHEN a.activity_type = 'meeting' THEN 1 END) AS meetings,
        COUNT(CASE WHEN a.activity_type = 'whatsapp' THEN 1 END) AS whatsapps,
        COUNT(a.id) AS total_activities
      FROM users u
      LEFT JOIN activities a ON a.user_id = u.id
        AND a.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY)
      WHERE u.is_active = TRUE
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY total_activities DESC
      LIMIT 10
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/dashboard/forecast ───────────────────────
router.get('/forecast', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.name, s.name_ar, s.probability_pct,
             COUNT(d.id) AS count,
             COALESCE(SUM(d.value), 0) AS total_value,
             COALESCE(SUM(d.value * s.probability_pct / 100), 0) AS weighted_value
      FROM stages s
      LEFT JOIN deals d ON d.stage_id = s.id AND d.status = 'open'
      WHERE s.is_won = FALSE AND s.is_lost = FALSE
      GROUP BY s.id, s.name, s.name_ar, s.probability_pct
      ORDER BY s.sort_order
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/dashboard/funnel/:pipelineId ─────────────
router.get('/funnel/:pipelineId', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.name, s.name_ar, s.sort_order,
             COUNT(d.id) AS deal_count,
             COALESCE(SUM(d.value), 0) AS total_value
      FROM stages s
      LEFT JOIN deals d ON d.stage_id = s.id AND d.status = 'open'
      WHERE s.pipeline_id = ?
      GROUP BY s.id, s.name, s.name_ar, s.sort_order
      ORDER BY s.sort_order
    `, [req.params.pipelineId]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Funnel error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;