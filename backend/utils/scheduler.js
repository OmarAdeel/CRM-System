/**
 * Central Scheduler
 * Runs periodic background jobs:
 *   1. AI scan for stagnant deals (daily) — generates next-best-action recommendations
 *   2. Date-reached automation triggers (daily) — checks deals near expected close date
 *   3. Lead score threshold automations (hourly) — checks contacts that crossed a threshold
 *
 * Uses setInterval as a lightweight cron. In production, consider node-cron.
 */

const pool = require('../config/db');
const aiService = require('./openai');
const automationEngine = require('./automationEngine');

let ioInstance = null;

function start(io) {
  ioInstance = io;

  // ─── Daily: AI stagnant deal scan ────────────────────
  // Runs every 24 hours (or first boot)
  runStagnantScan();
  setInterval(runStagnantScan, 24 * 60 * 60 * 1000);

  // ─── Daily: Date-reached automations ─────────────────
  // Runs at midnight (or first boot)
  runDateReachedAutomations();
  setInterval(runDateReachedAutomations, 24 * 60 * 60 * 1000);

  // ─── Hourly: Lead score threshold automations ────────
  runLeadScoreAutomations();
  setInterval(runLeadScoreAutomations, 60 * 60 * 1000);

  console.log('⏰ Scheduler started: stagnant scan (daily), date automations (daily), lead score (hourly)');
}

async function runStagnantScan() {
  try {
    console.log('🔍 [Scheduler] Scanning for stagnant deals...');
    const recs = await aiService.scanStagnantDeals();
    if (recs.length > 0) {
      console.log(`   → Generated ${recs.length} new AI recommendations`);
      // Notify all connected clients about new recommendations
      if (ioInstance) {
        ioInstance.emit('notification', {
          type: 'info',
          title: `${recs.length} new AI recommendation${recs.length > 1 ? 's' : ''}`,
          message: 'Check your AI recommendations for stagnant deals.',
        });
      }
    }
  } catch (err) {
    console.error('Stagnant scan error:', err.message);
  }
}

async function runDateReachedAutomations() {
  try {
    console.log('📅 [Scheduler] Checking date-reached automations...');

    // Find deals whose expected_close_date is within 7 days
    const [upcomingDeals] = await pool.query(`
      SELECT d.id AS deal_id, d.title, d.expected_close_date, d.contact_id,
             d.company_id, d.owner_id AS user_id
      FROM deals d
      WHERE d.status = 'open'
        AND d.expected_close_date IS NOT NULL
        AND d.expected_close_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
    `);

    for (const deal of upcomingDeals) {
      await automationEngine.evaluateTrigger('date_reached', {
        entity_type: 'deal',
        entity_id: deal.deal_id,
        deal_id: deal.deal_id,
        contact_id: deal.contact_id,
        company_id: deal.company_id,
        user_id: deal.user_id,
        expected_close_date: deal.expected_close_date,
      }, ioInstance);
    }

    if (upcomingDeals.length > 0) {
      console.log(`   → Checked ${upcomingDeals.length} upcoming deals for date triggers`);
    }
  } catch (err) {
    console.error('Date-reached automations error:', err.message);
  }
}

async function runLeadScoreAutomations() {
  try {
    // Find contacts with lead_score >= 70 that haven't been processed yet
    // (we check if there's already a high-score activity logged)
    const [highScoreLeads] = await pool.query(`
      SELECT c.id AS contact_id, c.lead_score, c.first_name, c.company_id,
             c.owner_id AS user_id, c.language_preference
      FROM contacts c
      WHERE c.is_active = TRUE
        AND c.lead_score >= 70
        AND NOT EXISTS (
          SELECT 1 FROM activities a
          WHERE a.contact_id = c.id
            AND a.subject LIKE '%High score lead%'
            AND a.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        )
    `);

    for (const contact of highScoreLeads) {
      await automationEngine.evaluateTrigger('lead_score_reached', {
        entity_type: 'contact',
        entity_id: contact.contact_id,
        contact_id: contact.contact_id,
        company_id: contact.company_id,
        user_id: contact.user_id,
        lead_score: contact.lead_score,
        language_preference: contact.language_preference,
      }, ioInstance);
    }

    if (highScoreLeads.length > 0) {
      console.log(`🎯 [Scheduler] Processed ${highScoreLeads.length} high-score leads`);
    }
  } catch (err) {
    console.error('Lead score automations error:', err.message);
  }
}

module.exports = { start };
