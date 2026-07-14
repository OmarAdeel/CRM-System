import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dealsAPI, pipelinesAPI, contactsAPI, companiesAPI } from '../services/api';
import PlaceholderPage from '../components/common/PlaceholderPage';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const DealsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchDeals(); }, [filter]);

  const fetchDeals = async () => {
    try {
      const params = { limit: 50 };
      if (filter !== 'all') params.status = filter;
      const res = await dealsAPI.getAll(params);
      setDeals(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (formData) => {
    try {
      const res = await dealsAPI.create(formData);
      toast.success(t('common.saved'));
      setShowCreate(false);
      navigate(`/deals/${res.data.data.id}`);
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('deals.title')}</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          {t('deals.createDeal')}
        </button>
      </div>

      <div className="flex gap-2">
        {['all', 'open', 'won', 'lost'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {deals.length > 0 ? (
        <div className="table-container">
          <table className="table-crm">
            <thead>
              <tr>
                <th>{t('deals.dealTitle')}</th>
                <th>{t('deals.value')}</th>
                <th>{t('deals.stage')}</th>
                <th>{t('deals.expectedClose')}</th>
                <th>{t('deals.owner')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="cursor-pointer" onClick={() => navigate(`/deals/${d.id}`)}>
                  <td className="font-medium text-gray-900">{d.title}</td>
                  <td className="font-medium">{formatMoney(d.value)}</td>
                  <td><span className="badge badge-blue">{d.stage_name || '—'}</span></td>
                  <td>{d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}</td>
                  <td>{d.owner_name || '—'}</td>
                  <td>
                    <span className={`badge capitalize ${d.status === 'won' ? 'badge-green' : d.status === 'lost' ? 'badge-red' : 'badge-yellow'}`}>
                      {d.status}
                    </span>
                    {d.is_rotting && <span className="badge badge-red text-xs ms-1">Stagnant</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PlaceholderPage
          title={t('deals.noDeals')}
          description="Create your first deal to start tracking your sales pipeline."
        />
      )}

      {showCreate && <CreateDealModal onSave={handleCreate} onClose={() => setShowCreate(false)} t={t} />}
    </div>
  );
};

const CreateDealModal = ({ onSave, onClose, t }) => {
  const [pipelines, setPipelines] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [stages, setStages] = useState([]);

  const [form, setForm] = useState({
    title: '', value: 0, currency: 'USD',
    pipeline_id: '', stage_id: '',
    contact_id: '', company_id: '',
    expected_close_date: '', priority: 'medium',
  });

  useEffect(() => {
    Promise.all([
      pipelinesAPI.getAll(),
      contactsAPI.getAll({ limit: 200 }),
      companiesAPI.getAll({ limit: 200 }),
    ]).then(([pRes, cRes, compRes]) => {
      const p = pRes.data.data || [];
      setPipelines(p);
      setContacts(cRes.data.data || []);
      setCompanies(compRes.data.data || []);
      if (p.length > 0) {
        const defaultPipe = p.find(pp => pp.is_default) || p[0];
        setForm(prev => ({
          ...prev,
          pipeline_id: defaultPipe.id,
          stage_id: defaultPipe.stages?.[0]?.id || '',
        }));
        setStages(defaultPipe.stages || []);
      }
    }).catch(() => {});
  }, []);

  const handlePipelineChange = (e) => {
    const pid = parseInt(e.target.value);
    const pipe = pipelines.find(p => p.id === pid);
    setForm(prev => ({
      ...prev,
      pipeline_id: pid,
      stage_id: pipe?.stages?.[0]?.id || '',
    }));
    setStages(pipe?.stages || []);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form };
    if (data.pipeline_id) data.pipeline_id = parseInt(data.pipeline_id);
    if (data.stage_id) data.stage_id = parseInt(data.stage_id);
    if (data.contact_id) data.contact_id = parseInt(data.contact_id);
    if (data.company_id) data.company_id = parseInt(data.company_id);
    if (data.value) data.value = parseFloat(data.value);
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('deals.createDeal')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="form-label">{t('deals.dealTitle')}</label>
            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Acme Corp — Software License" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('deals.value')}</label>
              <input type="number" step="0.01" className="form-input" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="form-input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
                <option value="AED">AED</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Pipeline</label>
              <select className="form-input" value={form.pipeline_id} onChange={handlePipelineChange} required>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">{t('deals.stage')}</label>
              <select className="form-input" value={form.stage_id} onChange={e => setForm({ ...form, stage_id: e.target.value })} required>
                {stages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.probability_pct}%)</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('contacts.company')}</label>
              <select className="form-input" value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
                <option value="">—</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Contact</label>
              <select className="form-input" value={form.contact_id} onChange={e => setForm({ ...form, contact_id: e.target.value })}>
                <option value="">—</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">{t('deals.expectedClose')}</label>
              <input type="date" className="form-input" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
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

export default DealsPage;