import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { dealsAPI, activitiesAPI, productsAPI, aiAPI, pipelinesAPI } from '../services/api';
import {
  ArrowLeftIcon, PencilIcon, SparklesIcon, PlusIcon, TrashIcon,
  XMarkIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const DealDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [deal, setDeal] = useState(null);
  const [activities, setActivities] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [dealRes, activityRes, productsRes, pipelineRes] = await Promise.all([
        dealsAPI.getById(id),
        activitiesAPI.getByDeal(id, { limit: 30 }),
        productsAPI.getAll({ limit: 200 }),
        pipelinesAPI.getAll(),
      ]);
      setDeal(dealRes.data.data);
      setActivities(activityRes.data.data || []);
      setAllProducts(productsRes.data.data || []);
      setPipelines(pipelineRes.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
      navigate('/deals');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    try {
      toast.loading(t('app.processing'));
      const res = await aiAPI.generateSummary(id);
      setAiSummary(res.data.data.summary);
      toast.dismiss();
      toast.success(t('common.success'));
    } catch (err) {
      toast.dismiss();
      toast.error(t('common.error'));
    }
  };

  const handleUpdate = async (formData) => {
    try {
      await dealsAPI.update(id, formData);
      toast.success(t('common.saved'));
      setShowEdit(false);
      loadData();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleAddProduct = async (productId, quantity, unitPrice) => {
    try {
      await dealsAPI.addProduct(id, { product_id: productId, quantity, unit_price: unitPrice });
      toast.success(t('common.saved'));
      setShowAddProduct(false);
      loadData();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleRemoveProduct = async (productId) => {
    try {
      await dealsAPI.removeProduct(id, productId);
      toast.success(t('common.deleted'));
      loadData();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleAddActivity = async (formData) => {
    try {
      await activitiesAPI.create({ ...formData, deal_id: parseInt(id) });
      toast.success(t('common.saved'));
      setShowAddActivity(false);
      loadData();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const formatMoney = (val, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val || 0);

  const activityIcons = {
    call: '📞', email: '✉️', meeting: '🤝', note: '📝', whatsapp: '💬', task: '✅', sms: '📱', other: '📌',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!deal) return null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost btn-sm">
          <ArrowLeftIcon className="w-4 h-4" />
          {t('app.back')}
        </button>
        <div className="flex gap-2">
          <button onClick={handleGenerateSummary} className="btn-secondary btn-sm">
            <SparklesIcon className="w-4 h-4" />
            {t('ai.summary')}
          </button>
          <button onClick={() => setShowAddActivity(true)} className="btn-secondary btn-sm">
            <ClockIcon className="w-4 h-4" />
            {t('activities.addActivity')}
          </button>
          <button onClick={() => setShowEdit(true)} className="btn-primary btn-sm">
            <PencilIcon className="w-4 h-4" />
            {t('app.edit')}
          </button>
        </div>
      </div>

      {/* Deal Header Card */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{deal.title}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="badge badge-blue">{deal.stage_name}</span>
              <span className={`badge ${deal.status === 'won' ? 'badge-green' : deal.status === 'lost' ? 'badge-red' : 'badge-yellow'}`}>
                {deal.status}
              </span>
              <span className="badge badge-gray">{deal.priority}</span>
            </div>
          </div>
          <div className="text-end">
            <p className="text-3xl font-bold text-blue-700">{formatMoney(deal.value, deal.currency)}</p>
            {deal.probability_pct != null && (
              <p className="text-sm text-gray-500 mt-1">{t('deals.probability')}: {deal.probability_pct}%</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <InfoItem label={t('deals.expectedClose')} value={deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—'} />
          <InfoItem label={t('deals.owner')} value={deal.owner_name} />
          <InfoItem label={t('contacts.company')} value={deal.company_name} />
          <InfoItem label={t('contacts.title')} value={deal.contact_name} />
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <SparklesIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-blue-900">{t('ai.summary')}</h2>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{aiSummary}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('deals.products')}</h2>
            <button onClick={() => setShowAddProduct(true)} className="btn-secondary btn-sm">
              <PlusIcon className="w-4 h-4" />
              {t('deals.addProduct')}
            </button>
          </div>

          {deal.products && deal.products.length > 0 ? (
            <div className="space-y-2">
              {deal.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.product_name}</p>
                    <p className="text-xs text-gray-500">{p.quantity} × {formatMoney(p.unit_price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(p.line_total)}</span>
                    <button onClick={() => handleRemoveProduct(p.product_id)} className="text-red-400 hover:text-red-600">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-semibold text-gray-900">{t('deals.totalValue')}</span>
                <span className="text-lg font-bold text-blue-700">
                  {formatMoney(deal.total_products_value || deal.value, deal.currency)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4 text-center">{t('app.noData')}</p>
          )}

          {deal.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{deal.notes}</p>
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('contacts.timeline')}</h2>
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                  <div className="text-xl flex-shrink-0">{activityIcons[a.activity_type] || '📌'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.subject || a.activity_type}</p>
                    {a.content && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{a.content}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(a.created_at).toLocaleDateString()} — {a.user_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('activities.noActivities')}</p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditDealModal
          deal={deal}
          pipelines={pipelines}
          onSave={handleUpdate}
          onClose={() => setShowEdit(false)}
          t={t}
        />
      )}

      {/* Add Product Modal */}
      {showAddProduct && (
        <AddProductModal
          products={allProducts}
          onAdd={handleAddProduct}
          onClose={() => setShowAddProduct(false)}
          t={t}
        />
      )}

      {/* Add Activity Modal */}
      {showAddActivity && (
        <AddActivityModal
          onSave={handleAddActivity}
          onClose={() => setShowAddActivity(false)}
          t={t}
        />
      )}
    </div>
  );
};

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="text-sm text-gray-900">{value || '—'}</p>
  </div>
);

// ─── Edit Deal Modal ──────────────────────────────────
const EditDealModal = ({ deal, pipelines, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    title: deal.title || '',
    value: deal.value || 0,
    currency: deal.currency || 'USD',
    pipeline_id: deal.pipeline_id,
    stage_id: deal.stage_id,
    expected_close_date: deal.expected_close_date || '',
    priority: deal.priority || 'medium',
    status: deal.status || 'open',
    notes: deal.notes || '',
    loss_reason: deal.loss_reason || '',
  });

  const stages = pipelines.find(p => p.id === form.pipeline_id)?.stages || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal onClose={onClose} title={t('app.edit')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">{t('deals.dealTitle')}</label>
          <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">{t('deals.value')}</label>
            <input type="number" step="0.01" className="form-input" value={form.value} onChange={e => setForm({ ...form, value: parseFloat(e.target.value) })} />
          </div>
          <div>
            <label className="form-label">Currency</label>
            <select className="form-input" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Pipeline</label>
            <select className="form-input" value={form.pipeline_id} onChange={e => setForm({ ...form, pipeline_id: parseInt(e.target.value), stage_id: stages[0]?.id })}>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">{t('deals.stage')}</label>
            <select className="form-input" value={form.stage_id} onChange={e => setForm({ ...form, stage_id: parseInt(e.target.value) })}>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
        <div>
          <label className="form-label">Status</label>
          <select className="form-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="open">Open</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
        </div>
        {form.status === 'lost' && (
          <div>
            <label className="form-label">Loss Reason</label>
            <textarea className="form-input" rows={2} value={form.loss_reason} onChange={e => setForm({ ...form, loss_reason: e.target.value })} />
          </div>
        )}
        <div>
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
          <button type="submit" className="btn-primary">{t('app.save')}</button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Add Product Modal ─────────────────────────────────
const AddProductModal = ({ products, onAdd, onClose, t }) => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  const selectedProduct = products.find(p => p.id === parseInt(productId));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!productId) return;
    onAdd(parseInt(productId), parseFloat(quantity) || 1, parseFloat(unitPrice) || (selectedProduct?.unit_price || 0));
  };

  return (
    <Modal onClose={onClose} title={t('deals.addProduct')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Product</label>
          <select
            className="form-input"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find(p => p.id === parseInt(e.target.value));
              if (p) setUnitPrice(p.unit_price);
            }}
            required
          >
            <option value="">Select a product...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {new Intl.NumberFormat('en-US', { style: 'currency', currency: p.currency }).format(p.unit_price)}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Quantity</label>
            <input type="number" step="0.01" className="form-input" value={quantity} onChange={e => setQuantity(e.target.value)} min="0.01" />
          </div>
          <div>
            <label className="form-label">Unit Price</label>
            <input type="number" step="0.01" className="form-input" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
          <button type="submit" className="btn-primary">{t('app.save')}</button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Add Activity Modal ────────────────────────────────
const AddActivityModal = ({ onSave, onClose, t }) => {
  const [form, setForm] = useState({
    activity_type: 'note',
    subject: '',
    content: '',
    direction: 'internal',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.subject) return;
    onSave(form);
  };

  return (
    <Modal onClose={onClose} title={t('activities.addActivity')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">{t('activities.type')}</label>
          <select className="form-input" value={form.activity_type} onChange={e => setForm({ ...form, activity_type: e.target.value })}>
            <option value="note">{t('activities.note')}</option>
            <option value="call">{t('activities.call')}</option>
            <option value="email">{t('activities.email')}</option>
            <option value="meeting">{t('activities.meeting')}</option>
            <option value="whatsapp">{t('activities.whatsapp')}</option>
            <option value="task">{t('activities.task')}</option>
          </select>
        </div>
        <div>
          <label className="form-label">{t('activities.subject')}</label>
          <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">{t('activities.content')}</label>
          <textarea className="form-input" rows={3} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
        </div>
        <div>
          <label className="form-label">{t('activities.direction')}</label>
          <select className="form-input" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
            <option value="internal">{t('activities.internal')}</option>
            <option value="inbound">{t('activities.inbound')}</option>
            <option value="outbound">{t('activities.outbound')}</option>
          </select>
        </div>
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

export default DealDetailPage;
