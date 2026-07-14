# CRM Bilingual B2B SaaS Platform

A full-stack **Bilingual (English/Arabic)** Customer Relationship Management platform built for **B2B sales teams**. Features AI-powered lead enrichment, omnichannel communication (email, WhatsApp), drag-and-drop pipeline management, real-time notifications, and Stripe subscription billing.

---

## 📐 Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| **Frontend**  | React 18, Tailwind CSS, React Router v6, i18next (LTR/RTL), Socket.io Client |
| **Backend**   | Node.js, Express.js, Socket.io, JWT Auth, REST APIs  |
| **Database**  | MySQL 8+ (utf8mb4/utf8mb4_unicode_ci for Arabic)     |
| **AI**        | OpenAI (GPT-4o-mini), heuristic fallback in dev       |
| **Email**     | Nodemailer (SMTP), Google Gmail OAuth, open/click tracking |
| **Messaging** | Meta WhatsApp Business Cloud API                      |
| **Billing**   | Stripe Checkout (subscriptions), dev-mode mock        |
| **Other**     | bcryptjs, morgan, csvtojson, json2csv, multer         |

---

## 🏗️ Project Structure

```
CRM/
├── backend/
│   ├── config/            # MySQL connection pool
│   ├── middleware/          # JWT auth middleware, audit logger
│   ├── routes/             # 18 Express route files
│   │   ├── auth.js         # Login/Register, Google OAuth, OAuth sync
│   │   ├── companies.js    # B2B account CRUD + AI enrichment
│   │   ├── contacts.js     # Contact CRUD, duplicate detection, enrichment
│   │   ├── deals.js        # Deals CRUD, stage movement
│   │   ├── pipelines.js    # Pipeline + stage management
│   │   ├── dashboard.js    # Stats, leaderboard, funnel, forecast
│   │   ├── activities.js   # Timeline/call-log CRUD
│   │   ├── email.js        # SMTP send, open/click tracking
│   │   ├── whatsapp.js     # WhatsApp send, webhook, history
│   │   ├── billing.js      # Stripe checkout, plans, invoices
│   │   ├── automations.js  # If/Then workflow builder
│   │   ├── ai.js           # AI draft, translate, score, enrich, summary
│   │   ├── notifications.js # Per-user notifications (bell)
│   │   ├── products.js     # Product catalog
│   │   ├── templates.js    # Email templates (bilingual)
│   │   ├── users.js        # User management (admin-only)
│   │   ├── importExport.js # CSV import/export
│   │   ├── customFields.js # Custom data fields per entity
│   │   └── audit.js        # Audit log viewer
│   ├── utils/
│   │   ├── openai.js        # OpenAI wrapper (draft, translate, score, etc.)
│   │   ├── emailService.js  # Nodemailer SMTP, tracking injection
│   │   ├── whatsappService.js # Meta WhatsApp Cloud API
│   │   ├── automationEngine.js # Cron/scheduler: run workflows + AI scans
│   │   ├── scheduler.js     # Stagnant deal scanner, lead scorer, Automations
│   │   └── seed.js          # Comprehensive dummy data seeder
│   ├── server.js            # Express entry point, route registration, Socket.io
│   ├── .env                 # Environment variables (keys, secrets, ports)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/          # Header (search, bell, user menu), Sidebar, MainLayout
│   │   ├── context/
│   │   │   └── AuthContext.js    # JWT auth provider, login/logout, socket connect
│   │   ├── i18n/
│   │   │   └── locales/{en,ar}/ # Full English/Arabic translation dictionaries
│   │   ├── pages/               # 19 page components
│   │   │   ├── LoginPage.js
│   │   │   ├── DashboardPage.js
│   │   │   ├── ContactsPage.js, ContactDetailPage.js (email/WhatsApp compose)
│   │   │   ├── CompaniesPage.js, CompanyDetailPage.js
│   │   │   ├── DealsPage.js, DealDetailPage.js
│   │   │   ├── PipelinePage.js   # Drag-and-drop Kanban board
│   │   │   ├── ActivitiesPage.js
│   │   │   ├── ReportsPage.js
│   │   │   ├── SettingsPage.js   # Profile, Security, Language, Integrations, Billing
│   │   │   ├── AutomationsPage.js
│   │   │   ├── TemplatesPage.js
│   │   │   ├── ImportExportPage.js
│   │   │   └── AdminPage.js
│   │   ├── services/
│   │   │   ├── api.js       # Axios instance + all API function exports
│   │   │   └── socket.js    # Socket.io client manager (connect, subscribe, emit)
│   │   ├── App.js
│   │   └── index.js
│   ├── tailwind.config.js
│   ├── .env                 # API/Socket URL config
│   └── package.json
└── database/
    └── schema.sql           # Full 20-table MySQL schema + default pipeline seed
```

---

## 🏢 Database Schema (20 Tables)

| # | Table | Purpose |
|---|-------|---------|
| 1 | `users` | Sales reps, managers, admins (role, language, territory) |
| 2 | `companies` | B2B accounts (name, industry, size, domain, logo) |
| 3 | `contacts` | People at those companies (email, phone, lead score) |
| 4 | `pipelines` | Sales processes ("New Sales", "Renewals") |
| 5 | `stages` | Pipeline steps (Prospect → Demo → Negotiation → Won/Lost) |
| 6 | `products` | Product catalog with pricing |
| 7 | `deals` | Deals with value, status, owner, expected close date |
| 8 | `deal_products` | Many-to-many: which products are on a deal |
| 9 | `activities` | Chronological feed (calls, emails, meetings, WhatsApp, notes) |
| 10 | `email_templates` | Bilingual email/snippet templates |
| 11 | `automations` | If/Then workflow rules |
| 12 | `custom_fields` | Admins can add custom fields per entity |
| 13 | `custom_field_values` | Values for those custom fields |
| 14 | `audit_logs` | Every data mutation (who, what, when, IP) |
| 15 | `subscriptions` | SaaS billing (plan, status, Stripe customer) |
| 16 | `ai_recommendations` | AI next-best-action suggestions |
| 17 | `oauth_tokens` | Gmail/Microsoft OAuth access tokens |
| 18 | `notifications` | Per-user in-app notifications |
| 19 | `whatsapp_logs` | WhatsApp message history |
| 20 | `email_logs` | Outbound email history + open/click tracking |

---

## ✨ Feature List

### Module 1: Contact & Account Management

- B2B hierarchy: **Contacts linked to Companies**
- AI enrichment from email domain (company size, industry, logo)
- Interaction timeline on every profile
- Custom fields per entity type (text, dropdown, date)
- Duplicate contact detection and merging
- CSV import/export onboarding

### Module 2: Pipeline & Deals

- Visual **drag-and-drop Kanban board** (Perspective → Demo → Negotiation → Won/Lost)
- Multiple pipelines ("New Sales", "Renewals")
- Deal rotting (visual red highlight for stagnant deals)
- Weighted revenue forecasting by stage probability
- Product catalog: attach products to auto-calculate deal value

### Module 3: Omnichannel Communication

- **Compose Email** with subject + HTML body (SMTP; `nodemailer`)
- **Email read receipts** + **click tracking** (tracking pixel + link wrapping)
- **WhatsApp Business** send via Meta Cloud API (with webhook for inbound)
- **Gmail OAuth sync** (`googleapis`): pull inbox, match senders to contacts, log as activities
- Pre-saved **bilingual email templates** (English/Arabic)

### Module 4: AI & Automation

- **OpenAI** wrapper (`utils/openai.js`): draft emails, translate EN↔AR, score leads (1–100), enrich contacts/companies, generate deal summaries, next-best-action
- Falls back to **heuristic logic** without an API key (dev-friendly)
- **Workflow automation builder**: "If deal stage = Won → log email + notify rep"
- **Automated scheduler**: scans stagnant deals daily, runs date-based triggers, scores new leads hourly

### Module 5: Reporting & Dashboards

- **Dashboard stats**: total revenue, MRR, deals won, active pipeline, conversion rate, new deals this month, stagnant count
- **Weighted forecast** by stage (deal value × probability %)
- **Leaderboard**: calls, emails, meetings, WhatsApp per rep (weekly)
- **Funnel visualization**: drop-off rate between stages
- **Lost deal analysis**: loss reasons from rep feedback

### Module 6: System & Admin

- **Bilingual toggle**: one-click switch English (LTR) ↔ Arabic (RTL)
- **Role-based access** (admin, manager, rep)
- **Audit logs**: who deleted/changed what, with IP
- **Stripe billing**: subscription plans (Starter $25 / Pro $50 / Enterprise custom)
- **Live Socket.io notifications** (deal updates, new tasks, AI alerts)
- **In-app notification bell** with read/unread state per user

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- **Node.js** ≥ 18
- **MySQL** ≥ 8.0 (Homebrew: `brew install mysql`)
- **npm** ≥ 9

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd CRM

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Create the database

```bash
mysql -u root -p < database/schema.sql
```

> The schema uses `utf8mb4` charset and `utf8mb4_unicode_ci` collation for Arabic support. It also inserts a default pipeline with 6 stages.

### 3. Configure environment

Edit `backend/.env`:

```env
PORT=5001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=crm_db
JWT_SECRET=your_secret_key_change_me
FRONTEND_URL=http://localhost:3000
```

Frontend `frontend/.env` (already set):

```env
REACT_APP_API_URL=http://localhost:5001/api
REACT_APP_SOCKET_URL=http://localhost:5001
```

> Optionally set `OPENAI_API_KEY`, SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`), WhatsApp keys (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`), Google OAuth credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), and `STRIPE_SECRET_KEY`. The CRM works without them — integrations gracefully fall back to a **dev mode** that logs to console and returns mock responses.

### 4. Seed dummy data

```bash
cd backend && npm run seed
```

Populates all 20 tables with realistic bilingual data:

- 8 users (admin, managers, reps)
- 10 companies + 18 contacts
- 21 deals across 2 pipelines
- 25 activities, 5 email templates, 5 automations
- 5 AI recommendations, 12 audit logs, 7 products
- 9 notifications, 1 subscription

**Login credentials** (all share password `password123`):

| Role    | Email              | Language |
| ------- | ------------------ | -------- |
| Admin   | admin@crm.com      | EN       |
| Manager | sara@crm.com       | AR       |
| Manager | fatima@crm.com     | AR       |
| Rep     | john@crm.com       | EN       |
| Rep     | ahmed@crm.com      | AR       |
| Rep     | maria@crm.com      | EN       |
| Rep     | david@crm.com      | EN       |
| Rep     | layla@crm.com      | AR       |

### 5. Start the servers

```bash
# Terminal 1 — Backend
cd backend && npm start
# → CRM API running on http://localhost:5001

# Terminal 2 — Frontend
cd frontend && npm start
# → React dev server on http://localhost:3000
```

Open **http://localhost:3000** and log in as `admin@crm.com` / `password123`.

---

## 🔌 Integration Status

| Integration     | Dev Mode (no keys)                                    | Production (with keys)                  |
| --------------- | ----------------------------------------------------- | --------------------------------------- |
| **OpenAI**        | ✅ Heuristic scoring, mock emails                     | ✅ GPT-4o-mini draft, translate, score  |
| **SMTP Email**    | ✅ Logged to console + DB, tracking still works        | ✅ Real delivery via any SMTP provider  |
| **WhatsApp**      | ✅ Logged in `whatsapp_logs` as dev                   | ✅ Meta Cloud API send/receive/webhook  |
| **Gmail OAuth**   | ❌ Returns 503 with setup instructions                | ✅ OAuth2 flow, inbox sync              |
| **Stripe Billing** | ✅ Mock checkout, auto-activates plan                 | ✅ Live Checkout subscriptions          |
| **Email Tracking** | ✅ Open/click endpoints return pixel + redirect       | ✅ Fully tracked in production          |

---

## 🔐 Security

- **JWT authentication** with `bcryptjs` (cost 12) password hashing
- **Role-based access control** (rep/manager/admin) enforced in middleware
- **Rate limiting** on auth endpoints (Express Rate Limit)
- **Helmet** security headers
- **CORS** configured with an allowlist of known origins
- **SQL injection** prevented via parameterized queries (MySQL2)
- **Audit logs** track every mutation (user ID, entity, action, IP, timestamp)
- `.env` files excluded from version control (add to `.gitignore`)

---

## 🌍 Bilingual Support (RTL / LTR)

The entire UI supports instant language switching between **English** (`en`) and **Arabic** (`ar`):

- **Toggler** in the top navigation bar (language icon)
- All labels, placeholders, and messages are stored in `frontend/src/i18n/locales/{en,ar}/translation.json`
- **Tailwind RTL**: CSS direction flips automatically (`dir=ltr` ↔ `dir=rtl`)
- **Database**: All stage names, pipeline names, and templates stored with `_ar` suffix columns
- **OpenAI**: Email drafting and translation work in both directions (EN→AR, AR→EN)

---

## 📡 Real-time Features (Socket.io)

The backend emits the following events:

| Event             | Payload              | Why                                |
| ----------------- | -------------------- | ---------------------------------- |
| `notification`      | `{ title, message, type }` | Automation triggers, AI actions |
| `deal:created`      | `{ id, title }`       | New deal in Kanban                 |
| `deal:updated`      | `{ id }`              | Any deal field changed             |
| `deal:moved`        | `{ id, stage_id }`    | Drag-and-drop stage change         |
| `activity:created`  | `{ id, type, contact_id }` | New call/email/meeting logged |
| `whatsapp:received` | `{ from, body, contactId }` | Inbound WhatsApp message   |

The frontend `socket.js` service automatically reconnects on login, subscribes to all known events, and shows `react-hot-toast` notifications in real time.

---

## 📦 API Reference (Selected Endpoints)

| Method   | Route                                 | Auth? | Description                       |
| -------- | ------------------------------------- | ----- | --------------------------------- |
| `POST`     | `/api/auth/login`                       | No    | Authenticate, returns JWT         |
| `GET`      | `/api/dashboard/stats`                  | Yes   | MRR, revenue, pipeline, forecast  |
| `GET`      | `/api/dashboard/leaderboard`            | Yes   | Weekly rep activity counts        |
| `GET`      | `/api/dashboard/funnel/:pipelineId`     | Yes   | Funnel drop-off by stage          |
| `GET`      | `/api/contacts`                         | Yes   | List contacts (paginated, search) |
| `POST`     | `/api/contacts/:id/enrich`              | Yes   | AI enrich contact                 |
| `GET`      | `/api/deals`                            | Yes   | List deals (paginated, filters)   |
| `PATCH`    | `/api/deals/:id/move`                   | Yes   | Move deal to a different stage    |
| `POST`     | `/api/email/send`                       | Yes   | Send email (SMTP/dev)             |
| `GET`      | `/api/email/track/open/:id`             | No    | Tracking pixel (public)           |
| `GET`      | `/api/email/track/click/:id?u=<url>`   | No    | Link click tracker + redirect     |
| `POST`     | `/api/whatsapp/send`                    | Yes   | Send WhatsApp message             |
| `POST`     | `/api/whatsapp/webhook`                 | No    | Meta inbound webhook              |
| `POST`     | `/api/ai/draft-email`                   | Yes   | OpenAI email draft                |
| `POST`     | `/api/ai/score-lead/:contactId`         | Yes   | AI lead scoring                   |
| `POST`     | `/api/automations`                      | Yes   | Create If/Then workflow           |
| `GET`      | `/api/notifications`                    | Yes   | User's notification feed          |
| `GET`      | `/api/billing/plans`                    | Yes   | Plan catalog                      |
| `POST`     | `/api/billing/create-checkout`          | Yes   | Stripe checkout session           |
| `GET`      | `/api/auth/oauth/sync-emails`           | Yes   | Pull + log Gmail messages         |

For a complete list, browse `backend/routes/*.js`. Every route (except login/register/webhooks) requires a valid JWT in the `Authorization: Bearer <token>` header.

---

## 🛠️ Custom Ports

The default ports can be changed via environment variables:

- **Backend:** Set `PORT` in `backend/.env` (default: 5000)
- **Frontend:** Set `PORT` in `frontend/.env` (default: 3000)
- Update `FRONTEND_URL` in `backend/.env` to match the new frontend port (for CORS)
- Update `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` in `frontend/.env` to match the new backend port

---

## 📊 Build for Production

```bash
# Frontend
cd frontend && npm run build
# → static files in frontend/build/ — serve with Nginx, Vercel, or Express static

# Backend
cd backend
# Set NODE_ENV=production in .env, then:
npm start
```

In production, you must also set the `JWT_SECRET` to a strong random string and configure your integration keys.

---

## 📄 License

MIT
