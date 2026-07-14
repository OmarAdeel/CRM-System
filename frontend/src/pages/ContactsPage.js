import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { contactsAPI, companiesAPI, aiAPI } from '../services/api';
import PlaceholderPage from '../components/common/PlaceholderPage';
import { PlusIcon, XMarkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ContactsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async (query = '') => {
    try {
      const res = await contactsAPI.getAll({ search: query, limit: 50 });
      setContacts(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    fetchContacts(e.target.value);
  };

  const handleCreate = async (formData) => {
    try {
      const res = await contactsAPI.create(formData);
      toast.success(t('common.saved'));
      setShowCreate(false);
      navigate(`/contacts/${res.data.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('contacts.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          {t('contacts.createContact')}
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={handleSearch}
        placeholder={t('app.search')}
        className="form-input max-w-sm"
      />

      {contacts.length > 0 ? (
        <div className="table-container">
          <table className="table-crm">
            <thead>
              <tr>
                <th>{t('contacts.firstName')} {t('contacts.lastName')}</th>
                <th>{t('contacts.email')}</th>
                <th>{t('contacts.phone')}</th>
                <th>{t('contacts.company')}</th>
                <th>{t('contacts.jobTitle')}</th>
                <th>{t('contacts.leadScore')}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                  <td className="font-medium text-gray-900">
                    {c.first_name} {c.last_name}
                    {c.first_name_ar && <span className="text-gray-400 text-xs ms-2" dir="rtl">{c.first_name_ar}</span>}
                  </td>
                  <td>{c.email || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.company_name || '—'}</td>
                  <td>{c.job_title || '—'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${c.lead_score >= 70 ? 'badge-green' : c.lead_score >= 40 ? 'badge-yellow' : 'badge-gray'}`}>
                        {c.lead_score || 0}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PlaceholderPage
          title={t('contacts.noContacts')}
          description="Start by adding your first contact or importing a CSV file."
        />
      )}

      {showCreate && <CreateContactModal onSave={handleCreate} onClose={() => setShowCreate(false)} t={t} />}
    </div>
  );
};

const CreateContactModal = ({ onSave, onClose, t }) => {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    job_title: '', company_id: '', language_preference: 'en',
  });
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    companiesAPI.getAll({ limit: 200 }).then(res => setCompanies(res.data.data || [])).catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.company_id) data.company_id = parseInt(data.company_id);
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('contacts.createContact')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('contacts.firstName')}</label>
              <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">{t('contacts.lastName')}</label>
              <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="form-label">{t('contacts.email')}</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('contacts.phone')}</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('contacts.jobTitle')}</label>
            <input className="form-input" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('contacts.company')}</label>
            <select className="form-input" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
              <option value="">— No company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Language Preference</label>
            <select className="form-input" value={form.language_preference} onChange={e => setForm({ ...form, language_preference: e.target.value })}>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
            <button type="submit" className="btn-primary">
              <PlusIcon className="w-4 h-4" />
              {t('app.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactsPage;