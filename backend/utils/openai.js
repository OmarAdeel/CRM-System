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
const pool = require('../config/db');

const apiKey = process.env.OPENAI_API_KEY;

let openai = null;
if (apiKey && apiKey.startsWith('sk-')) {
  openai = new OpenAI({ apiKey });
}

const HAS_OPENAI = !!openai;

/**
 * Call OpenAI Chat Completions with a system + user prompt.
 * Returns the assistant's text response.
 */
async function chat(systemPrompt, userPrompt, options = {}) {
  if (!HAS_OPENAI) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens || 800,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  return response.choices[0].message.content.trim();
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

module.exports = {
  HAS_OPENAI,
  chat,
  draftEmail,
  translate,
  scoreLead,
  enrichCompany,
  enrichContact,
  generateDealSummary,
  scanStagnantDeals,
};
