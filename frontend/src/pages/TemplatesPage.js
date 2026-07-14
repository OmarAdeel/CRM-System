import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { templatesAPI } from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const TemplatesPage = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    try {
      const res = await templatesAPI.getAll({ limit: 100 });
      setTemplates(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editing) {
        await templatesAPI.update(editing.id, formData);
        toast.success(t('common.saved'));
      } else {
        await templatesAPI.create(formData);
        toast.success(t('common.fieldAdded'));
      }
      setShowModal(false);
      setEditing(null);
      fetchTemplates();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await templatesAPI.delete(id);
      toast.success(t('common.deleted'));
      fetchTemplates();
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
        <h1 className="text-2xl font-bold text-gray-900">{t('navigation.templates')}</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" />
          New Template
        </button>
      </div>

      {templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                    <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                    {tpl.category && <span className="badge badge-gray text-xs mt-1">{tpl.category}</span>}
                    {tpl.is_shared && <span className="badge badge-blue text-xs mt-1 ms-1">Shared</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(tpl); setShowModal(true); }} className="btn-ghost btn-sm p-1.5">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(tpl.id)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:text-red-700">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase">Subject (EN)</p>
                  <p className="text-sm text-gray-700 truncate">{tpl.subject || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase">Subject (AR)</p>
                  <p className="text-sm text-gray-700 truncate" dir="rtl">{tpl.subject_ar || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No templates yet. Create one to speed up your email replies.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
            <PlusIcon className="w-4 h-4" /> New Template
          </button>
        </div>
      )}

      {showModal && (
        <TemplateModal
          template={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
          t={t}
        />
      )}
    </div>
  );
};

const TemplateModal = ({ template, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    subject: template?.subject || '',
    subject_ar: template?.subject_ar || '',
    body: template?.body || '',
    body_ar: template?.body_ar || '',
    category: template?.category || '',
    is_shared: template?.is_shared || false,
  });

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-gray-900">{template ? t('app.edit') : 'New Template'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="form-label">Template Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="form-label">Category</label>
            <input className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. follow-up, intro, proposal" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Subject (English)</label>
              <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="form-label">Subject (Arabic)</label>
              <input className="form-input" value={form.subject_ar} onChange={e => setForm({ ...form, subject_ar: e.target.value })} dir="rtl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Body (English)</label>
              <textarea className="form-input" rows={6} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} dir="ltr" />
            </div>
            <div>
              <label className="form-label">Body (Arabic)</label>
              <textarea className="form-input" rows={6} value={form.body_ar} onChange={e => setForm({ ...form, body_ar: e.target.value })} dir="rtl" />
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            💡 Tip: Use placeholders like [Name], [Company], [Your Name] — they'll be auto-filled when composing.
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_shared} onChange={e => setForm({ ...form, is_shared: e.target.checked })} className="rounded" />
            Share with all team members
          </label>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
            <button type="submit" className="btn-primary">{t('app.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplatesPage;