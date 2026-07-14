import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { contactsAPI, activitiesAPI, aiAPI, emailAPI, whatsappAPI } from '../services/api';
import { ArrowLeftIcon, PencilIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ContactDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailModal, setEmailModal] = useState(false);
  const [waModal, setWaModal] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [waSending, setWaSending] = useState(false);

  useEffect(() => {
    loadContact();
  }, [id]);

  const loadContact = async () => {
    try {
      const [contactRes, activityRes] = await Promise.all([
        contactsAPI.getById(id),
        activitiesAPI.getByContact(id, { limit: 20 }),
      ]);
      setContact(contactRes.data.data);
      setActivities(activityRes.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async () => {
    try {
      toast.loading(t('app.processing'));
      const res = await contactsAPI.enrich(id);
      setContact(prev => ({ ...prev, ...res.data.data }));
      toast.dismiss();
      toast.success(t('common.success'));
    } catch (err) {
      toast.dismiss();
      toast.error(t('common.error'));
    }
  };

  const handleSendEmail = async ({ to, subject, body }) => {
    setEmailSending(true);
    try {
      const res = await emailAPI.send({ to, subject, body, contact_id: parseInt(id, 10), track: true });
      const dev = res.data.data.devMode;
      toast.success(dev ? 'Email logged in dev mode (SMTP not configured)' : 'Email sent');
      setEmailModal(false);
      loadContact(); // refresh timeline to include the new activity
    } catch (err) {
      toast.error('Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendWhatsApp = async ({ to, message }) => {
    setWaSending(true);
    try {
      const res = await whatsappAPI.send({ to, message, contact_id: parseInt(id, 10) });
      const dev = res.data.data.devMode;
      toast.success(dev ? 'WhatsApp logged in dev mode (api not configured)' : 'WhatsApp message sent');
      setWaModal(false);
      loadContact();
    } catch (err) {
      toast.error('Failed to send WhatsApp message');
    } finally {
      setWaSending(false);
    }
  };

  const activityIcons = {
    call: '📞',
    email: '✉️',
    meeting: '🤝',
    note: '📝',
    whatsapp: '💬',
    task: '✅',
    sms: '📱',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="space-y-6">
      {/* Back & Actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeftIcon className="w-4 h-4" />
          {t('app.back')}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setEmailModal(true)}
            disabled={!contact.email}
            className="btn-secondary btn-sm"
            title={contact.email ? '' : 'No email on contact'}
          >
            ✉️ Email
          </button>
          <button
            onClick={() => setWaModal(true)}
            disabled={!contact.phone}
            className="btn-secondary btn-sm"
            title={contact.phone ? '' : 'No phone on contact'}
          >
            💬 WhatsApp
          </button>
          <button onClick={handleEnrich} className="btn-secondary btn-sm">
            <SparklesIcon className="w-4 h-4" />
            {t('contacts.enrichData')}
          </button>
          <button className="btn-primary btn-sm">
            <PencilIcon className="w-4 h-4" />
            {t('app.edit')}
          </button>
        </div>
      </div>

      {/* Contact Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0">
            {contact.first_name?.[0]}{contact.last_name?.[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h1>
            {contact.first_name_ar && (
              <p className="text-gray-500">{contact.first_name_ar} {contact.last_name_ar}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {contact.job_title && <span className="badge badge-blue">{contact.job_title}</span>}
              {contact.lead_score > 0 && (
                <span className={`badge ${contact.lead_score >= 70 ? 'badge-green' : contact.lead_score >= 40 ? 'badge-yellow' : 'badge-gray'}`}>
                  Score: {contact.lead_score}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <InfoItem label={t('contacts.email')} value={contact.email} />
          <InfoItem label={t('contacts.phone')} value={contact.phone} />
          <InfoItem label={t('contacts.company')} value={contact.company_name} link={`/companies/${contact.company_id}`} />
          <InfoItem label={t('common.status')} value={contact.is_active ? t('common.active') : t('common.inactive')} />
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('contacts.timeline')}</h2>
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                <div className="text-xl flex-shrink-0 mt-0.5">
                  {activityIcons[activity.activity_type] || '📌'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.subject || activity.activity_type}</p>
                  {activity.content && (
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{activity.content}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(activity.created_at).toLocaleDateString()} — {activity.user_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('activities.noActivities')}</p>
        )}
      </div>

      {/* Compose Email Modal */}
      {emailModal && (
        <ComposeEmailModal
          to={contact.email || ''}
          onClose={() => setEmailModal(false)}
          onSend={handleSendEmail}
          sending={emailSending}
          t={t}
        />
      )}

      {/* Compose WhatsApp Modal */}
      {waModal && (
        <ComposeWhatsAppModal
          to={contact.phone || ''}
          onClose={() => setWaModal(false)}
          onSend={handleSendWhatsApp}
          sending={waSending}
          t={t}
        />
      )}
    </div>
  );
};

// ─── Compose Email Modal ───────────────────────────────
const ComposeEmailModal = ({ to, onClose, onSend, sending, t }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Compose Email</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="email"
              value={to}
              readOnly
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Body (HTML supported)</label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="<p>Hello,</p><p>Following up on our last conversation…</p>"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-400">Tracking pixel and link wrapper are auto-injected; opens and clicks are recorded.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button
            onClick={() => onSend({ to, subject, body })}
            disabled={!subject.trim() || !body.trim() || sending}
            className="btn-primary btn-sm"
          >
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Compose WhatsApp Modal ─────────────────────────────
const ComposeWhatsAppModal = ({ to, onClose, onSend, sending, t }) => {
  const [message, setMessage] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Send WhatsApp Message</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500">To</label>
            <input
              type="text"
              value={to}
              readOnly
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Message</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hello, this is a WhatsApp message from your CRM…"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-400">WhatsApp Business API integration required for actual delivery. Without it, the message is logged to the timeline in dev mode.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button
            onClick={() => onSend({ to, message })}
            disabled={!message.trim() || sending}
            className="btn-primary btn-sm"
          >
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, link }) => (
  <div>
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    {value ? (
      link ? (
        <a href={link} className="text-sm text-blue-600 hover:underline">{value}</a>
      ) : (
        <p className="text-sm text-gray-900">{value}</p>
      )
    ) : (
      <p className="text-sm text-gray-400">—</p>
    )}
  </div>
);

export default ContactDetailPage;
