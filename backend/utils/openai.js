/**
 * OpenAI Service Wrapper
 * Centralized utility for all AI-powered CRM features:
 *   - Email drafting (bilingual EN/AR)
 *   - Translation (EN <-> AR)
 *   - Lead scoring (AI-enhanced)
 *   - Company enrichment via domain
 *   - Contact enrichment via email
 *   - Deal summaries
 *   - Next-best-action recommendations
 *
 * Falls back to heuristic/local logic when OPENAI_API_KEY is not configured,
 * so the CRM remains functional in development without an API key.
 */

const OpenAI = require('openai');
const axios = require('axios');
const https = require('https');
const pool = require('../config/db');

// ─── Configuration: supports OpenAI or any OpenAI-compatible endpoint ───
//    Set OPENAI_API_KEY and optionally OPENAI_BASE_URL + OPENAI_MODEL.
//    Example custom endpoint:
//      OPENAI_API_KEY=sk-...
//      OPENAI_BASE_URL=https://api.hcnsec.cn/v1
//      OPENAI_MODEL=DeepSeek-V4-Flash
const apiKey = process.env.OPENAI_API_KEY;
const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/$/, '');
const DEFAULT_MODEL = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

let HAS_OPENAI = false;
if (apiKey) {
  HAS_OPENAI = true;
}

/**
 * Human-readable label for the active AI provider (e.g. "DeepSeek-V4-Flash@custom").
 */
const PROVIDER_LABEL = HAS_OPENAI
  ? (baseURL !== 'https://api.openai.com/v1' ? `${DEFAULT_MODEL}@custom` : `${DEFAULT_MODEL}@openai`)
  : 'heuristic';

/**
 * Call a chat-completions endpoint (OpenAI or compatible) with system + user prompt.
 * Uses Node's native https module directly for maximum compatibility with custom API gateways.
 * Returns the assistant's text response.
 */
async function chat(systemPrompt, userPrompt, options = {}) {
  if (!HAS_OPENAI) {
    throw new Error('OpenAI API key not configured');
  }

  const payload = {
    model: options.model || DEFAULT_MODEL,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 800,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  // Build the completions URL.
  const endpoint = baseURL.endsWith('/v1')
    ? `${baseURL}/chat/completions`
    : `${baseURL}/v1/chat/completions`;
  const url = new URL(endpoint);

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'Accept': 'application/json',
        'User-Agent': 'crm-backend/1.0',
      },
      timeout: 90000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`AI provider returned status ${res.statusCode}: ${data.slice(0, 300)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (!parsed.choices || !parsed.choices[0]) {
            reject(new Error(`AI provider returned unexpected shape: ${data.slice(0, 300)}`));
            return;
          }
          resolve(parsed.choices[0].message.content.trim());
        } catch (e) {
          reject(new Error(`Failed to parse AI response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI provider request timed out (90s)'));
    });
    req.write(bodyStr);
    req.end();
  });
}

// ─── Email Drafting ─────────────────────────────────────

/**
 * Generate a sales email draft using OpenAI.
 * @param {object} params - { contact, deal, language, tone, context }
 * @returns {Promise<{subject: string, body: string}>}
 */
async function draftEmail({ contact, deal, language = 'en', tone = 'professional', context = '' }) {
  const isArabic = language === 'ar';

  const systemPrompt = isArabic
    ? 'أنت مساعد مبيعات محترف يكتب رسائل بريد إلكتروني باللغة العربية. اكتب رسائل مهذبة ومقنعة ومناسبة للسياق التجاري. أعد الاستجابة بصيغة JSON تحتوي على "subject" و "body".'
    : 'You are a professional sales assistant writing sales emails. Write polite, persuasive, and contextually appropriate emails. Respond in JSON format with "subject" and "body" fields.';

  const contactInfo = [
    contact?.first_name ? `Name: ${contact.first_name} ${contact.last_name || ''}` : '',
    contact?.job_title ? `Job title: ${contact.job_title}` : '',
    contact?.company_name ? `Company: ${contact.company_name}` : '',
    contact?.company_industry ? `Industry: ${contact.company_industry}` : '',
  ].filter(Boolean).join('\n');

  const dealInfo = deal
    ? [
        `Deal: ${deal.title}`,
        `Value: ${deal.currency || 'USD'} ${deal.value}`,
        `Stage: ${deal.stage_name || 'N/A'}`,
      ].join('\n')
    : 'No specific deal context.';

  const userPrompt = isArabic
    ? `اكتب بريداً إلكترونياً للمتابعة مع العميل بناءً على المعلومات التالية:\n\n${contactInfo}\n${dealInfo}\nالسياق الإضافي: ${context || 'لا يوجد'}\nالنبرة: ${tone}\n\nاكتب بريداً قصيراً ومهنياً (3-4 فقرات كحد أقصى). استخدم [الاسم] كعنصر نائب لاسم العميل.`
    : `Write a follow-up sales email based on the following information:\n\n${contactInfo}\n${dealInfo}\nAdditional context: ${context || 'None'}\nTone: ${tone}\n\nKeep it concise (3-4 paragraphs max). Use [Name] as a placeholder for the contact's name.`;

  if (HAS_OPENAI) {
    try {
      const raw = await chat(systemPrompt, userPrompt, { maxTokens: 600 });
      // Try to parse JSON, fall back to extracting from text
      try {
        const parsed = JSON.parse(raw);
        return { subject: parsed.subject, body: parsed.body };
      } catch {
        // If not JSON, try to extract subject and body from text
        const lines = raw.split('\n');
        const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject'));
        const subject = subjectLine ? subjectLine.replace(/.*?:\s*/i, '').replace(/[*"]/g, '') : (isArabic ? 'متابعة' : 'Following up');
        return { subject, body: raw };
      }
    } catch (err) {
      console.error('OpenAI draft email error:', err.message);
      // Fall through to fallback
    }
  }

  // Fallback: template-based
  return fallbackDraftEmail(contact, deal, isArabic, tone);
}

function fallbackDraftEmail(contact, deal, isArabic, tone) {
  const name = contact?.first_name || '[Name]';
  if (isArabic) {
    return {
      subject: 'متابعة بخصوص عرضنا',
      body: `عزيزي ${name}،\n\nأتمنى أن تكون بخير. أردت المتابعة بخصوص عرضنا${deal ? ` الخاص بـ "${deal.title}"` : ''}.\n\n${tone === 'casual' ? 'أتمنى أن نتمكن من التحدث قريباً.' : 'هل لديك وقت هذا الأسبوع لمناقشة الخطوات التالية؟'}\n\nمع أطيب التحيات،\n[اسمك]`,
    };
  }
  return {
    subject: 'Following up on our proposal',
    body: `Dear ${name},\n\nI hope this email finds you well. I wanted to follow up on our proposal${deal ? ` regarding "${deal.title}"` : ''}.\n\n${tone === 'casual' ? "I'd love to chat soon." : 'Do you have time this week to discuss next steps?'}\n\nBest regards,\n[Your Name]`,
  };
}

// ─── Translation ────────────────────────────────────────

/**
 * Translate text between English and Arabic using OpenAI.
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - 'en' or 'ar'
 * @returns {Promise<string>}
 */
async function translate(text, targetLanguage = 'ar') {
  const sourceLang = targetLanguage === 'ar' ? 'English' : 'Arabic';
  const targetLang = targetLanguage === 'ar' ? 'Arabic' : 'English';

  if (HAS_OPENAI) {
    try {
      const systemPrompt = `You are a professional translator. Translate the following ${sourceLang} text to ${targetLang}. Preserve the tone, formatting, and any placeholders like [Name]. Only output the translated text, nothing else.`;
      return await chat(systemPrompt, text, { temperature: 0.3, maxTokens: 1000 });
    } catch (err) {
      console.error('OpenAI translate error:', err.message);
    }
  }

  // Fallback: return original with a note
  return text;
}

// ─── Lead Scoring ───────────────────────────────────────

/**
 * AI-enhanced lead scoring. Combines heuristic rules with an optional
 * OpenAI assessment of the contact's title/industry fit.
 * @param {object} contact - Contact row with joined company data
 * @returns {Promise<{score: number, reasoning: string}>}
 */
async function scoreLead(contact) {
  // Heuristic base score (deterministic)
  let score = 30;
  const factors = [];

  if (contact.job_title && /CEO|CTO|CFO|VP|Director|Head|President|Founder|مدير|رئيس/i.test(contact.job_title)) {
    score += 20;
    factors.push('Senior decision-maker title');
  } else if (contact.job_title && /Manager|Lead|Senior/i.test(contact.job_title)) {
    score += 10;
    factors.push('Mid-level management title');
  }

  if (contact.email && !/gmail\.com|yahoo\.com|hotmail\.com|outlook\.com/i.test(contact.email)) {
    score += 10;
    factors.push('Corporate email domain');
  }

  if (contact.phone) { score += 10; factors.push('Phone number provided'); }
  if (contact.linkedin_url) { score += 10; factors.push('LinkedIn profile linked'); }
  if (contact.company_size && /1000+|500-999|100-499/i.test(contact.company_size)) {
    score += 15;
    factors.push('Large company size');
  }
  if (contact.last_contacted_at) {
    const daysSince = Math.floor((Date.now() - new Date(contact.last_contacted_at)) / 86400000);
    if (daysSince <= 7) { score += 15; factors.push('Recently contacted'); }
    else if (daysSince <= 30) { score += 5; factors.push('Contacted within 30 days'); }
  }

  // AI enhancement: assess title/industry fit if OpenAI is available
  let reasoning = factors.join('; ');
  if (HAS_OPENAI && contact.job_title) {
    try {
      const systemPrompt = 'You are a B2B sales lead scoring assistant. Assess the lead quality on a scale of 0-20 (0=poor fit, 20=excellent fit) based on the job title and industry. Respond with ONLY a number and a brief reason separated by " | ". Example: "15 | Strong decision-maker in target industry"';
      const userPrompt = `Job Title: ${contact.job_title}\nIndustry: ${contact.company_industry || contact.industry || 'Unknown'}\nCompany: ${contact.company_name || 'Unknown'}`;
      const aiResponse = await chat(systemPrompt, userPrompt, { temperature: 0.2, maxTokens: 100 });
      const parts = aiResponse.split('|');
      const aiScore = Math.min(20, Math.max(0, parseInt(parts[0].trim()) || 0));
      score += aiScore;
      if (parts[1]) factors.push(`AI fit assessment: ${parts[1].trim()}`);
      reasoning = factors.join('; ');
    } catch (err) {
      console.error('AI lead scoring error:', err.message);
    }
  }

  score = Math.min(100, Math.max(0, score));
  return { score, reasoning };
}

// ─── Company Enrichment ─────────────────────────────────

/**
 * Enrich company data using the email domain. Uses OpenAI to infer
 * industry/size/description, and fetches a logo via Clearbit (free).
 * @param {object} company - Company DB row
 * @returns {Promise<object>} Enrichment data
 */
async function enrichCompany(company) {
  const result = { enrichment_source: 'openai+clearbit', enrichment_date: new Date() };

  // Logo from Clearbit (free, no key needed)
  if (company.domain) {
    result.logo_url = `https://logo.clearbit.com/${company.domain}`;
    if (!company.website) {
      result.website = `https://${company.domain}`;
    }
  }

  // AI enrichment: infer industry, size, and description
  if (HAS_OPENAI && company.name) {
    try {
      const systemPrompt = 'You are a company data enrichment assistant. Given a company name and domain, infer the industry, approximate company size, and a brief description. Respond in JSON format with "industry", "company_size", and "description" fields. company_size should be one of: "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+".';
      const userPrompt = `Company: ${company.name}\nDomain: ${company.domain || 'Unknown'}\nCurrent industry (if known): ${company.industry || 'Unknown'}`;
      const raw = await chat(systemPrompt, userPrompt, { temperature: 0.3, maxTokens: 300 });
      try {
        const parsed = JSON.parse(raw);
        if (parsed.industry) result.industry = parsed.industry;
        if (parsed.company_size) result.company_size = parsed.company_size;
        if (parsed.description) result.description = parsed.description;
      } catch {
        // If not JSON, skip AI enrichment
      }
    } catch (err) {
      console.error('AI company enrichment error:', err.message);
    }
  }

  return result;
}

// ─── Contact Enrichment ─────────────────────────────────

/**
 * Enrich a contact using their email domain to find company info.
 * Also calls lead scoring.
 * @param {object} contact - Contact DB row
 * @returns {Promise<object>}
 */
async function enrichContact(contact) {
  const result = {};

  // Run lead scoring
  const { score, reasoning } = await scoreLead(contact);
  result.lead_score = score;
  result._scoring_reasoning = reasoning;

  return result;
}

// ─── Deal Summary ───────────────────────────────────────

/**
 * Generate an AI summary of a deal based on its activities, value, and stage.
 * @param {object} deal - Deal DB row with joined data
 * @param {array} activities - Recent activities for the deal
 * @returns {Promise<string>}
 */
async function generateDealSummary(deal, activities) {
  const activityLog = activities.slice(0, 10).map(a =>
    `- ${a.activity_type}: ${a.subject || ''} ${a.content ? '(' + a.content.substring(0, 100) + ')' : ''} [${new Date(a.created_at).toLocaleDateString()}]`
  ).join('\n');

  const dealInfo = [
    `Title: ${deal.title}`,
    `Value: ${deal.currency || 'USD'} ${deal.value}`,
    `Stage: ${deal.stage_name || 'N/A'}`,
    `Contact: ${deal.contact_name || 'N/A'}`,
    `Company: ${deal.company_name || 'N/A'}`,
    `Status: ${deal.status}`,
    `Last activity: ${deal.last_activity_at || 'N/A'}`,
  ].join('\n');

  if (HAS_OPENAI) {
    try {
      const systemPrompt = 'You are a sales deal analyst. Provide a concise summary of the deal status, key risks, and recommended next steps. Keep it under 200 words.';
      const userPrompt = `Deal Information:\n${dealInfo}\n\nRecent Activities:\n${activityLog || 'No activities logged.'}`;
      return await chat(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 400 });
    } catch (err) {
      console.error('AI deal summary error:', err.message);
    }
  }

  // Fallback
  return `Deal "${deal.title}" is currently in ${deal.stage_name || 'pipeline'} stage with a value of ${deal.currency || 'USD'} ${deal.value}. ${activities.length} activities have been logged. Last activity was ${deal.last_activity_at || 'N/A'}.`;
}

// ─── Next-Best-Action Recommendations ───────────────────

/**
 * Scan stagnant deals and generate next-best-action recommendations.
 * A deal is "stagnant" if it hasn't had activity in >threshold days.
 * @returns {Promise<array>} Array of created recommendations
 */
async function scanStagnantDeals() {
  // Find deals that are open and have been inactive beyond their threshold
  const [stagnantDeals] = await pool.query(`
    SELECT d.*, s.name AS stage_name, s.probability_pct,
           c.first_name AS contact_name, c.email AS contact_email,
           comp.name AS company_name,
           DATEDIFF(CURRENT_DATE, COALESCE(d.last_activity_at, d.created_at)) AS days_inactive
    FROM deals d
    JOIN stages s ON d.stage_id = s.id
    LEFT JOIN contacts c ON d.contact_id = c.id
    LEFT JOIN companies comp ON d.company_id = comp.id
    WHERE d.status = 'open'
      AND s.is_won = FALSE AND s.is_lost = FALSE
      AND DATEDIFF(CURRENT_DATE, COALESCE(d.last_activity_at, d.created_at)) > d.rotting_threshold_days
    ORDER BY d.value DESC
    LIMIT 50
  `);

  const recommendations = [];

  for (const deal of stagnantDeals) {
    // Check if a recommendation already exists for this deal (not dismissed)
    const [existing] = await pool.query(
      'SELECT id FROM ai_recommendations WHERE deal_id = ? AND is_dismissed = FALSE',
      [deal.id]
    );
    if (existing.length > 0) continue;

    // Determine recommendation type based on stage and time
    let recType = 'follow_up';
    let title = '';
    let description = '';
    let priority = 50;

    if (deal.days_inactive > 30) {
      recType = 're_engage';
      title = `Re-engage: "${deal.title}" has been inactive for ${deal.days_inactive} days`;
      description = `This deal worth ${deal.currency} ${deal.value} in ${deal.stage_name} stage has had no activity for over a month. Consider a direct call or a new value proposition.`;
      priority = 80;
    } else if (deal.probability_pct >= 75) {
      recType = 'follow_up';
      title = `Close soon: "${deal.title}" is in ${deal.stage_name} (${deal.probability_pct}% probability)`;
      description = `High-probability deal worth ${deal.currency} ${deal.value}. Schedule a final meeting with ${deal.contact_name || 'the contact'} to push for closure.`;
      priority = 90;
    } else if (deal.probability_pct >= 50) {
      recType = 'schedule_meeting';
      title = `Schedule demo: "${deal.title}" needs a push`;
      description = `Deal worth ${deal.currency} ${deal.value} is stalling in ${deal.stage_name}. Propose a product demo or technical deep-dive.`;
      priority = 70;
    } else {
      recType = 'draft_email';
      title = `Follow up: "${deal.title}" — ${deal.days_inactive} days inactive`;
      description = `Send a follow-up email to ${deal.contact_name || 'the contact'} at ${deal.company_name || 'their company'} to keep the deal moving.`;
      priority = 60;
    }

    // If OpenAI is available, generate a smarter recommendation
    if (HAS_OPENAI) {
      try {
        const systemPrompt = 'You are a sales coach. Given deal info, suggest the single best next action in 1-2 sentences. Be specific and actionable.';
        const userPrompt = `Deal: ${deal.title} (${deal.currency} ${deal.value})\nStage: ${deal.stage_name} (${deal.probability_pct}%)\nDays inactive: ${deal.days_inactive}\nContact: ${deal.contact_name || 'N/A'}\nCompany: ${deal.company_name || 'N/A'}`;
        const aiSuggestion = await chat(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 150 });
        description = aiSuggestion;
      } catch (err) {
        console.error('AI recommendation error:', err.message);
      }
    }

    await pool.query(
      `INSERT INTO ai_recommendations (deal_id, contact_id, recommendation_type, title, description, suggested_action, priority_score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [deal.id, deal.contact_id, recType, title, description, description, priority]
    );

    recommendations.push({ deal_id: deal.id, title, priority });
  }

  return recommendations;
}

// ─── AI Report Insights ─────────────────────────────────

/**
 * Build a JSON snapshot of key CRM metrics suitable for an LLM prompt.
 * Fetches pipeline value, win rate, leaderboard, funnel, lost reasons.
 */
async function buildReportSnapshot() {
  // Pipeline totals
  const [[pipeRow]] = await pool.query(`
    SELECT
      COUNT(*)                                   AS total_deals,
      SUM(CASE WHEN status='open'   THEN value END) AS pipeline_value,
      SUM(CASE WHEN status='won'    THEN value END) AS won_value,
      SUM(CASE WHEN status='lost'   THEN value END) AS lost_value,
      COUNT(CASE WHEN status='open'  THEN 1 END)   AS open_count,
      COUNT(CASE WHEN status='won'   THEN 1 END)   AS won_count,
      COUNT(CASE WHEN status='lost'  THEN 1 END)   AS lost_count
    FROM deals WHERE status IN ('open','won','lost')
  `);

  // Funnel by stage
  const [funnel] = await pool.query(`
    SELECT s.name, COUNT(d.id) AS deal_count, COALESCE(SUM(d.value),0) AS total_value
    FROM stages s
    LEFT JOIN deals d ON d.stage_id=s.id AND d.status='open'
    WHERE s.is_won=FALSE AND s.is_lost=FALSE
    GROUP BY s.id, s.name ORDER BY s.sort_order
  `);

  // Leaderboard (last 7 days)
  const [leaderboard] = await pool.query(`
    SELECT u.first_name, u.last_name,
           COUNT(a.id) AS total_activities,
           COUNT(CASE WHEN a.activity_type='call' THEN 1 END) AS calls,
           COUNT(CASE WHEN a.activity_type='email' THEN 1 END) AS emails,
           COUNT(CASE WHEN a.activity_type='meeting' THEN 1 END) AS meetings
    FROM users u
    LEFT JOIN activities a ON a.user_id=u.id
      AND a.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    WHERE u.is_active=TRUE
    GROUP BY u.id, u.first_name, u.last_name
    ORDER BY total_activities DESC LIMIT 10
  `);

  // Lost reasons
  const [lost] = await pool.query(`
    SELECT loss_reason, COUNT(*) AS count FROM deals
    WHERE status='lost' AND loss_reason IS NOT NULL
    GROUP BY loss_reason ORDER BY count DESC LIMIT 5
  `);

  return {
    period: 'last 7 days',
    pipeline_value: parseFloat(pipeRow.pipeline_value || 0),
    won_value: parseFloat(pipeRow.won_value || 0),
    lost_value: parseFloat(pipeRow.lost_value || 0),
    total_deals: Number(pipeRow.total_deals || 0),
    open_count: Number(pipeRow.open_count || 0),
    won_count: Number(pipeRow.won_count || 0),
    lost_count: Number(pipeRow.lost_count || 0),
    win_rate: pipeRow.total_deals > 0
      ? Math.round((pipeRow.won_count / (pipeRow.won_count + pipeRow.lost_count || 1)) * 100)
      : 0,
    funnel: funnel.map(f => ({ stage: f.name, deals: Number(f.deal_count), value: parseFloat(f.total_value) })),
    leaderboard: leaderboard.map(l => ({
      rep: `${l.first_name} ${l.last_name}`,
      total: Number(l.total_activities),
      calls: Number(l.calls), emails: Number(l.emails), meetings: Number(l.meetings),
    })),
    lost_reasons: lost.map(l => ({ reason: l.loss_reason, count: Number(l.count) })),
  };
}

/**
 * Generate natural-language insights from CRM report data.
 * Calls OpenAI-compatible endpoint when configured (see OPENAI_BASE_URL),
 * otherwise returns deterministic heuristic insights.
 *
 * @param {object} [overrideSnapshot] - optional prebuilt snapshot (for testing)
 * @returns {Promise<{success:boolean, source:string, insights:string, snapshot:object, generatedAt:string}>}
 */
async function generateReportInsights(overrideSnapshot) {
  const snapshot = overrideSnapshot || await buildReportSnapshot();
  const generatedAt = new Date().toISOString();

  // ─── Heuristic fallback ───
  const heuristic = () => {
    const lines = [];
    const winRate = snapshot.win_rate || 0;
    lines.push(`📈 Performance overview`);
    lines.push(`Open pipeline currently holds ${snapshot.open_count} deals worth $${(snapshot.pipeline_value/1000).toFixed(1)}K.`);
    if (snapshot.won_count > 0) lines.push(`Closed ${snapshot.won_count} deal(s) totaling $${(snapshot.won_value/1000).toFixed(1)}K — win rate ${winRate}%.`);
    if (snapshot.lost_count > 0) lines.push(`Lost ${snapshot.lost_count} deal(s) worth $${(snapshot.lost_value/1000).toFixed(1)}K over the same period.`);
    if (snapshot.funnel.length > 0) {
      const first = snapshot.funnel[0];
      const last = snapshot.funnel[snapshot.funnel.length - 1];
      const dropPct = first.deals > 0
        ? Math.max(0, Math.round(((first.deals - last.deals) / first.deals) * 100))
        : 0;
      lines.push(`🔍 Funnel drop-off`);
      lines.push(`${first.stage} → ${last.stage}: ${dropPct}% drop-off, ${first.deals} to ${last.deals} deals.`);
    }
    if (snapshot.leaderboard.length > 0 && snapshot.leaderboard[0].total > 0) {
      const top = snapshot.leaderboard[0];
      lines.push(`🏆 Activity`);
      lines.push(`Top performer: ${top.rep} with ${top.total} activities (${top.calls} calls, ${top.emails} emails, ${top.meetings} meetings) in 7 days.`);
    }
    if (snapshot.lost_reasons.length > 0) {
      lines.push(`⚠️ Loss signals`);
      lines.push(`Top loss reason: "${snapshot.lost_reasons[0].reason}" (${snapshot.lost_reasons[0].count} deals).`);
    }
    return lines.join('\n');
  };

  if (!HAS_OPENAI) {
    return { success: true, source: 'heuristic', insights: heuristic(), snapshot, generatedAt };
  }

  // ─── AI insights ───
  try {
    const systemPrompt =
      'You are a B2B sales analyst. Given CRM metrics as JSON, produce concise insights in 5 sections with emoji headers: "📈 Performance", "🔍 Funnel", "🏆 Top performer", "⚠️ Losses", "✅ Actions". 1 line each. End with one takeaway.';
    const userPrompt = JSON.stringify(snapshot);
    const aiResponse = await chat(systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 600,
    });
    return { success: true, source: PROVIDER_LABEL, insights: aiResponse, snapshot, generatedAt };
  } catch (err) {
    console.error('AI report insights error:', err.message);
    return { success: true, source: 'heuristic (fallback)', insights: heuristic(), snapshot, generatedAt, error: err.message };
  }
}

module.exports = {
  HAS_OPENAI,
  PROVIDER_LABEL,
  DEFAULT_MODEL,
  chat,
  draftEmail,
  translate,
  scoreLead,
  enrichCompany,
  enrichContact,
  generateDealSummary,
  scanStagnantDeals,
  generateReportInsights,
};
