/**
 * Comprehensive Seed Script
 * Populates the crm_db database with realistic dummy data across all tables.
 * Run with: npm run seed  (or: node utils/seed.js)
 *
 * All passwords are "password123" (bcrypt-hashed at cost 12).
 * Idempotent: safe to run multiple times (uses INSERT ... ON DUPLICATE KEY UPDATE / IGNORE).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // ─── 1. USERS ──────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);
  const users = [
    { id: 1, first_name: 'Admin', last_name: 'User', email: 'admin@crm.com', role: 'admin', language: 'en', territory: null, manager_id: null },
    { id: 2, first_name: 'Sara', last_name: 'Al-Mansouri', email: 'sara@crm.com', role: 'manager', language: 'ar', territory: 'Dubai', manager_id: 1 },
    { id: 3, first_name: 'John', last_name: 'Smith', email: 'john@crm.com', role: 'rep', language: 'en', territory: 'North America', manager_id: 2 },
    { id: 4, first_name: 'Ahmed', last_name: 'Khalil', email: 'ahmed@crm.com', role: 'rep', language: 'ar', territory: 'Riyadh', manager_id: 2 },
    { id: 5, first_name: 'Maria', last_name: 'Garcia', email: 'maria@crm.com', role: 'rep', language: 'en', territory: 'Europe', manager_id: 1 },
    { id: 6, first_name: 'Fatima', last_name: 'Al-Zahra', email: 'fatima@crm.com', role: 'manager', language: 'ar', territory: 'Abu Dhabi', manager_id: 1 },
    { id: 7, first_name: 'David', last_name: 'Chen', email: 'david@crm.com', role: 'rep', language: 'en', territory: 'Asia Pacific', manager_id: 6 },
    { id: 8, first_name: 'Layla', last_name: 'Hassan', email: 'layla@crm.com', role: 'rep', language: 'ar', territory: 'Cairo', manager_id: 6 },
  ];

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, first_name, last_name, email, password_hash, role, language, territory, manager_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name), password_hash=VALUES(password_hash)`,
      [u.id, u.first_name, u.last_name, u.email, passwordHash, u.role, u.language, u.territory, u.manager_id]
    );
  }
  console.log(`✅ ${users.length} users seeded`);

  // ─── 2. COMPANIES ─────────────────────────────────────
  const companies = [
    { id: 1, name: 'Acme Corporation', name_ar: 'شركة أكمي', domain: 'acme.com', industry: 'Technology', company_size: '501-1000', annual_revenue: 45000000, website: 'https://acme.com', city: 'San Francisco', country: 'USA', owner_id: 3, created_by: 1 },
    { id: 2, name: 'Gulf Tech Solutions', name_ar: 'حلول الخليج للتقنية', domain: 'gulftech.ae', industry: 'Software', company_size: '201-500', annual_revenue: 18000000, website: 'https://gulftech.ae', city: 'Dubai', country: 'UAE', owner_id: 4, created_by: 1 },
    { id: 3, name: 'Riyadh Industries', name_ar: 'صناعات الرياض', domain: 'riyadh-ind.sa', industry: 'Manufacturing', company_size: '1000+', annual_revenue: 120000000, website: 'https://riyadh-ind.sa', city: 'Riyadh', country: 'Saudi Arabia', owner_id: 4, created_by: 1 },
    { id: 4, name: 'EuroTrade GmbH', name_ar: 'يوروتريد', domain: 'eurotrade.de', industry: 'Retail', company_size: '201-500', annual_revenue: 25000000, website: 'https://eurotrade.de', city: 'Berlin', country: 'Germany', owner_id: 5, created_by: 1 },
    { id: 5, name: 'Cairo Logistics', name_ar: 'القاهرة للخدمات اللوجستية', domain: 'cairolog.eg', industry: 'Logistics', company_size: '501-1000', annual_revenue: 32000000, website: 'https://cairolog.eg', city: 'Cairo', country: 'Egypt', owner_id: 8, created_by: 1 },
    { id: 6, name: 'Pinnacle Group', name_ar: 'مجموعة بيناكل', domain: 'pinnacle.io', industry: 'Consulting', company_size: '51-200', annual_revenue: 8000000, website: 'https://pinnacle.io', city: 'London', country: 'UK', owner_id: 5, created_by: 1 },
    { id: 7, name: 'Desert Oasis Foods', name_ar: 'واحة الصحراء للأغذية', domain: 'desertoasis.sa', industry: 'Food & Beverage', company_size: '201-500', annual_revenue: 15000000, website: 'https://desertoasis.sa', city: 'Jeddah', country: 'Saudi Arabia', owner_id: 4, created_by: 1 },
    { id: 8, name: 'TechNova Labs', name_ar: 'تيك نوفا', domain: 'technova.io', industry: 'Technology', company_size: '11-50', annual_revenue: 3000000, website: 'https://technova.io', city: 'Singapore', country: 'Singapore', owner_id: 7, created_by: 1 },
    { id: 9, name: 'Mediterranean Shipping', name_ar: 'البحر المتوسط للشحن', domain: 'medship.gr', industry: 'Shipping', company_size: '1000+', annual_revenue: 89000000, website: 'https://medship.gr', city: 'Athens', country: 'Greece', owner_id: 5, created_by: 1 },
    { id: 10, name: 'Green Energy Co', name_ar: 'الطاقة الخضراء', domain: 'greenenergy.bh', industry: 'Energy', company_size: '201-500', annual_revenue: 22000000, website: 'https://greenenergy.bh', city: 'Manama', country: 'Bahrain', owner_id: 8, created_by: 1 },
  ];

  for (const c of companies) {
    await pool.query(
      `INSERT INTO companies (id, name, name_ar, domain, industry, company_size, annual_revenue, website, city, country, owner_id, created_by, logo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), domain=VALUES(domain)`,
      [c.id, c.name, c.name_ar, c.domain, c.industry, c.company_size, c.annual_revenue, c.website, c.city, c.country, c.owner_id, c.created_by, `https://logo.clearbit.com/${c.domain}`]
    );
  }
  console.log(`✅ ${companies.length} companies seeded`);

  // ─── 3. CONTACTS ───────────────────────────────────────
  const contacts = [
    { id: 1, first_name: 'Michael', last_name: 'Johnson', email: 'michael@acme.com', phone: '+1-415-555-0101', job_title: 'CTO', company_id: 1, lead_score: 85, lead_source: 'Website', owner_id: 3, language_preference: 'en' },
    { id: 2, first_name: 'Sarah', last_name: 'Williams', email: 'sarah@acme.com', phone: '+1-415-555-0102', job_title: 'VP Sales', company_id: 1, lead_score: 75, lead_source: 'Referral', owner_id: 3, language_preference: 'en' },
    { id: 3, first_name: 'Khalid', last_name: 'Al-Rashid', first_name_ar: 'خالد', last_name_ar: 'الراشد', email: 'khalid@gulftech.ae', phone: '+971-50-123-4567', job_title: 'مدير تقني', job_title_ar: 'Technical Director', company_id: 2, lead_score: 90, lead_source: 'Conference', owner_id: 4, language_preference: 'ar' },
    { id: 4, first_name: 'Aisha', last_name: 'Al-Saud', first_name_ar: 'عائشة', last_name_ar: 'السعود', email: 'aisha@gulftech.ae', phone: '+971-55-987-6543', job_title: 'CEO', company_id: 2, lead_score: 95, lead_source: 'LinkedIn', owner_id: 4, language_preference: 'ar' },
    { id: 5, first_name: 'Abdullah', last_name: 'Al-Otaibi', first_name_ar: 'عبدالله', last_name_ar: 'العتيبي', email: 'abdullah@riyadh-ind.sa', phone: '+966-50-111-2222', job_title: 'مدير المشتريات', job_title_ar: 'Procurement Manager', company_id: 3, lead_score: 65, lead_source: 'Cold Call', owner_id: 4, language_preference: 'ar' },
    { id: 6, first_name: 'Hans', last_name: 'Mueller', email: 'hans@eurotrade.de', phone: '+49-30-1234-5678', job_title: 'Managing Director', company_id: 4, lead_score: 70, lead_source: 'Email Campaign', owner_id: 5, language_preference: 'en' },
    { id: 7, first_name: 'Sophie', last_name: 'Dubois', email: 'sophie@eurotrade.de', phone: '+49-30-8765-4321', job_title: 'Head of Operations', company_id: 4, lead_score: 55, lead_source: 'Trade Show', owner_id: 5, language_preference: 'en' },
    { id: 8, first_name: 'Mohamed', last_name: 'Fathy', first_name_ar: 'محمد', last_name_ar: 'فتحي', email: 'mohamed@cairolog.eg', phone: '+20-100-123-4567', job_title: 'مدير عام', job_title_ar: 'General Manager', company_id: 5, lead_score: 80, lead_source: 'Referral', owner_id: 8, language_preference: 'ar' },
    { id: 9, first_name: 'James', last_name: 'Brown', email: 'james@pinnacle.io', phone: '+44-20-7946-0321', job_title: 'Partner', company_id: 6, lead_score: 60, lead_source: 'Website', owner_id: 5, language_preference: 'en' },
    { id: 10, first_name: 'Noura', last_name: 'Al-Qahtani', first_name_ar: 'نورة', last_name_ar: 'القحطاني', email: 'noura@desertoasis.sa', phone: '+966-56-333-4444', job_title: 'مديرة التسويق', job_title_ar: 'Marketing Director', company_id: 7, lead_score: 50, lead_source: 'Social Media', owner_id: 4, language_preference: 'ar' },
    { id: 11, first_name: 'Wei', last_name: 'Zhang', email: 'wei@technova.io', phone: '+65-8123-4567', job_title: 'Founder & CEO', company_id: 8, lead_score: 88, lead_source: 'Conference', owner_id: 7, language_preference: 'en' },
    { id: 12, first_name: 'Nikos', last_name: 'Papadopoulos', email: 'nikos@medship.gr', phone: '+30-210-123-4567', job_title: 'COO', company_id: 9, lead_score: 72, lead_source: 'LinkedIn', owner_id: 5, language_preference: 'en' },
    { id: 13, first_name: 'Yasmin', last_name: 'Al-Bahraini', first_name_ar: 'ياسمين', last_name_ar: 'البحرينية', email: 'yasmin@greenenergy.bh', phone: '+973-36-123-456', job_title: 'مديرة المشاريع', job_title_ar: 'Project Manager', company_id: 10, lead_score: 68, lead_source: 'Email Campaign', owner_id: 8, language_preference: 'ar' },
    { id: 14, first_name: 'Robert', last_name: 'Davis', email: 'robert@acme.com', phone: '+1-415-555-0103', job_title: 'CFO', company_id: 1, lead_score: 82, lead_source: 'Referral', owner_id: 3, language_preference: 'en' },
    { id: 15, first_name: 'Layla', last_name: 'Mostafa', first_name_ar: 'ليلى', last_name_ar: 'مصطفى', email: 'layla.m@cairolog.eg', phone: '+20-101-555-6789', job_title: 'مديرة المبيعات', job_title_ar: 'Sales Manager', company_id: 5, lead_score: 63, lead_source: 'Cold Call', owner_id: 8, language_preference: 'ar' },
    { id: 16, first_name: 'Thomas', last_name: 'Weber', email: 'thomas@eurotrade.de', phone: '+49-30-1122-3344', job_title: 'IT Manager', company_id: 4, lead_score: 45, lead_source: 'Trade Show', owner_id: 5, language_preference: 'en' },
    { id: 17, first_name: 'Fahd', last_name: 'Al-Harbi', first_name_ar: 'فهد', last_name_ar: 'الحربي', email: 'fahd@riyadh-ind.sa', phone: '+966-53-555-1234', job_title: 'مهندس رئيسي', job_title_ar: 'Chief Engineer', company_id: 3, lead_score: 58, lead_source: 'Website', owner_id: 4, language_preference: 'ar' },
    { id: 18, first_name: 'Priya', last_name: 'Patel', email: 'priya@technova.io', phone: '+65-9001-2345', job_title: 'VP Engineering', company_id: 8, lead_score: 77, lead_source: 'Referral', owner_id: 7, language_preference: 'en' },
  ];

  for (const c of contacts) {
    await pool.query(
      `INSERT INTO contacts (id, first_name, last_name, first_name_ar, last_name_ar, email, phone, job_title, job_title_ar, company_id, lead_score, lead_source, language_preference, owner_id, created_by, last_contacted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), lead_score=VALUES(lead_score)`,
      [c.id, c.first_name, c.last_name, c.first_name_ar || null, c.last_name_ar || null, c.email, c.phone, c.job_title, c.job_title_ar || null, c.company_id, c.lead_score, c.lead_source, c.language_preference, c.owner_id, c.owner_id]
    );
  }
  console.log(`✅ ${contacts.length} contacts seeded`);

  // ─── 4. SECOND PIPELINE (Renewals) ────────────────────
  await pool.query(
    `INSERT INTO pipelines (id, name, name_ar, description, is_default, created_by)
     VALUES (2, 'Renewals Pipeline', 'خط أنابيب التجديدات', 'For managing contract renewals', FALSE, 1)
     ON DUPLICATE KEY UPDATE name=VALUES(name)`
  );
  const renewalStages = [
    { name: 'Up for Renewal', name_ar: 'قيد التجديد', probability_pct: 50, sort_order: 1, color_hex: '#FDE68A' },
    { name: 'Negotiation', name_ar: 'تفاوض', probability_pct: 75, sort_order: 2, color_hex: '#C4B5FD' },
    { name: 'Renewed', name_ar: 'تم التجديد', probability_pct: 100, sort_order: 3, color_hex: '#86EFAC', is_won: true },
    { name: 'Churned', name_ar: 'مغادر', probability_pct: 0, sort_order: 4, color_hex: '#FCA5A5', is_lost: true },
  ];
  let stageId = 7; // stages 1-6 are the default pipeline
  for (const s of renewalStages) {
    await pool.query(
      `INSERT INTO stages (id, pipeline_id, name, name_ar, probability_pct, sort_order, color_hex, is_won, is_lost)
       VALUES (?, 2, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [stageId++, s.name, s.name_ar, s.probability_pct, s.sort_order, s.color_hex, s.is_won || false, s.is_lost || false]
    );
  }
  console.log('✅ 1 additional pipeline + 4 stages seeded');

  // ─── 5. PRODUCTS ─────────────────────────────────────
  const products = [
    { id: 1, name: 'CRM Starter License', name_ar: 'ترخيص CRM الابتدائي', sku: 'CRM-START', unit_price: 25.00, currency: 'USD', category: 'License' },
    { id: 2, name: 'CRM Pro License', name_ar: 'ترخيص CRM الاحترافي', sku: 'CRM-PRO', unit_price: 50.00, currency: 'USD', category: 'License' },
    { id: 3, name: 'Enterprise License', name_ar: 'ترخيص المؤسسات', sku: 'CRM-ENT', unit_price: 150.00, currency: 'USD', category: 'License' },
    { id: 4, name: 'WhatsApp Integration Add-on', name_ar: 'إضافة تكامل واتساب', sku: 'ADD-WA', unit_price: 15.00, currency: 'USD', category: 'Add-on' },
    { id: 5, name: 'AI Enrichment Add-on', name_ar: 'إضافة الإثراء بالذكاء الاصطناعي', sku: 'ADD-AI', unit_price: 20.00, currency: 'USD', category: 'Add-on' },
    { id: 6, name: 'Implementation Service', name_ar: 'خدمة التنفيذ', sku: 'SVC-IMPL', unit_price: 5000.00, currency: 'USD', category: 'Service' },
    { id: 7, name: 'Training Package', name_ar: 'حزمة التدريب', sku: 'SVC-TRAIN', unit_price: 2000.00, currency: 'USD', category: 'Service' },
  ];
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (id, name, name_ar, sku, unit_price, currency, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), unit_price=VALUES(unit_price)`,
      [p.id, p.name, p.name_ar, p.sku, p.unit_price, p.currency, p.category]
    );
  }
  console.log(`✅ ${products.length} products seeded`);

  // ─── 6. DEALS ─────────────────────────────────────────
  const deals = [
    // Standard Sales Pipeline (id=1): stages 1=Prospect, 2=Qualification, 3=Demo, 4=Negotiation, 5=Won, 6=Lost
    { id: 1, title: 'Acme Corp — Pro License (50 seats)', value: 25000, pipeline_id: 1, stage_id: 4, contact_id: 1, company_id: 1, owner_id: 3, status: 'open', priority: 'high', expected_close_date: '2026-08-15' },
    { id: 2, title: 'Gulf Tech — Enterprise Deal', value: 75000, pipeline_id: 1, stage_id: 3, contact_id: 3, company_id: 2, owner_id: 4, status: 'open', priority: 'high', expected_close_date: '2026-07-30' },
    { id: 3, title: 'Riyadh Industries — Implementation', value: 120000, pipeline_id: 1, stage_id: 2, contact_id: 5, company_id: 3, owner_id: 4, status: 'open', priority: 'medium', expected_close_date: '2026-09-01' },
    { id: 4, title: 'EuroTrade — Starter Package', value: 5000, pipeline_id: 1, stage_id: 1, contact_id: 6, company_id: 4, owner_id: 5, status: 'open', priority: 'low', expected_close_date: '2026-10-15' },
    { id: 5, title: 'Cairo Logistics — Pro License (30 seats)', value: 18000, pipeline_id: 1, stage_id: 4, contact_id: 8, company_id: 5, owner_id: 8, status: 'open', priority: 'high', expected_close_date: '2026-07-25' },
    { id: 6, title: 'Pinnacle Group — Consulting Add-on', value: 8000, pipeline_id: 1, stage_id: 3, contact_id: 9, company_id: 6, owner_id: 5, status: 'open', priority: 'medium', expected_close_date: '2026-08-20' },
    { id: 7, title: 'Desert Oasis — Starter (20 seats)', value: 6000, pipeline_id: 1, stage_id: 2, contact_id: 10, company_id: 7, owner_id: 4, status: 'open', priority: 'medium', expected_close_date: '2026-09-10' },
    { id: 8, title: 'TechNova Labs — Enterprise + AI', value: 45000, pipeline_id: 1, stage_id: 4, contact_id: 11, company_id: 8, owner_id: 7, status: 'open', priority: 'high', expected_close_date: '2026-07-28' },
    { id: 9, title: 'Med Shipping — Pro License (100 seats)', value: 60000, pipeline_id: 1, stage_id: 1, contact_id: 12, company_id: 9, owner_id: 5, status: 'open', priority: 'medium', expected_close_date: '2026-10-01' },
    { id: 10, title: 'Green Energy — Implementation + Training', value: 15000, pipeline_id: 1, stage_id: 3, contact_id: 13, company_id: 10, owner_id: 8, status: 'open', priority: 'medium', expected_close_date: '2026-08-30' },
    // Won deals
    { id: 11, title: 'Acme Corp — Starter (pilot)', value: 3000, pipeline_id: 1, stage_id: 5, contact_id: 2, company_id: 1, owner_id: 3, status: 'won', priority: 'medium', expected_close_date: '2026-06-01', actual_close_date: '2026-05-28' },
    { id: 12, title: 'Gulf Tech — Pro License (25 seats)', value: 15000, pipeline_id: 1, stage_id: 5, contact_id: 4, company_id: 2, owner_id: 4, status: 'won', priority: 'high', expected_close_date: '2026-06-15', actual_close_date: '2026-06-10' },
    { id: 13, title: 'Pinnacle — Consulting Service', value: 5000, pipeline_id: 1, stage_id: 5, contact_id: 9, company_id: 6, owner_id: 5, status: 'won', priority: 'low', expected_close_date: '2026-05-20', actual_close_date: '2026-05-18' },
    { id: 14, title: 'TechNova — Starter (10 seats)', value: 3000, pipeline_id: 1, stage_id: 5, contact_id: 18, company_id: 8, owner_id: 7, status: 'won', priority: 'low', expected_close_date: '2026-06-10', actual_close_date: '2026-06-05' },
    // Lost deals
    { id: 15, title: 'EuroTrade — Enterprise Deal', value: 90000, pipeline_id: 1, stage_id: 6, contact_id: 7, company_id: 4, owner_id: 5, status: 'lost', priority: 'high', expected_close_date: '2026-05-01', loss_reason: 'Went with competitor — cheaper pricing' },
    { id: 16, title: 'Cairo Logistics — Starter', value: 2000, pipeline_id: 1, stage_id: 6, contact_id: 15, company_id: 5, owner_id: 8, status: 'lost', priority: 'low', expected_close_date: '2026-04-15', loss_reason: 'Budget constraints — project delayed' },
    { id: 17, title: 'Riyadh Industries — Pro (50 seats)', value: 30000, pipeline_id: 1, stage_id: 6, contact_id: 17, company_id: 3, owner_id: 4, status: 'lost', priority: 'medium', expected_close_date: '2026-05-30', loss_reason: 'No decision — went silent' },
    // Renewals Pipeline (id=2): stages 7=Up for Renewal, 8=Negotiation, 9=Renewed, 10=Churned
    { id: 18, title: 'Acme Corp — Annual Renewal', value: 30000, pipeline_id: 2, stage_id: 7, contact_id: 14, company_id: 1, owner_id: 3, status: 'open', priority: 'high', expected_close_date: '2026-08-01' },
    { id: 19, title: 'Gulf Tech — Renewal + Upgrade', value: 40000, pipeline_id: 2, stage_id: 8, contact_id: 3, company_id: 2, owner_id: 4, status: 'open', priority: 'high', expected_close_date: '2026-07-20' },
    { id: 20, title: 'Pinnacle — Renewal', value: 5000, pipeline_id: 2, stage_id: 9, contact_id: 9, company_id: 6, owner_id: 5, status: 'won', priority: 'medium', expected_close_date: '2026-06-20', actual_close_date: '2026-06-15' },
    { id: 21, title: 'Med Shipping — Renewal', value: 60000, pipeline_id: 2, stage_id: 10, contact_id: 12, company_id: 9, owner_id: 5, status: 'lost', priority: 'high', expected_close_date: '2026-05-15', loss_reason: 'Switched to in-house solution' },
  ];

  for (const d of deals) {
    await pool.query(
      `INSERT INTO deals (id, title, value, currency, pipeline_id, stage_id, contact_id, company_id, owner_id, status, priority, expected_close_date, actual_close_date, loss_reason, created_by, last_activity_at)
       VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE title=VALUES(title), value=VALUES(value), status=VALUES(status)`,
      [d.id, d.title, d.value, d.pipeline_id, d.stage_id, d.contact_id, d.company_id, d.owner_id, d.status, d.priority, d.expected_close_date, d.actual_close_date || null, d.loss_reason || null]
    );
  }
  console.log(`✅ ${deals.length} deals seeded`);

  // ─── 7. DEAL PRODUCTS ─────────────────────────────────
  const dealProducts = [
    { deal_id: 1, product_id: 2, quantity: 50, unit_price: 50.00 },   // Pro License x50
    { deal_id: 2, product_id: 3, quantity: 100, unit_price: 150.00 }, // Enterprise x100
    { deal_id: 2, product_id: 5, quantity: 100, unit_price: 20.00 },  // AI Add-on x100
    { deal_id: 5, product_id: 2, quantity: 30, unit_price: 50.00 },   // Pro License x30
    { deal_id: 8, product_id: 3, quantity: 200, unit_price: 150.00 }, // Enterprise x200
    { deal_id: 8, product_id: 5, quantity: 200, unit_price: 20.00 },  // AI Add-on x200
    { deal_id: 10, product_id: 6, quantity: 2, unit_price: 5000.00 }, // Implementation x2
    { deal_id: 10, product_id: 7, quantity: 1, unit_price: 2000.00 }, // Training x1
    { deal_id: 19, product_id: 3, quantity: 80, unit_price: 150.00 }, // Enterprise renewal x80
  ];
  for (const dp of dealProducts) {
    await pool.query(
      `INSERT INTO deal_products (deal_id, product_id, quantity, unit_price)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity=VALUES(quantity), unit_price=VALUES(unit_price)`,
      [dp.deal_id, dp.product_id, dp.quantity, dp.unit_price]
    );
  }
  console.log(`✅ ${dealProducts.length} deal-product links seeded`);

  // ─── 8. ACTIVITIES ────────────────────────────────────
  const activities = [
    { activity_type: 'call', subject: 'Initial discovery call', content: 'Discussed pain points around pipeline visibility and lead tracking. Michael is interested in a demo.', contact_id: 1, deal_id: 1, user_id: 3, direction: 'outbound' },
    { activity_type: 'email', subject: 'Proposal sent — Pro License', content: 'Sent the detailed proposal for 50 Pro licenses with volume discount.', contact_id: 1, deal_id: 1, user_id: 3, direction: 'outbound' },
    { activity_type: 'meeting', subject: 'Product Demo', content: 'Conducted a 60-minute demo. Khalid was impressed with the Kanban board and AI features.', contact_id: 3, deal_id: 2, user_id: 4, direction: 'internal' },
    { activity_type: 'whatsapp', subject: 'Follow-up message', content: 'أرسل رسالة متابعة عبر واتساب لتأكيد موعد العرض التوضيحي.', content_ar: 'Sent a follow-up WhatsApp message to confirm demo time.', contact_id: 3, deal_id: 2, user_id: 4, direction: 'outbound' },
    { activity_type: 'note', subject: 'Competitor mentioned', content: 'Hans mentioned they are also evaluating Salesforce. Need to emphasize our bilingual features.', contact_id: 6, deal_id: 4, user_id: 5, direction: 'internal' },
    { activity_type: 'call', subject: 'Pricing negotiation', content: 'Negotiated pricing for 30 Pro licenses. Agreed on 10% volume discount.', contact_id: 8, deal_id: 5, user_id: 8, direction: 'outbound' },
    { activity_type: 'email', subject: 'Contract draft', content: 'Sent the contract draft for review. Awaiting legal team approval.', contact_id: 8, deal_id: 5, user_id: 8, direction: 'outbound' },
    { activity_type: 'meeting', subject: 'Technical deep-dive', content: 'Technical session with Priya and Wei. Covered API integration and SSO setup.', contact_id: 11, deal_id: 8, user_id: 7, direction: 'internal' },
    { activity_type: 'note', subject: 'Budget approved', content: 'Abdullah confirmed the budget is approved for the implementation project. Moving to qualification.', contact_id: 5, deal_id: 3, user_id: 4, direction: 'internal' },
    { activity_type: 'call', subject: 'Onboarding call', content: 'Welcome call for the pilot program. Sara will be the main point of contact.', contact_id: 2, deal_id: 11, user_id: 3, direction: 'outbound' },
    { activity_type: 'email', subject: 'Welcome email', content: 'Sent a bilingual welcome email with onboarding instructions.', contact_id: 4, deal_id: 12, user_id: 4, direction: 'outbound' },
    { activity_type: 'note', subject: 'Lost deal — competitor', content: 'Lost to Salesforce. They offered a 40% discount for the first year. Need to improve our competitive positioning.', contact_id: 7, deal_id: 15, user_id: 5, direction: 'internal' },
    { activity_type: 'whatsapp', subject: 'Renewal reminder', content: 'Sent renewal reminder 60 days before expiry. Robert acknowledged receipt.', contact_id: 14, deal_id: 18, user_id: 3, direction: 'outbound' },
    { activity_type: 'call', subject: 'Renewal discussion', content: 'Discussed renewal terms. Khalid wants to upgrade to Enterprise tier.', contact_id: 3, deal_id: 19, user_id: 4, direction: 'outbound' },
    { activity_type: 'meeting', subject: 'Quarterly Business Review', content: 'QBR with Acme Corp. Reviewed usage metrics and identified upsell opportunities for WhatsApp integration.', contact_id: 1, deal_id: 1, user_id: 3, direction: 'internal' },
    { activity_type: 'email', subject: 'ROI report', content: 'Sent an ROI analysis report showing 3x improvement in sales velocity since implementing CRM.', contact_id: 1, deal_id: 1, user_id: 3, direction: 'outbound' },
    { activity_type: 'note', subject: 'Churned — went in-house', content: 'Nikos decided to build an in-house solution. No budget for external tools this fiscal year.', contact_id: 12, deal_id: 21, user_id: 5, direction: 'internal' },
    { activity_type: 'call', subject: 'Cold call follow-up', content: 'Called Mohamed to follow up on the initial proposal. He asked for more info on the Arabic RTL support.', contact_id: 8, deal_id: 5, user_id: 8, direction: 'outbound' },
    { activity_type: 'task', subject: 'Send revised proposal', content: 'Need to send revised proposal with updated pricing by end of week.', contact_id: 6, deal_id: 4, user_id: 5, direction: 'internal', scheduled_at: '2026-07-18' },
    { activity_type: 'email', subject: 'LinkedIn follow-up', content: 'Connected with Wei on LinkedIn and sent a personalized follow-up message.', contact_id: 11, deal_id: 8, user_id: 7, direction: 'outbound' },
    { activity_type: 'call', subject: 'Discovery call', content: 'Called Noura to understand their marketing team needs. She is interested in the reporting features.', contact_id: 10, deal_id: 7, user_id: 4, direction: 'outbound' },
    { activity_type: 'note', subject: 'Decision maker identified', content: 'Aisha is the final decision maker. She wants to see the WhatsApp integration in action.', contact_id: 4, deal_id: 2, user_id: 4, direction: 'internal' },
    { activity_type: 'meeting', subject: 'Contract signing meeting', content: 'Scheduled meeting to sign the renewed contract. Green Energy wants to add the training package.', contact_id: 13, deal_id: 10, user_id: 8, direction: 'internal' },
    { activity_type: 'email', subject: 'Invoice sent', content: 'Sent invoice for the implementation service. Net 30 payment terms.', contact_id: 9, deal_id: 13, user_id: 5, direction: 'outbound' },
    { activity_type: 'call', subject: 'Check-in call', content: 'Called Thomas to check on their IT requirements. He needs SSO integration.', contact_id: 16, deal_id: 4, user_id: 5, direction: 'outbound' },
  ];

  for (const a of activities) {
    await pool.query(
      `INSERT INTO activities (activity_type, subject, content, content_ar, contact_id, deal_id, company_id, user_id, direction, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT company_id FROM contacts WHERE id = ?), ?, ?, ?)`,
      [a.activity_type, a.subject, a.content, a.content_ar || null, a.contact_id, a.deal_id || null, a.contact_id, a.user_id, a.direction, a.scheduled_at || null]
    );
  }
  console.log(`✅ ${activities.length} activities seeded`);

  // ─── 9. EMAIL TEMPLATES ───────────────────────────────
  const templates = [
    {
      name: 'Follow-up after demo', category: 'follow-up', is_shared: true, created_by: 1,
      subject: 'Thank you for your time — Next steps', subject_ar: 'شكراً على وقتك — الخطوات التالية',
      body: 'Dear [Name],\n\nThank you for taking the time to see our CRM demo today. As discussed, here are the next steps:\n\n1. We will send you a detailed proposal\n2. Schedule a technical deep-dive session\n3. Set up a pilot account for your team\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]',
      body_ar: 'عزيزي [الاسم]،\n\nشكراً لك على وقتك لعرض نظام إدارة علاقات العملاء اليوم. كما ناقشنا، إليك الخطوات التالية:\n\n1. سنرسل لك عرضاً تفصيلياً\n2. جدولة جلسة تقنية متعمقة\n3. إعداد حساب تجريبي لفريقك\n\nيرجى إعلامي إذا كان لديك أي أسئلة.\n\nمع أطيب التحيات،\n[اسمك]',
    },
    {
      name: 'Welcome email (new customer)', category: 'onboarding', is_shared: true, created_by: 1,
      subject: 'Welcome to the CRM family! 🎉', subject_ar: 'مرحباً بك في عائلة نظام إدارة علاقات العملات! 🎉',
      body: 'Dear [Name],\n\nWelcome aboard! We are thrilled to have [Company] join us.\n\nHere is how to get started:\n1. Check your inbox for login credentials\n2. Watch our 5-minute quick-start video\n3. Import your contacts via CSV\n\nNeed help? Reply to this email anytime.\n\nWelcome again!\n[Your Name]',
      body_ar: 'عزيزي [الاسم]،\n\nمرحباً بك! نحن متحمسون لانضمام [الشركة] إلينا.\n\nإليك كيفية البدء:\n1. تحقق من بريدك الوارد لبيانات الدخول\n2. شاهد فيديو البدء السريع (5 دقائق)\n3. استورد جهات اتصالك عبر ملف CSV\n\nتحتاج مساعدة؟ رد على هذا البريد في أي وقت.\n\nمرحباً بك مجدداً!\n[اسمك]',
    },
    {
      name: 'Renewal reminder (60 days)', category: 'renewal', is_shared: true, created_by: 1,
      subject: 'Your subscription renews in 60 days', subject_ar: 'يتجدد اشتراكك خلال 60 يوماً',
      body: 'Dear [Name],\n\nThis is a friendly reminder that your CRM subscription is set to renew on [Date].\n\nCurrent plan: [Plan]\nSeats: [Count]\n\nWould you like to discuss upgrades or changes? Reply to this email.\n\nBest regards,\n[Your Name]',
      body_ar: 'عزيزي [الاسم]،\n\nهذه تذكير ودية بأن اشتراكك في نظام إدارة علاقات العملاء سيتجدد في [التاريخ].\n\nالخطة الحالية: [الخطة]\nالمقاعد: [العدد]\n\nهل ترغب في مناقشة الترقيات أو التغييرات؟ رد على هذا البريد.\n\nمع أطيب التحيات،\n[اسمك]',
    },
    {
      name: 'Cold outreach (first contact)', category: 'prospecting', is_shared: true, created_by: 1,
      subject: 'Helping [Company] close more deals', subject_ar: 'مساعدة [الشركة] في إغلاق المزيد من الصفقات',
      body: 'Hi [Name],\n\nI noticed [Company] is growing fast in the [Industry] space. Many companies like yours struggle with:\n\n- Tracking deals across multiple sales reps\n- Bilingual communication (English & Arabic)\n- Knowing which leads to prioritize\n\nOur CRM platform solves all three. Would you be open to a 15-minute call this week?\n\nBest,\n[Your Name]',
      body_ar: 'مرحباً [الاسم]،\n\nلاحظت أن [الشركة] تنمو بسرعة في قطاع [الصناعة]. 许多类似贵公司的企业在以下方面面临挑战：\n\n- تتبع الصفقات عبر مندوبي المبيعات\n- التواصل ثنائي اللغة (الإنجليزية والعربية)\n- معرفة العملاء الأكثر أولوية\n\nمنصة إدارة علاقات العملاء لدينا تحل هذه المشاكل الثلاثة. هل أنت متاح لمكالمة مدتها 15 دقيقة هذا الأسبوع؟\n\nتحياتي،\n[اسمك]',
    },
    {
      name: 'Lost deal — feedback request', category: 'feedback', is_shared: false, created_by: 1,
      subject: 'Quick question about your decision', subject_ar: 'سؤال سريع حول قرارتك',
      body: 'Hi [Name],\n\nThank you for considering us. I understand you went in a different direction.\n\nCould you share what tipped your decision? Your feedback helps us improve.\n\nWas it: pricing, features, timing, or something else?\n\nThanks!\n[Your Name]',
      body_ar: 'مرحباً [الاسم]،\n\nشكراً على تفكيرك فينا. أتفهم أنك اتخذت قراراً مختلفاً.\n\nهل يمكنك مشاركة ما أثر في قرارك؟ ملاحظاتك تساعدنا على التحسن.\n\nهل كان: التسعير، الميزات، التوقيت، أم شيئاً آخر؟\n\nشكراً!\n[اسمك]',
    },
  ];
  for (const tpl of templates) {
    await pool.query(
      `INSERT INTO email_templates (name, subject, subject_ar, body, body_ar, category, is_shared, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tpl.name, tpl.subject, tpl.subject_ar, tpl.body, tpl.body_ar, tpl.category, tpl.is_shared, tpl.created_by]
    );
  }
  console.log(`✅ ${templates.length} email templates seeded`);

  // ─── 10. AUTOMATIONS ──────────────────────────────────
  const automations = [
    {
      name: 'Welcome email on deal won', description: 'Sends a welcome email when a deal moves to Won stage',
      trigger_type: 'deal_stage_changed', trigger_config: { stage_name: 'Won' },
      action_type: 'send_email', action_config: { subject: 'Welcome to the CRM family!', body: 'Dear [Name],\n\nWelcome aboard! We are thrilled to have you on board.' },
      created_by: 1,
    },
    {
      name: 'Create task on new contact', description: 'Creates a follow-up task when a new contact is created',
      trigger_type: 'contact_created', trigger_config: {},
      action_type: 'create_task', action_config: { task_title: 'Initial outreach to new contact', task_description: 'Reach out within 48 hours of contact creation' },
      created_by: 1,
    },
    {
      name: 'Notify on high lead score', description: 'Creates a task when a contact reaches lead score 70+',
      trigger_type: 'lead_score_reached', trigger_config: { threshold: 70 },
      action_type: 'create_task', action_config: { task_title: 'High-value lead — prioritize outreach', task_description: 'This contact has a lead score of 70+. Reach out immediately.' },
      created_by: 1,
    },
    {
      name: 'Reminder 7 days before close', description: 'Creates a reminder task 7 days before expected close date',
      trigger_type: 'date_reached', trigger_config: { days_before_close: 7 },
      action_type: 'create_task', action_config: { task_title: 'Deal closing soon — follow up', task_description: 'This deal is expected to close within 7 days. Confirm final details.' },
      created_by: 1,
    },
    {
      name: 'Round-robin lead assignment', description: 'Auto-assigns new contacts to available reps (round-robin)',
      trigger_type: 'contact_created', trigger_config: {},
      action_type: 'assign_owner', action_config: { routing_rule: 'round_robin' },
      created_by: 1,
    },
  ];
  for (const a of automations) {
    await pool.query(
      `INSERT INTO automations (name, description, trigger_type, trigger_config, action_type, action_config, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [a.name, a.description, a.trigger_type, JSON.stringify(a.trigger_config), a.action_type, JSON.stringify(a.action_config), a.created_by]
    );
  }
  console.log(`✅ ${automations.length} automations seeded`);

  // ─── 11. CUSTOM FIELDS ────────────────────────────────
  const customFields = [
    { entity_type: 'company', field_name: 'employee_count_exact', field_label: 'Exact Employee Count', field_label_ar: 'عدد الموظفين الدقيق', field_type: 'number', sort_order: 1 },
    { entity_type: 'company', field_name: 'preferred_language', field_label: 'Preferred Communication Language', field_label_ar: 'لغة التواصل المفضلة', field_type: 'dropdown', field_options: JSON.stringify(['English', 'Arabic', 'Bilingual']), sort_order: 2 },
    { entity_type: 'contact', field_name: 'birthday', field_label: 'Birthday', field_label_ar: 'تاريخ الميلاد', field_type: 'date', sort_order: 1 },
    { entity_type: 'deal', field_name: 'discount_pct', field_label: 'Discount %', field_label_ar: 'نسبة الخصم', field_type: 'number', sort_order: 1 },
    { entity_type: 'deal', field_name: 'competitor', field_label: 'Competitor', field_label_ar: 'المنافس', field_type: 'dropdown', field_options: JSON.stringify(['Salesforce', 'HubSpot', 'Zoho', 'Pipedrive', 'Other']), sort_order: 2 },
  ];
  for (const cf of customFields) {
    await pool.query(
      `INSERT INTO custom_fields (entity_type, field_name, field_label, field_label_ar, field_type, field_options, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE field_label=VALUES(field_label)`,
      [cf.entity_type, cf.field_name, cf.field_label, cf.field_label_ar, cf.field_type, cf.field_options || null, cf.sort_order]
    );
  }
  // Add some custom field values
  await pool.query(`INSERT INTO custom_field_values (custom_field_id, entity_type, entity_id, value) VALUES (1, 'company', 1, '650') ON DUPLICATE KEY UPDATE value=VALUES(value)`);
  await pool.query(`INSERT INTO custom_field_values (custom_field_id, entity_type, entity_id, value) VALUES (2, 'company', 2, 'Arabic') ON DUPLICATE KEY UPDATE value=VALUES(value)`);
  await pool.query(`INSERT INTO custom_field_values (custom_field_id, entity_type, entity_id, value) VALUES (4, 'deal', 1, '10') ON DUPLICATE KEY UPDATE value=VALUES(value)`);
  await pool.query(`INSERT INTO custom_field_values (custom_field_id, entity_type, entity_id, value) VALUES (5, 'deal', 15, 'Salesforce') ON DUPLICATE KEY UPDATE value=VALUES(value)`);
  console.log(`✅ ${customFields.length} custom fields + 4 values seeded`);

  // ─── 12. AI RECOMMENDATIONS ──────────────────────────
  const recommendations = [
    { deal_id: 4, contact_id: 6, recommendation_type: 'draft_email', title: 'Follow up: "EuroTrade — Starter Package" — 21 days inactive', description: 'Send a follow-up email to Hans at EuroTrade to keep the deal moving. The deal has been in Prospect stage for over 3 weeks.', priority_score: 65 },
    { deal_id: 9, contact_id: 12, recommendation_type: 'schedule_meeting', title: 'Schedule demo: "Med Shipping — Pro License" needs a push', description: 'Deal worth $60,000 is stalling in Prospect stage. Propose a product demo to Nikos to move it forward.', priority_score: 70 },
    { deal_id: 3, contact_id: 5, recommendation_type: 'follow_up', title: 'Close soon: "Riyadh Industries — Implementation" is in Qualification', description: 'High-value deal ($120,000). Abdullah confirmed budget is approved. Schedule a meeting to move to demo stage.', priority_score: 85 },
    { deal_id: 7, contact_id: 10, recommendation_type: 're_engage', title: 'Re-engage: "Desert Oasis — Starter" has been inactive for 35 days', description: 'This deal worth $6,000 has had no activity for over a month. Consider a direct call to Noura with a new value proposition.', priority_score: 60 },
    { deal_id: 6, contact_id: 9, recommendation_type: 'draft_email', title: 'Follow up: "Pinnacle — Consulting Add-on" — 18 days inactive', description: 'Send a follow-up email to James at Pinnacle Group to re-engage on the consulting add-on deal.', priority_score: 55 },
  ];
  for (const r of recommendations) {
    await pool.query(
      `INSERT INTO ai_recommendations (deal_id, contact_id, recommendation_type, title, description, suggested_action, priority_score, is_dismissed)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [r.deal_id, r.contact_id, r.recommendation_type, r.title, r.description, r.description, r.priority_score]
    );
  }
  console.log(`✅ ${recommendations.length} AI recommendations seeded`);

  // ─── 13. AUDIT LOGS ───────────────────────────────────
  const auditEntries = [
    { user_id: 1, entity_type: 'user', entity_id: 2, action: 'create', ip: '127.0.0.1' },
    { user_id: 1, entity_type: 'company', entity_id: 1, action: 'create', ip: '127.0.0.1' },
    { user_id: 3, entity_type: 'deal', entity_id: 1, action: 'create', ip: '127.0.0.1' },
    { user_id: 3, entity_type: 'deal', entity_id: 11, action: 'update', ip: '127.0.0.1' },
    { user_id: 1, entity_type: 'user', entity_id: 1, action: 'login', ip: '127.0.0.1' },
    { user_id: 4, entity_type: 'contact', entity_id: 3, action: 'create', ip: '127.0.0.1' },
    { user_id: 4, entity_type: 'deal', entity_id: 2, action: 'update', ip: '127.0.0.1' },
    { user_id: 5, entity_type: 'company', entity_id: 4, action: 'create', ip: '127.0.0.1' },
    { user_id: 1, entity_type: 'user', entity_id: 5, action: 'create', ip: '127.0.0.1' },
    { user_id: 8, entity_type: 'deal', entity_id: 5, action: 'create', ip: '127.0.0.1' },
    { user_id: 3, entity_type: 'deal', entity_id: 11, action: 'update', ip: '127.0.0.1' },
    { user_id: 5, entity_type: 'deal', entity_id: 15, action: 'delete', ip: '127.0.0.1' },
  ];
  for (const a of auditEntries) {
    await pool.query(
      `INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [a.user_id, a.entity_type, a.entity_id, a.action, a.ip]
    );
  }
  console.log(`✅ ${auditEntries.length} audit log entries seeded`);

  // ─── 14. SUBSCRIPTION ─────────────────────────────────
  await pool.query(
    `INSERT INTO subscriptions (company_name, plan, status, user_count, price_per_user, trial_ends_at, current_period_start, current_period_end)
     VALUES ('CRM Platform Inc.', 'pro', 'active', 8, 50.00, '2026-06-01', '2026-07-01', '2026-08-01')
     ON DUPLICATE KEY UPDATE plan=VALUES(plan), status=VALUES(status)`
  );
  console.log('✅ 1 subscription seeded');

  // ─── 15. NOTIFICATIONS ─────────────────────────────
  const notifications = [
    { user_id: 1, type: 'ai', title: 'AI suggestion: Follow up with Hans (EuroTrade)', message: 'Idle for 21 days. Draft a follow-up email to keep the deal moving.', link: '/deals/4', is_read: 0 },
    { user_id: 1, type: 'warning', title: 'Deal expiring soon', message: '“Gulf Tech — Renewal + Upgrade” is expected to close on 2026-07-20.', link: '/deals/19', is_read: 0 },
    { user_id: 1, type: 'success', title: 'Deal won', message: '“TechNova — Starter (10 seats)” was closed-won for $3,000.', link: '/deals/14', is_read: 0 },
    { user_id: 3, type: 'deal', title: 'New deal assigned', message: '“Acme Corp — Pro License (50 seats)” has been assigned to you.', link: '/deals/1', is_read: 0 },
    { user_id: 3, type: 'info', title: 'Reminder', message: 'Demo scheduled with Khalid tomorrow at 10:00 AM.', link: '/deals/2', is_read: 1 },
    { user_id: 4, type: 'ai', title: 'Lead score update', message: 'Gulf Tech scored 88/100 — high priority. Consider escalation.', link: '/companies/2', is_read: 0 },
    { user_id: 4, type: 'warning', title: 'Stagnant deal', message: '“Riyadh Industries — Implementation” has had no activity for 14 days.', link: '/deals/3', is_read: 0 },
    { user_id: 5, type: 'success', title: 'Deal won', message: '“Pinnacle — Consulting Service” was closed-won for $5,000.', link: '/deals/13', is_read: 1 },
    { user_id: 5, type: 'error', title: 'Deal lost', message: '“Med Shipping — Renewal” lost to in-house solution.', link: '/deals/21', is_read: 0 },
  ];
  for (const n of notifications) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 72) HOUR))`,
      [n.user_id, n.type, n.title, n.message, n.link, n.is_read]
    );
  }
  console.log(`✅ ${notifications.length} notifications seeded`);

  // ─── 16. WHATSAPP LOGS (in-app messenger threads) ───
  // Bilingual conversation threads so the Messages tab has content immediately.
  // dev-mode logs only (no paid WhatsApp API required).
  const waLogs = [
    // Thread: Michael Johnson (contact 1) — English
    { contact_id: 1, to_number: '+1-415-555-0101', message: 'Hi Michael, sending over the Pro License proposal as discussed. 📄', direction: 'outbound', status: 'read', mins: 240 },
    { contact_id: 1, to_number: '+1-415-555-0101', message: 'Thanks! Just opened it — the volume discount looks great. Quick question: does the Pro tier include the WhatsApp integration out of the box?', direction: 'inbound', status: 'read', mins: 220 },
    { contact_id: 1, to_number: '+1-415-555-0101', message: 'Yes, Pro includes unlimited WhatsApp messaging + AI enrichments. Starter is email-only.', direction: 'outbound', status: 'read', mins: 210 },
    { contact_id: 1, to_number: '+1-415-555-0101', message: 'Perfect. Let me run it by Robert (CFO) and I will get back to you by Friday.', direction: 'inbound', status: 'read', mins: 90 },
    { contact_id: 1, to_number: '+1-415-555-0101', message: 'Sounds good — I will hold the 50-seat pricing until then. Talk soon!', direction: 'outbound', status: 'read', mins: 80 },
    // Thread: Khalid Al-Rashid (contact 3) — Arabic
    { contact_id: 3, to_number: '+971-50-123-4567', message: 'مرحباً خالد، تم تأكيد موعد العرض التوضيحي يوم الخميس الساعة 10 صباحاً. 📅', direction: 'outbound', status: 'read', mins: 600 },
    { contact_id: 3, to_number: '+971-50-123-4567', message: 'شكراً لك، سأكون حاضراً. هل يمكن إرسال رابط الاجتماع مقدماً؟', direction: 'inbound', status: 'read', mins: 580 },
    { contact_id: 3, to_number: '+971-50-123-4567', message: 'بالتأكيد، سأرسل الرابط عبر البريد الإلكتروني بعد قليل. 📧', direction: 'outbound', status: 'read', mins: 560 },
    { contact_id: 3, to_number: '+971-50-123-4567', message: 'تم الاستلام، شكراً جزيلاً. العرض التوضيحي أعجبني كثيراً 😄', direction: 'inbound', status: 'read', mins: 80 },
    // Thread: Aisha Al-Saud (contact 4) — Arabic, has unread (recent inbound)
    { contact_id: 4, to_number: '+971-55-987-6543', message: 'سلامة دكتورة عائشة، هل يمكنكم تزويدنا بعرض توضيحي لتكامل واتساب؟', direction: 'outbound', status: 'read', mins: 300 },
    { contact_id: 4, to_number: '+971-55-987-6543', message: 'نعم بالتأكيد، هذا يهمّنا كثيراً. متى يكون متاح لديكم هذا الأسبوع؟', direction: 'inbound', status: 'read', mins: 280 },
    { contact_id: 4, to_number: '+971-55-987-6543', message: 'متاح في أي وقت بعد ظهر الثلاثاء. سأرسل لك دعوة التقويم.', direction: 'outbound', status: 'read', mins: 270 },
    { contact_id: 4, to_number: '+971-55-987-6543', message: 'ممتاز، في انتظار الدعوة. لي سؤال أخير: هل تكامل واتساب يدعم الردود التلقائية؟ 🤖', direction: 'inbound', status: 'read', mins: 15 },
    // Thread: Hans Mueller (contact 6) — English, has unread (recent inbound)
    { contact_id: 6, to_number: '+49-30-1234-5678', message: 'Hallo Hans, following up on the Starter package we discussed. Are you still evaluating?', direction: 'outbound', status: 'read', mins: 1440 },
    { contact_id: 6, to_number: '+49-30-1234-5678', message: 'Hi! Yes, we are comparing you with Salesforce at the moment. Can you send the comparison sheet?', direction: 'inbound', status: 'read', mins: 1380 },
    { contact_id: 6, to_number: '+49-30-1234-5678', message: 'Absolutely. Sending it now — happy to jump on a call to walk through the differences. 📞', direction: 'outbound', status: 'read', mins: 1370 },
    { contact_id: 6, to_number: '+49-30-1234-5678', message: 'Got it, thanks. One thing: your bilingual EN/AR support is a big plus for our Dubai office.', direction: 'inbound', status: 'read', mins: 30 },
    // Thread: Mohamed Fathy (contact 8) — Arabic
    { contact_id: 8, to_number: '+20-100-123-4567', message: 'أهلاً محمد، تم إرسال مسودة العقد للمراجعة. بانتظار موافقة الفريق القانوني.', direction: 'outbound', status: 'read', mins: 720 },
    { contact_id: 8, to_number: '+20-100-123-4567', message: 'استلمناها، الفريق القانوني سيراجعها خلال 48 ساعة. شكراً', direction: 'inbound', status: 'read', mins: 700 },
    { contact_id: 8, to_number: '+20-100-123-4567', message: 'تمام، في انتظار الرد. سأكون متاحاً لأي استفسار. 👍', direction: 'outbound', status: 'read', mins: 690 },
    // Thread: Wei Zhang (contact 11) — English
    { contact_id: 11, to_number: '+65-8123-4567', message: 'Hi Wei, great connecting at the conference! Here is the technical API doc you asked for. 🔗', direction: 'outbound', status: 'read', mins: 2880 },
    { contact_id: 11, to_number: '+65-8123-4567', message: 'Thanks! Priya and I will review the SSO setup section this week.', direction: 'inbound', status: 'read', mins: 2820 },
    { contact_id: 11, to_number: '+65-8123-4567', message: 'Sounds great. Let me know if you need a sandbox environment to test against. 🛠️', direction: 'outbound', status: 'read', mins: 2810 },
    // Thread: Noura Al-Qahtani (contact 10) — Arabic, has unread (recent inbound)
    { contact_id: 10, to_number: '+966-56-333-4444', message: 'مرحباً نورة، أتمنى أن تكوني بخير. هل لديكِ أي استفسار حول ميزة التقارير؟', direction: 'outbound', status: 'read', mins: 1800 },
    { contact_id: 10, to_number: '+966-56-333-4444', message: 'نعم، هل يمكن تخصيص لوحات التقارير حسب الفريق؟', direction: 'inbound', status: 'read', mins: 60 },
    // Thread: Robert Davis (contact 14) — English (renewal reminder activity mirror)
    { contact_id: 14, to_number: '+1-415-555-0103', message: 'Hi Robert, sending a friendly reminder — your renewal is coming up in 60 days. Let me know if you want to keep the same plan or upgrade.', direction: 'outbound', status: 'read', mins: 3000 },
    { contact_id: 14, to_number: '+1-415-555-0103', message: 'Thanks for the heads up. We are happy with the current plan — please send the renewal invoice.', direction: 'inbound', status: 'read', mins: 2950 },
  ];
  for (const w of waLogs) {
    // Only seed when the table is empty, so re-running the seed script
    // doesn't create duplicate conversation logs.
    const [[waCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM whatsapp_logs');
    if (Number(waCount.cnt) > 0) {
      console.log('ℹ️  WhatsApp logs already present — skipping WA seed (idempotent)');
      break;
    }
    await pool.query(
      `INSERT INTO whatsapp_logs (contact_id, to_number, message, direction, status, wa_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
      [w.contact_id, w.to_number, w.message, w.direction, w.status, `seed_${w.contact_id}_${w.mins}`, w.mins]
    );
  }
  console.log(`✅ ${waLogs.length} WhatsApp conversation logs seeded`);

  console.log('\n🎉 Database seeding complete!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Login credentials (all users same password):');
  console.log('  Password: password123');
  console.log('');
  console.log('  Admin:     admin@crm.com');
  console.log('  Manager:   sara@crm.com  (Arabic)');
  console.log('  Manager:   fatima@crm.com (Arabic)');
  console.log('  Rep:       john@crm.com');
  console.log('  Rep:       ahmed@crm.com (Arabic)');
  console.log('  Rep:       maria@crm.com');
  console.log('  Rep:       david@crm.com');
  console.log('  Rep:       layla@crm.com (Arabic)');
  console.log('═══════════════════════════════════════════════════\n');

  await pool.end();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
