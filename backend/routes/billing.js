const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

// Initialize Stripe client only when a secret key is configured.
// In dev (no key), `stripe` is null and endpoints fall back to mocked responses.
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ─── Static plan catalog ──────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 25,
    currency: 'usd',
    interval: 'month',
    features: [
      'Basic CRM',
      'Pipeline management',
      'Email sync',
      '2 users included',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 50,
    currency: 'usd',
    interval: 'month',
    features: [
      'Everything in Starter',
      'WhatsApp integration',
      'AI enrichments',
      'Advanced reporting',
      'Unlimited users',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    features: [
      'Custom integrations',
      'Dedicated account management',
      'Self-hosting options',
    ],
  },
];

const getPlan = (id) => PLANS.find((p) => p.id === id);

// ─── GET /api/billing/plans ────────────────────────────
router.get('/plans', auth, (req, res) => {
  res.json({ success: true, data: PLANS });
});

// ─── GET /api/billing/subscription ─────────────────────
// Reads the current user's subscription row. The existing schema does not
// filter by user_id (the previous implementation read the most recent row),
// so we keep that behavior to stay consistent with the installed schema.
router.get('/subscription', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/billing/create-checkout ─────────────────
router.post('/create-checkout', auth, async (req, res) => {
  try {
    const { plan: planId } = req.body;
    const plan = getPlan(planId);

    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid plan.' });
    }

    // Dev fallback: no Stripe key configured — simulate a checkout.
    if (!stripe) {
      return res.json({
        success: true,
        data: {
          devMode: true,
          message:
            'Stripe not configured — simulating checkout. Add STRIPE_SECRET_KEY to enable.',
          plan: planId,
          mockUrl: '#dev-mode',
        },
      });
    }

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    const successUrl =
      process.env.STRIPE_SUCCESS_URL ||
      `${backendUrl}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL || `${backendUrl}/api/billing/cancel`;

    const isEnterprise = plan.price === null;
    const mode = isEnterprise ? 'payment' : 'subscription';

    const lineItems = isEnterprise
      ? [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: 50000, // $500.00 custom enterprise starter invoice
              product_data: {
                name: 'Enterprise — Custom Plan',
                description:
                  'Custom integrations, dedicated account management, and self-hosting options.',
              },
            },
          },
        ]
      : [
          {
            quantity: 1,
            price_data: {
              currency: plan.currency,
              unit_amount: plan.price * 100, // Stripe expects cents
              recurring: { interval: plan.interval },
              product_data: {
                name: `${plan.name} plan`,
                description: plan.features.join(' • '),
              },
            },
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        plan: planId,
        user_id: String(req.user.id),
      },
    });

    res.json({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── POST /api/billing/cancel ──────────────────────────
router.post('/cancel', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE subscriptions SET status = ? ORDER BY created_at DESC LIMIT 1',
      ['cancelled']
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/billing/invoices ─────────────────────────
router.get('/invoices', auth, async (req, res) => {
  try {
    if (!stripe) {
      // Dev fallback: return a single sample invoice.
      return res.json({
        success: true,
        data: [
          {
            id: 'dev-invoice-0001',
            number: 'DEV-0001',
            created: new Date().toISOString(),
            total: 2500,
            currency: 'usd',
            paid: true,
            invoice_pdf: null,
            mock: true,
          },
        ],
      });
    }

    // Look up the Stripe customer id from the saved subscription row.
    const [rows] = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions ORDER BY created_at DESC LIMIT 1'
    );

    const customerId = rows[0] && rows[0].stripe_customer_id;
    if (!customerId) {
      return res.json({ success: true, data: [] });
    }

    const invoices = await stripe.invoices.list({ customer: customerId });

    res.json({ success: true, data: invoices.data });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── GET /api/billing/success ──────────────────────────
// Stripe success redirect. In real flow, retrieve the session, then upsert the
// subscriptions row. In dev mode (no Stripe), activate the subscription using
// the `plan` query param.
router.get('/success', async (req, res) => {
  try {
    const { session_id, plan: queryPlan } = req.query;

    // Dev mode: simulate a successful checkout.
    if (!stripe) {
      const plan = queryPlan || 'starter';
      await upsertSubscription({
        plan,
        status: 'active',
        customerId: null,
      });

      return res.send(
        successPage('Payment successful! You can close this tab.')
      );
    }

    // Real Stripe flow: retrieve the session to recover customer + plan.
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const plan = session.metadata && session.metadata.plan
      ? session.metadata.plan
      : queryPlan || 'starter';

    await upsertSubscription({
      plan,
      status: 'active',
      customerId: session.customer || null,
    });

    res.send(successPage('Payment successful! You can close this tab.'));
  } catch (err) {
    console.error('Stripe success callback error:', err);
    res.status(500).send(successPage('Something went wrong confirming your payment.'));
  }
});

// ─── GET /api/billing/cancel ────────────────────────────
// Stripe cancel redirect — also used as the cancel_url target.
router.get('/cancel', (req, res) => {
  res.send(cancelPage());
});

// ─── Helpers ───────────────────────────────────────────

/**
 * Upserts the most recent subscription row. Tries an UPDATE on the latest row,
 * and if no row exists yet, INSERTs one. Keeps the schema-agnostic pattern from
 * the original billing.js (no per-user unique constraint assumed).
 */
async function upsertSubscription({ plan, status, customerId }) {
  const [existing] = await pool.query(
    'SELECT id FROM subscriptions ORDER BY created_at DESC LIMIT 1'
  );

  if (existing.length > 0) {
    await pool.query(
      'UPDATE subscriptions SET plan = ?, status = ?, stripe_customer_id = ? WHERE id = ?',
      [plan, status, customerId, existing[0].id]
    );
  } else {
    // The schema requires company_name, user_count, price_per_user to be non-null.
    const price = plan === 'pro' ? 50 : plan === 'enterprise' ? 0 : 25;
    await pool.query(
      `INSERT INTO subscriptions
        (company_name, plan, status, user_count, price_per_user, stripe_customer_id,
         current_period_start, current_period_end)
       VALUES ('CRM Tenant', ?, ?, 1, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH))`,
      [plan, status, price, customerId]
    );
  }
}

function successPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { text-align: center; padding: 2.5rem 2rem; background: #fff;
            border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.08); max-width: 420px; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #475569; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅ ${message}</h1>
    <p>You can return to the CRM.</p>
  </div>
</body>
</html>`;
}

function cancelPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Checkout Cancelled</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { text-align: center; padding: 2.5rem 2rem; background: #fff;
            border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,.08); max-width: 420px; }
    h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
    p { color: #475569; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Checkout cancelled.</h1>
    <p>You can close this tab.</p>
  </div>
</body>
</html>`;
}

module.exports = router;