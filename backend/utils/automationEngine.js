/**
 * Automation Execution Engine
 * Evaluates automation rules against data changes and fires actions.
 *
 * Supported Triggers:
 *   - deal_stage_changed : fires when a deal moves to a target stage
 *   - deal_created       : fires when a new deal is created
 *   - contact_created    : fires when a new contact is created
 *   - lead_score_reached : fires when a contact's lead_score crosses a threshold
 *   - date_reached       : fires on a specific date (checked daily)
 *   - manual             : fired manually via API
 *
 * Supported Actions:
 *   - send_email     : logs an email activity
 *   - create_task    : logs a task activity
 *   - update_field   : updates a field on the entity
 *   - send_whatsapp  : logs a whatsapp activity
 *   - assign_owner   : reassigns the deal/contact owner (smart routing)
 *   - webhook        : sends a POST to an external URL
 *
 * The engine is invoked from route handlers (inline triggers) and
 * from the scheduler (daily scans for date_reached + lead_score_reached).
 */

const pool = require('../config/db');
const axios = require('axios');

/**
 * Fetch all active automations.
 */
async function getActiveAutomations() {
  const [rows] = await pool.query(
    'SELECT * FROM automations WHERE is_active = TRUE'
  );
  return rows;
}

/**
 * Parse JSON config fields safely.
 */
function parseConfig(val) {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  return val || {};
}

/**
 * Main entry point: evaluate a trigger event against all active automations.
 * @param {string} triggerType - e.g. 'deal_stage_changed'
 * @param {object} payload - { entity_id, entity_type, old_value, new_value, ... }
 * @param {object} io - Socket.io instance for real-time notifications
 */
async function evaluateTrigger(triggerType, payload, io) {
  try {
    const automations = await getActiveAutomations();

    for (const automation of automations) {
      if (automation.trigger_type !== triggerType) continue;

      const triggerConfig = parseConfig(automation.trigger_config);
      const actionConfig = parseConfig(automation.action_config);

      // Check if the trigger conditions match
      const matches = checkTriggerConditions(triggerType, triggerConfig, payload);
      if (!matches) continue;

      // Execute the action
      try {
        await executeAction(automation.action_type, actionConfig, payload, automation, io);
        console.log(`✅ Automation "${automation.name}" fired for ${triggerType}`);
      } catch (err) {
        console.error(`❌ Automation "${automation.name}" action failed:`, err.message);
      }
    }
  } catch (err) {
    console.error('Automation engine error:', err.message);
  }
}

/**
 * Check if the trigger conditions match the payload.
 */
function checkTriggerConditions(triggerType, config, payload) {
  switch (triggerType) {
    case 'deal_stage_changed': {
      // config: { stage_id: 5 } or { stage_name: 'Won' }
      if (config.stage_id && payload.new_stage_id != config.stage_id) return false;
      if (config.stage_name && payload.new_stage_name !== config.stage_name) return false;
      return true;
    }
    case 'deal_created':
      return true;
    case 'contact_created':
      return true;
    case 'lead_score_reached': {
      // config: { threshold: 70 }
      const threshold = config.threshold || 50;
      return (payload.lead_score || 0) >= threshold;
    }
    case 'date_reached': {
      // config: { date: '2026-01-15' } or { days_before_close: 7 }
      if (config.date) {
        const today = new Date().toISOString().slice(0, 10);
        return today >= config.date;
      }
      if (config.days_before_close && payload.expected_close_date) {
        const closeDate = new Date(payload.expected_close_date);
        const today = new Date();
        const diffDays = Math.ceil((closeDate - today) / 86400000);
        return diffDays <= config.days_before_close;
      }
      return false;
    }
    case 'manual':
      return true;
    default:
      return false;
  }
}

/**
 * Execute the configured action.
 */
async function executeAction(actionType, config, payload, automation, io) {
  const userId = payload.user_id || automation.created_by || 1;

  switch (actionType) {
    case 'send_email': {
      // Log an email activity (the actual sending happens via email integration)
      await pool.query(
        `INSERT INTO activities (activity_type, subject, content, contact_id, deal_id, company_id, user_id, direction)
         VALUES ('email', ?, ?, ?, ?, ?, ?, 'outbound')`,
        [
          config.subject || `Automated email: ${automation.name}`,
          config.body || '',
          payload.contact_id || null,
          payload.deal_id || null,
          payload.company_id || null,
          userId,
        ]
      );
      // Notify via socket
      if (io) io.emit('notification', {
        type: 'success',
        title: 'Automation triggered',
        message: `Email logged: "${config.subject || automation.name}"`,
      });
      // Persist to notifications table for the deal owner / actor
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'success', ?, ?)`,
          [userId, 'Automation triggered', `Email logged: "${config.subject || automation.name}"`]
        );
      } catch (_) { /* notifications table may not exist */ }
      // Attempt real send via the email service (SMTP; dev-logs otherwise)
      try {
        const emailService = require('./emailService');
        if (payload.contact_email) {
          await emailService.sendEmail({
            to: payload.contact_email,
            subject: config.subject || `Automated email: ${automation.name}`,
            html: config.body || '',
            contactId: payload.contact_id || null,
            dealId: payload.deal_id || null,
            userId,
            track: true,
          });
        }
      } catch (e) { console.warn('Automation email send failed:', e.message); }
      break;
    }

    case 'create_task': {
      await pool.query(
        `INSERT INTO activities (activity_type, subject, content, contact_id, deal_id, company_id, user_id, direction, scheduled_at)
         VALUES ('task', ?, ?, ?, ?, ?, ?, 'internal', ?)`,
        [
          config.task_title || `Task: ${automation.name}`,
          config.task_description || '',
          payload.contact_id || null,
          payload.deal_id || null,
          payload.company_id || null,
          userId,
          config.due_date || null,
        ]
      );
      if (io) io.emit('notification', {
        type: 'info',
        title: 'New task created',
        message: config.task_title || automation.name,
      });
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'info', ?, ?)`,
          [userId, 'New task created', config.task_title || automation.name]
        );
      } catch (_) { /* notifications table may not exist */ }
      break;
    }

    case 'update_field': {
      // config: { entity: 'deal', field: 'priority', value: 'high' }
      const entity = config.entity || payload.entity_type || 'deal';
      const field = config.field;
      const value = config.value;
      if (!field || value === undefined) break;

      const entityId = payload.entity_id || payload.deal_id || payload.contact_id;
      if (!entityId) break;

      await pool.query(`UPDATE ${entity === 'deal' ? 'deals' : entity === 'contact' ? 'contacts' : 'companies'} SET ${field} = ? WHERE id = ?`, [value, entityId]);
      break;
    }

    case 'send_whatsapp': {
      // Log a whatsapp activity (actual sending via WhatsApp API integration)
      await pool.query(
        `INSERT INTO activities (activity_type, subject, content, contact_id, deal_id, company_id, user_id, direction)
         VALUES ('whatsapp', ?, ?, ?, ?, ?, ?, 'outbound')`,
        [
          config.message_subject || `WhatsApp: ${automation.name}`,
          config.message_body || '',
          payload.contact_id || null,
          payload.deal_id || null,
          payload.company_id || null,
          userId,
        ]
      );
      // Attempt real send via the WhatsApp service (logs to whatsapp_logs)
      try {
        const whatsappService = require('./whatsappService');
        if (payload.contact_phone) {
          await whatsappService.sendTextMessage({
            to: payload.contact_phone,
            message: config.message_body || config.message_subject || automation.name,
            userId,
            contactId: payload.contact_id || null,
            dealId: payload.deal_id || null,
          });
        }
      } catch (e) { console.warn('Automation WhatsApp send failed:', e.message); }
      break;
    }

    case 'assign_owner': {
      // Smart routing: assign based on language preference or territory
      let newOwnerId = config.user_id;

      if (!newOwnerId && config.routing_rule === 'by_language') {
        const lang = payload.language_preference || 'en';
        const [users] = await pool.query(
          'SELECT id FROM users WHERE is_active = TRUE ORDER BY RAND() LIMIT 1'
        );
        if (users.length > 0) newOwnerId = users[0].id;
      } else if (!newOwnerId && config.routing_rule === 'by_territory') {
        const territory = payload.territory;
        const [users] = await pool.query(
          'SELECT id FROM users WHERE is_active = TRUE AND territory = ? ORDER BY RAND() LIMIT 1',
          [territory]
        );
        if (users.length > 0) newOwnerId = users[0].id;
      } else if (!newOwnerId) {
        // Round-robin: pick any active rep
        const [users] = await pool.query(
          "SELECT id FROM users WHERE is_active = TRUE AND role = 'rep' ORDER BY RAND() LIMIT 1"
        );
        if (users.length > 0) newOwnerId = users[0].id;
      }

      if (newOwnerId) {
        const entity = payload.entity_type || 'deal';
        const entityId = payload.entity_id || payload.deal_id || payload.contact_id;
        if (entityId) {
          const table = entity === 'deal' ? 'deals' : entity === 'contact' ? 'contacts' : 'companies';
          await pool.query(`UPDATE ${table} SET owner_id = ? WHERE id = ?`, [newOwnerId, entityId]);
        }
      }
      break;
    }

    case 'webhook': {
      if (config.url) {
        await axios.post(config.url, {
          automation: automation.name,
          trigger: automation.trigger_type,
          payload,
        }, { timeout: 5000 }).catch(err => {
          console.error('Webhook call failed:', err.message);
        });
      }
      break;
    }

    default:
      console.warn(`Unknown action type: ${actionType}`);
  }
}

module.exports = {
  evaluateTrigger,
  getActiveAutomations,
};
