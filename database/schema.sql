-- ============================================================
-- CRM DATABASE SCHEMA
-- Bilingual B2B SaaS CRM (MySQL 8+)
-- Charset: utf8mb4 for full Arabic + English support
-- ============================================================

CREATE DATABASE IF NOT EXISTS crm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE crm_db;

-- -----------------------------------------------------------
-- 1. USERS (Sales reps, managers, admins)
-- -----------------------------------------------------------
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  role ENUM('rep', 'manager', 'admin') NOT NULL DEFAULT 'rep',
  language ENUM('en', 'ar') NOT NULL DEFAULT 'en',
  territory VARCHAR(100),
  avatar_url VARCHAR(500),
  manager_id INT UNSIGNED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_users_role (role),
  INDEX idx_users_manager (manager_id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 2. COMPANIES (B2B target accounts)
-- -----------------------------------------------------------
CREATE TABLE companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  domain VARCHAR(255),
  industry VARCHAR(150),
  company_size VARCHAR(50),
  annual_revenue DECIMAL(15,2),
  logo_url VARCHAR(500),
  website VARCHAR(500),
  phone VARCHAR(30),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  linkedin_url VARCHAR(500),
  description TEXT,
  description_ar TEXT,
  enrichment_source VARCHAR(100),
  enrichment_date DATETIME,
  owner_id INT UNSIGNED,
  created_by INT UNSIGNED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_companies_domain (domain),
  INDEX idx_companies_industry (industry),
  INDEX idx_companies_owner (owner_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 3. CONTACTS (People at companies)
-- -----------------------------------------------------------
CREATE TABLE contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name_ar VARCHAR(100),
  last_name_ar VARCHAR(100),
  email VARCHAR(255),
  email_alt VARCHAR(255),
  phone VARCHAR(30),
  phone_alt VARCHAR(30),
  mobile VARCHAR(30),
  job_title VARCHAR(200),
  job_title_ar VARCHAR(200),
  department VARCHAR(150),
  company_id INT UNSIGNED NOT NULL,
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  linkedin_url VARCHAR(500),
  notes TEXT,
  lead_score INT UNSIGNED DEFAULT 0,
  lead_source VARCHAR(100),
  language_preference ENUM('en', 'ar') DEFAULT 'en',
  owner_id INT UNSIGNED,
  created_by INT UNSIGNED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_contacted_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_contacts_email (email),
  INDEX idx_contacts_company (company_id),
  INDEX idx_contacts_owner (owner_id),
  INDEX idx_contacts_score (lead_score)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 4. PIPELINES (Sales processes)
-- -----------------------------------------------------------
CREATE TABLE pipelines (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  name_ar VARCHAR(150),
  description TEXT,
  description_ar TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_pipelines_default (is_default)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 5. STAGES (Steps within a pipeline)
-- -----------------------------------------------------------
CREATE TABLE stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pipeline_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  name_ar VARCHAR(150),
  probability_pct INT UNSIGNED NOT NULL DEFAULT 0,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  color_hex VARCHAR(7) DEFAULT '#6B7280',
  is_won BOOLEAN NOT NULL DEFAULT FALSE,
  is_lost BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
  INDEX idx_stages_pipeline (pipeline_id),
  INDEX idx_stages_order (sort_order)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 6. PRODUCT CATALOG
-- -----------------------------------------------------------
CREATE TABLE products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  sku VARCHAR(100),
  description TEXT,
  description_ar TEXT,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 7. DEALS (Money on the table)
-- -----------------------------------------------------------
CREATE TABLE deals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255),
  value DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  pipeline_id INT UNSIGNED NOT NULL,
  stage_id INT UNSIGNED NOT NULL,
  contact_id INT UNSIGNED,
  company_id INT UNSIGNED,
  owner_id INT UNSIGNED,
  expected_close_date DATE,
  actual_close_date DATE,
  status ENUM('open', 'won', 'lost', 'archived') NOT NULL DEFAULT 'open',
  loss_reason TEXT,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  notes TEXT,
  last_activity_at DATETIME,
  rotting_threshold_days INT UNSIGNED DEFAULT 14,
  created_by INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE RESTRICT,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE RESTRICT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_deals_stage (stage_id),
  INDEX idx_deals_pipeline (pipeline_id),
  INDEX idx_deals_owner (owner_id),
  INDEX idx_deals_status (status),
  INDEX idx_deals_close_date (expected_close_date),
  INDEX idx_deals_company (company_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 8. DEAL PRODUCTS (Junction: Deals <-> Products)
-- -----------------------------------------------------------
CREATE TABLE deal_products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_deal_product (deal_id, product_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 9. ACTIVITIES (Logged history for contacts & deals)
-- -----------------------------------------------------------
CREATE TABLE activities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  activity_type ENUM('call','email','meeting','note','whatsapp','task','sms','other') NOT NULL,
  subject VARCHAR(500),
  content TEXT,
  content_ar TEXT,
  contact_id INT UNSIGNED,
  deal_id INT UNSIGNED,
  company_id INT UNSIGNED,
  user_id INT UNSIGNED NOT NULL,
  direction ENUM('inbound','outbound','internal') DEFAULT 'internal',
  call_duration_sec INT UNSIGNED,
  email_message_id VARCHAR(500),
  email_thread_id VARCHAR(500),
  email_opened BOOLEAN DEFAULT FALSE,
  email_clicked BOOLEAN DEFAULT FALSE,
  whatsapp_message_id VARCHAR(255),
  scheduled_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_activities_contact (contact_id),
  INDEX idx_activities_deal (deal_id),
  INDEX idx_activities_user (user_id),
  INDEX idx_activities_type (activity_type),
  INDEX idx_activities_created (created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 10. EMAIL TEMPLATES & SNIPPETS
-- -----------------------------------------------------------
CREATE TABLE email_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  subject VARCHAR(500),
  subject_ar VARCHAR(500),
  body TEXT,
  body_ar TEXT,
  category VARCHAR(100),
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_templates_category (category)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 11. WORKFLOW AUTOMATIONS
-- -----------------------------------------------------------
CREATE TABLE automations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_type ENUM('deal_stage_changed','deal_created','contact_created','lead_score_reached','date_reached','manual') NOT NULL,
  trigger_config JSON,
  action_type ENUM('send_email','create_task','update_field','send_whatsapp','assign_owner','webhook') NOT NULL,
  action_config JSON,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT UNSIGNED,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_automations_trigger (trigger_type)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 12. CUSTOM FIELDS
-- -----------------------------------------------------------
CREATE TABLE custom_fields (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('company','contact','deal') NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  field_label_ar VARCHAR(200),
  field_type ENUM('text','number','date','dropdown','multi_select','url') NOT NULL DEFAULT 'text',
  field_options JSON,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT UNSIGNED DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_custom_field (entity_type, field_name)
) ENGINE=InnoDB;

CREATE TABLE custom_field_values (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  custom_field_id INT UNSIGNED NOT NULL,
  entity_type ENUM('company','contact','deal') NOT NULL,
  entity_id INT UNSIGNED NOT NULL,
  value TEXT,
  FOREIGN KEY (custom_field_id) REFERENCES custom_fields(id) ON DELETE CASCADE,
  UNIQUE KEY uq_cf_value (custom_field_id, entity_type, entity_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 13. AUDIT LOGS
-- -----------------------------------------------------------
CREATE TABLE audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT UNSIGNED,
  action ENUM('create','update','delete','login','logout','export','import','merge') NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 14. SUBSCRIPTIONS (SaaS billing)
-- -----------------------------------------------------------
CREATE TABLE subscriptions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  plan ENUM('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
  status ENUM('active','past_due','cancelled','trialing') NOT NULL DEFAULT 'trialing',
  user_count INT UNSIGNED NOT NULL DEFAULT 1,
  price_per_user DECIMAL(8,2) NOT NULL,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  trial_ends_at DATE,
  current_period_start DATE,
  current_period_end DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_subscriptions_stripe (stripe_customer_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 15. AI RECOMMENDATIONS (Next Best Actions)
-- -----------------------------------------------------------
CREATE TABLE ai_recommendations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deal_id INT UNSIGNED,
  contact_id INT UNSIGNED,
  recommendation_type ENUM('follow_up','draft_email','schedule_meeting','re_engage','upsell') NOT NULL,
  title VARCHAR(500),
  description TEXT,
  suggested_action TEXT,
  priority_score INT UNSIGNED DEFAULT 50,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX idx_ai_deal (deal_id),
  INDEX idx_ai_dismissed (is_dismissed)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- 16. OAUTH TOKENS (Email integrations)
-- -----------------------------------------------------------
CREATE TABLE oauth_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider ENUM('google','microsoft') NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at DATETIME,
  email_address VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_oauth_user_provider (user_id, provider)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- NOTIFICATIONS
-- -----------------------------------------------------------
CREATE TABLE notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('info','success','warning','error','deal','activity','ai') NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(255),
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user_read (user_id, is_read, created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- WHATSAPP LOGS
-- -----------------------------------------------------------
CREATE TABLE whatsapp_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  contact_id INT UNSIGNED,
  deal_id INT UNSIGNED,
  to_number VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  status ENUM('sent','delivered','read','failed','dev') NOT NULL DEFAULT 'sent',
  wa_message_id VARCHAR(128),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  INDEX idx_wa_log_contact (contact_id, created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------------
-- EMAIL LOGS (outbound email + open/click tracking)
-- -----------------------------------------------------------
CREATE TABLE email_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  contact_id INT UNSIGNED,
  deal_id INT UNSIGNED,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME,
  clicked_at DATETIME,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL,
  INDEX idx_email_log_user (user_id, sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- SEED DATA: Default Pipeline & Stages
-- -----------------------------------------------------------
INSERT INTO pipelines (name, name_ar, is_default)
VALUES ('Standard Sales Pipeline', 'خط أنابيب المبيعات القياسي', TRUE);

SET @pipeline_id = LAST_INSERT_ID();

INSERT INTO stages (pipeline_id, name, name_ar, probability_pct, sort_order, color_hex, is_won, is_lost) VALUES
(@pipeline_id, 'Prospect',       'عميل محتمل',              10, 1, '#93C5FD', FALSE, FALSE),
(@pipeline_id, 'Qualification',  'تأهيل',                    25, 2, '#FDE68A', FALSE, FALSE),
(@pipeline_id, 'Demo / Meeting', 'عرض توضيحي / اجتماع',      50, 3, '#FCA5A5', FALSE, FALSE),
(@pipeline_id, 'Negotiation',    'تفاوض',                    75, 4, '#C4B5FD', FALSE, FALSE),
(@pipeline_id, 'Won',            'تم الفوز',                100, 5, '#86EFAC', TRUE,  FALSE),
(@pipeline_id, 'Lost',           'خسارة',                     0, 6, '#FCA5A5', FALSE, TRUE);
