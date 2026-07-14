import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { companiesAPI } from '../services/api';
import PlaceholderPage from '../components/common/PlaceholderPage';
import { PlusIcon, BuildingOfficeIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const CompaniesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    try {
      const res = await companiesAPI.getAll({ limit: 50 });
      setCompanies(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (formData) => {
    try {
      const res = await companiesAPI.create(formData);
      toast.success(t('common.saved'));
      setShowCreate(false);
      navigate(`/companies/${res.data.data.id}`);
    } catch (err) {
      toast.error(t('common.error'));
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
        <h1 className="text-2xl font-bold text-gray-900">{t('companies.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          {t('companies.createCompany')}
        </button>
      </div>

      {companies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/companies/${c.id}`)}
              className="card hover:shadow-md transition-shadow text-start"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                  ) : (
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                  {c.name_ar && <p className="text-sm text-gray-500" dir="rtl">{c.name_ar}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.industry && <span className="badge badge-blue text-xs">{c.industry}</span>}
                    {c.company_size && <span className="badge badge-gray text-xs">{c.company_size}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <PlaceholderPage
          title={t('companies.noCompanies')}
          description="Add companies to organize your contacts and deals."
        />
      )}

      {showCreate && <CreateCompanyModal onSave={handleCreate} onClose={() => setShowCreate(false)} t={t} />}
    </div>
  );
};

const CreateCompanyModal = ({ onSave, onClose, t }) => {
  const [form, setForm] = useState({
    name: '', name_ar: '', domain: '', industry: '',
    company_size: '', website: '', phone: '', city: '', country: '',
  });

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('companies.createCompany')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="form-label">{t('companies.name')}</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Arabic Name (optional)</label>
            <input className="form-input" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('companies.domain')}</label>
              <input className="form-input" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
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

export default CompaniesPage;