import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { authAPI, aiAPI, billingAPI, oauthAPI, whatsappAPI, emailAPI } from '../services/api';
import {
  UserIcon, LockClosedIcon, LanguageIcon, CpuChipIcon,
  CreditCardIcon, CheckCircleIcon, XMarkIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const SettingsPage = () => {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: UserIcon },
    { id: 'security', label: 'Security', icon: LockClosedIcon },
    { id: 'language', label: t('settings.language'), icon: LanguageIcon },
    { id: 'integrations', label: t('settings.integrations'), icon: CpuChipIcon },
    { id: 'billing', label: t('navigation.billing'), icon: CreditCardIcon },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5 flex-shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 max-w-2xl">
          {activeTab === 'profile' && <ProfileTab user={user} updateUser={updateUser} t={t} />}
          {activeTab === 'security' && <SecurityTab t={t} />}
          {activeTab === 'language' && <LanguageTab i18n={i18n} user={user} updateUser={updateUser} t={t} />}
          {activeTab === 'integrations' && <IntegrationsTab t={t} />}
          {activeTab === 'billing' && <BillingTab t={t} />}
        </div>
      </div>
    </div>
  );
};

// ─── Profile Tab ───────────────────────────────────────
const ProfileTab = ({ user, updateUser, t }) => {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    territory: user?.territory || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await authAPI.updateProfile(form);
      updateUser(form);
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.profile')}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className="badge badge-blue mt-1">{user?.role}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">First Name</label>
            <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Last Name</label>
            <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="form-label">{t('contacts.phone')}</label>
          <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="form-label">Territory</label>
          <input className="form-input" value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} />
        </div>
        <div>
          <label className="form-label">{t('auth.email')}</label>
          <input className="form-input bg-gray-50" value={user?.email} disabled />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? t('common.processing') : t('app.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Security Tab ──────────────────────────────────────
const SecurityTab = ({ t }) => {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match.');
      return;
    }
    if (form.new_password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      toast.success(t('common.saved'));
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Current Password</label>
          <input type="password" className="form-input" value={form.current_password}
            onChange={e => setForm({ ...form, current_password: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">New Password</label>
          <input type="password" className="form-input" value={form.new_password}
            onChange={e => setForm({ ...form, new_password: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Confirm New Password</label>
          <input type="password" className="form-input" value={form.confirm_password}
            onChange={e => setForm({ ...form, confirm_password: e.target.value })} required />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.processing') : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

// ─── Language Tab ──────────────────────────────────────
const LanguageTab = ({ i18n, user, updateUser, t }) => {
  const handleLanguageChange = async (lang) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    try {
      await authAPI.updateProfile({ language: lang });
      updateUser({ language: lang });
      toast.success(t('common.saved'));
    } catch (err) {
      // Non-critical if save fails
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('settings.language')}</h2>
      <div className="space-y-3">
        <button
          onClick={() => handleLanguageChange('en')}
          className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
            i18n.language === 'en' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇬🇧</span>
            <div className="text-start">
              <p className="font-medium text-gray-900">English</p>
              <p className="text-xs text-gray-500">Left-to-Right (LTR)</p>
            </div>
          </div>
          {i18n.language === 'en' && <CheckCircleIcon className="w-5 h-5 text-blue-600" />}
        </button>

        <button
          onClick={() => handleLanguageChange('ar')}
          className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
            i18n.language === 'ar' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🇸🇦</span>
            <div className="text-start">
              <p className="font-medium text-gray-900">العربية</p>
              <p className="text-xs text-gray-500">Right-to-Left (RTL)</p>
            </div>
          </div>
          {i18n.language === 'ar' && <CheckCircleIcon className="w-5 h-5 text-blue-600" />}
        </button>
      </div>
    </div>
  );
};

// ─── Integrations Tab ──────────────────────────────────
const IntegrationsTab = ({ t }) => {
  const [aiStatus, setAiStatus] = useState(null);
  const [oauth, setOauth] = useState(null);
  const [wa, setWa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);

  useEffect(() => {
    Promise.all([
      aiAPI.getStatus().then(r => r.data.data).catch(() => null),
      oauthAPI.getStatus().then(r => r.data.data).catch(() => null),
      whatsappAPI.getStatus().then(r => r.data.data).catch(() => null),
    ]).then(([ai, o, w]) => {
      setAiStatus(ai);
      setOauth(o);
      setWa(w);
      setLoading(false);
    });
  }, []);

  const handleConnectGoogle = () => {
    const token = localStorage.getItem('crm_token');
    if (!token) return toast.error('Not logged in');
    // The backend route is GET /api/auth/google?token=<JWT> (no Authorization
    // header because the browser navigates to it). The backend decodes the JWT,
    // stores userId in Google's `state` param, and redirects to Google consent.
    window.open(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/auth/google?token=${encodeURIComponent(token)}`, '_blank');
  };

  const handleSyncGmail = async () => {
    setSyncing(true);
    try {
      const res = await oauthAPI.syncEmails();
      toast.success(`Synced ${res.data.data.syncedCount} email(s) to contacts`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Sync failed';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendTestEmail = async () => {
    setEmailTesting(true);
    try {
      const me = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const res = await emailAPI.send({
        to: 'test@example.com',
        subject: 'CRM Test Email',
        body: '<p>This is a test email from your CRM. Tracking is enabled.</p><p><a href="https://example.com">A tracked link</a></p>',
      });
      toast.success(res.data.data.devMode ? 'Test email logged in dev mode (SMTP not configured)' : 'Test email sent');
    } catch (err) {
      toast.error('Email send failed');
    } finally {
      setEmailTesting(false);
    }
  };

  const integrations = [
    {
      name: 'OpenAI',
      description: 'AI email drafting, lead scoring, translations, and deal summaries.',
      icon: '🤖',
      connected: aiStatus?.openai_enabled,
      badge: aiStatus?.openai_enabled ? `gpt-${aiStatus?.model || '4o-mini'}` : 'Heuristic mode (no key)',
      actionLabel: aiStatus?.openai_enabled ? 'Connected' : 'Add OPENAI_API_KEY',
      actionDisabled: true,
    },
    {
      name: 'Gmail',
      description: 'Sync emails automatically and log them to CRM contacts.',
      icon: '📧',
      connected: oauth?.google,
      badge: oauth?.gmail_email || (oauth?.google_available ? 'Ready' : 'Not configured'),
      actionLabel: oauth?.google ? 'Sync now' : 'Connect with Google',
      actionDisabled: false,
      onClick: oauth?.google ? handleSyncGmail : handleConnectGoogle,
      isSyncing: oauth?.google && syncing,
    },
    {
      name: 'Outlook',
      description: 'Sync emails from Microsoft Outlook to the CRM.',
      icon: '📬',
      connected: oauth?.microsoft,
      badge: oauth?.outlook_email || 'Coming soon',
      actionLabel: 'Connect with Microsoft',
      actionDisabled: true,
    },
    {
      name: 'WhatsApp Business',
      description: 'Send, receive, and log WhatsApp messages inside the CRM.',
      icon: '💬',
      connected: wa?.configured,
      badge: wa?.configured ? 'Live' : 'Dev mode',
      actionLabel: wa?.configured ? 'Connected' : 'Add WHATSAPP_* keys',
      actionDisabled: true,
    },
    {
      name: 'SMTP Email',
      description: 'Send outbound sales emails and track opens/clicks via SMTP.',
      icon: '✉️',
      connected: false,
      badge: 'Test send available',
      actionLabel: 'Send test email',
      actionDisabled: false,
      onClick: handleSendTestEmail,
      isTesting: emailTesting,
    },
    {
      name: 'Stripe',
      description: 'SaaS subscription billing, checkout, and invoices.',
      icon: '💳',
      connected: false,
      badge: 'Dev mode',
      actionLabel: 'Add STRIPE_SECRET_KEY',
      actionDisabled: true,
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{t('settings.integrations')}</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        integrations.map((int) => (
          <div key={int.name} className="card flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-3xl">{int.icon}</div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{int.name}</p>
                  {int.connected ? (
                    <span className="badge badge-green">Connected</span>
                  ) : (
                    <span className="badge badge-gray">Not Connected</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{int.description}</p>
                <p className="text-xs text-gray-400 mt-1">{int.badge}</p>
              </div>
            </div>
            <button
              className={`btn-sm ${int.connected ? 'btn-secondary' : 'btn-primary'} flex items-center gap-2`}
              disabled={int.actionDisabled || (int.isSyncing || int.isTesting)}
              onClick={int.onClick}
            >
              {(int.isSyncing || int.isTesting) && (
                <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
              )}
              {int.actionLabel}
            </button>
          </div>
        ))
      )}
    </div>
  );
};

// ─── Billing Tab ───────────────────────────────────────
const BillingTab = ({ t }) => {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // plan id

  useEffect(() => {
    Promise.all([
      billingAPI.getSubscription().then(r => r.data.data).catch(() => null),
      billingAPI.getPlans ? billingAPI.getPlans().then(r => r.data.data).catch(() => []) : Promise.resolve([]),
    ]).then(([sub, p]) => {
      setSubscription(sub);
      setPlans(p && p.length ? p : [
        { id: 'starter', name: 'Starter', price: 25, features: ['Basic CRM', 'Pipeline management', 'Email sync', '2 users included'] },
        { id: 'pro', name: 'Pro', price: 50, features: ['Everything in Starter', 'WhatsApp integration', 'AI enrichments', 'Advanced reporting', 'Unlimited users'] },
        { id: 'enterprise', name: 'Enterprise', price: null, features: ['Custom integrations', 'Dedicated account manager', 'Self-hosting options'] },
      ]);
      setLoading(false);
    });
  }, []);

  const handleSubscribe = async (planId) => {
    setCheckoutLoading(planId);
    try {
      const res = await billingAPI.createCheckoutSession(planId);
      const data = res.data.data;
      if (data.devMode) {
        toast.success('Dev mode: subscription activated. Add STRIPE_SECRET_KEY to enable live checkout.');
        const ref = await billingAPI.getSubscription();
        setSubscription(ref.data.data);
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error('Unexpected checkout response');
      }
    } catch (err) {
      toast.error('Checkout failed');
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">{t('navigation.billing')}</h2>

      {/* Current Plan */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="text-xl font-bold text-gray-900 capitalize">{subscription?.plan || 'Not subscribed'}</p>
            <p className="text-sm text-gray-500 mt-1">
              Status: <span className="badge badge-green">{subscription?.status || 'Trialing'}</span>
            </p>
          </div>
          <div className="text-end">
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-xl font-bold text-gray-900">
              ${subscription?.price_per_user || 25}<span className="text-sm font-normal text-gray-500">/user/mo</span>
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const pid = plan.id || plan.name.toLowerCase();
          const isCurrent = subscription?.plan === pid;
          return (
            <div key={pid} className={`card relative ${plan.popular || pid === 'pro' ? 'border-blue-500 border-2' : ''}`}>
              {(plan.popular || pid === 'pro') && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="font-semibold text-gray-900">{plan.name}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {plan.price ? `$${plan.price}` : 'Custom'}
                {plan.price && <span className="text-sm font-normal text-gray-500">/user/mo</span>}
              </p>
              <ul className="mt-4 space-y-2">
                {(plan.features || []).map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full mt-4 ${isCurrent ? 'btn-secondary' : 'btn-primary'} flex items-center justify-center gap-2`}
                disabled={isCurrent || checkoutLoading === pid}
                onClick={() => handleSubscribe(pid)}
              >
                {checkoutLoading === pid && <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />}
                {isCurrent ? 'Current Plan' : checkoutLoading === pid ? 'Processing…' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SettingsPage;
