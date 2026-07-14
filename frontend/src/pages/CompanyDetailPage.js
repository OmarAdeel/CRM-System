import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { companiesAPI, contactsAPI, dealsAPI, aiAPI } from '../services/api';
import {
  ArrowLeftIcon, PencilIcon, SparklesIcon, BuildingOfficeIcon,
  PlusIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CompanyDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [companyRes, dealsRes] = await Promise.all([
        companiesAPI.getById(id),
        dealsAPI.getAll({ company_id: id, limit: 20 }),
      ]);
      setCompany(companyRes.data.data);
      setDeals(dealsRes.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
      navigate('/companies');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrich = async () => {
    try {
      toast.loading(t('app.processing'));
      const res = await companiesAPI.enrich(id);
      toast.dismiss();
      toast.success(t('common.saved'));
      loadData();
    } catch (err) {
      toast.dismiss();
      toast.error(t('common.error'));
    }
  };

  const handleUpdate = async (formData) => {
    try {
      await companiesAPI.update(id, formData);
      toast.success(t('common.saved'));
      setShowEdit(false);
      loadData();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleAddContact = async (formData) => {
    try {
      await contactsAPI.create({ ...formData, company_id: parseInt(id) });
      toast.success(t('common.saved'));
      setShowAddContact(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  };

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeftIcon className="w-4 h-4" />
          {t('app.back')}
        </button>
        <div className="flex gap-2">
          <button onClick={handleEnrich} className="btn-secondary btn-sm">
            <SparklesIcon className="w-4 h-4" />
            {t('contacts.enrichData')}
          </button>
          <button onClick={() => setShowAddContact(true)} className="btn-secondary btn-sm">
            <PlusIcon className="w-4 h-4" />
            {t('contacts.createContact')}
          </button>
          <button onClick={() => setShowEdit(true)} className="btn-primary btn-sm">
            <PencilIcon className="w-4 h-4" />
            {t('app.edit')}
          </button>
        </div>
      </div>

      {/* Company Header */}
      <div className="card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
            ) : (
              <BuildingOfficeIcon className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
            {company.name_ar && <p className="text-gray-500">{company.name_ar}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              {company.industry && <span className="badge badge-blue">{company.industry}</span>}
              {company.company_size && <span className="badge badge-gray">{company.company_size}</span>}
              {company.domain && <span className="badge badge-gray">{company.domain}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <InfoItem label={t('companies.revenue')} value={company.annual_revenue ? formatMoney(company.annual_revenue) : '—'} />
          <InfoItem label={t('companies.domain')} value={company.domain} />
          <InfoItem label={t('contacts.phone')} value={company.phone} />
          <InfoItem label="Website" value={company.website} link={company.website} />
          <InfoItem label="City" value={company.city} />
          <InfoItem label="Country" value={company.country} />
          <InfoItem label="LinkedIn" value={company.linkedin_url ? 'View Profile' : '—'} link={company.linkedin_url} />
          <InfoItem label={t('contacts.owner')} value={company.owner_name} />
        </div>

        {company.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Description</p>
            <p className="text-sm text-gray-700">{company.description}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('contacts.title')} ({company.contacts?.length || 0})
          </h2>
          {company.contacts && company.contacts.length > 0 ? (
            <div className="space-y-2">
              {company.contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/contacts/${c.id}`)}
                >
                  <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                    {c.first_name?.[0]}{c.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.job_title || c.email}</p>
                  </div>
                  {c.is_primary_contact && <span className="badge badge-blue text-xs">Primary</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">{t('contacts.noContacts')}</p>
          )}
        </div>

        {/* Deals */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('deals.title')} ({deals.length})
          </h2>
          {deals.length > 0 ? (
            <div className="space-y-2">
              {deals.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  onClick={() => navigate(`/deals/${d.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${d.status === 'won' ? 'badge-green' : d.status === 'lost' ? 'badge-red' : 'badge-yellow'} text-xs`}>{d.status}</span>
                      <span className="badge badge-gray text-xs">{d.stage_name}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-blue-700">{formatMoney(d.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">{t('deals.noDeals')}</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditCompanyModal company={company} onSave={handleUpdate} onClose={() => setShowEdit(false)} t={t} />
      )}

      {/* Add Contact Modal */}
      {showAddContact && (
        <AddContactModal onSave={handleAddContact} onClose={() => setShowAddContact(false)} t={t} />
      )}
    </div>
  );
};

const InfoItem = ({ label, value, link }) => (
  <div>
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    {value && link ? (
      <a href={link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{value}</a>
    ) : (
      <p className="text-sm text-gray-900">{value || '—'}</p>
    )}
  </div>
);

// ─── Edit Company Modal ────────────────────────────────
const EditCompanyModal = ({ company, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    name: company.name || '',
    name_ar: company.name_ar || '',
    domain: company.domain || '',
    industry: company.industry || '',
    company_size: company.company_size || '',
    annual_revenue: company.annual_revenue || '',
    website: company.website || '',
    phone: company.phone || '',
    address_line1: company.address_line1 || '',
    city: company.city || '',
    country: company.country || '',
    linkedin_url: company.linkedin_url || '',
    description: company.description || '',
  });

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <Modal onClose={onClose} title={t('app.edit')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('companies.name')}</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Arabic Name</label>
            <input className="form-input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('companies.domain')}</label>
            <input className="form-input" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('companies.industry')}</label>
            <input className="form-input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('companies.size')}</label>
            <select className="form-input" value={form.company_size} onChange={e => setForm({ ...form, company_size: e.target.value })}>
              <option value="">—</option>
              <option value="1-10">1-10</option>
              <option value="11-50">11-50</option>
              <option value="51-200">51-200</option>
              <option value="201-500">201-500</option>
              <option value="501-1000">501-1000</option>
              <option value="1000+">1000+</option>
            </select>
          </div>
          <div>
            <label className="form-label">{t('companies.revenue')}</label>
            <input type="number" step="0.01" className="form-input" value={form.annual_revenue} onChange={e => setForm({ ...form, annual_revenue: parseFloat(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Website</label>
            <input className="form-input" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('contacts.phone')}</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">City</label>
            <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Country</label>
            <input className="form-input" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="form-label">LinkedIn</label>
          <input className="form-input" value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
        </div>
        <div>
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
          <button type="submit" className="btn-primary">{t('app.save')}</button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Add Contact Modal ─────────────────────────────────
const AddContactModal = ({ onSave, onClose, t }) => {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    job_title: '', department: '', is_primary_contact: false,
  });

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <Modal onClose={onClose} title={t('contacts.createContact')}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('contacts.phone')}</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="form-label">{t('contacts.jobTitle')}</label>
            <input className="form-input" value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_primary_contact} onChange={e => setForm({ ...form, is_primary_contact: e.target.checked })} className="rounded" />
          Primary Contact
        </label>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
          <button type="submit" className="btn-primary">{t('app.save')}</button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Reusable Modal ────────────────────────────────────
const Modal = ({ children, onClose, title }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export default CompanyDetailPage;
