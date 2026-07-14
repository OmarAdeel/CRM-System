import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { automationsAPI } from '../services/api';
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon, BoltIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AutomationsPage = () => {
  const { t } = useTranslation();
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchAutomations(); }, []);

  const fetchAutomations = async () => {
    try {
      const res = await automationsAPI.getAll();
      setAutomations(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editing) {
        await automationsAPI.update(editing.id, formData);
        toast.success(t('common.saved'));
      } else {
        await automationsAPI.create(formData);
        toast.success(t('common.fieldAdded'));
      }
      setShowModal(false);
      setEditing(null);
      fetchAutomations();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await automationsAPI.delete(id);
      toast.success(t('common.deleted'));
      fetchAutomations();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleToggle = async (id) => {
    try {
      await automationsAPI.toggle(id);
      fetchAutomations();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const triggerLabels = {
    deal_stage_changed: 'Deal moves to stage',
    deal_created: 'New deal created',
    contact_created: 'New contact created',
    lead_score_reached: 'Lead score reaches threshold',
    date_reached: 'Date reached',
    manual: 'Manual trigger',
  };

  const actionLabels = {
    send_email: 'Send email',
    create_task: 'Create task',
    update_field: 'Update field',
    send_whatsapp: 'Send WhatsApp',
    assign_owner: 'Assign owner (smart routing)',
    webhook: 'Call webhook',
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
        <h1 className="text-2xl font-bold text-gray-900">{t('navigation.automations')}</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" />
          New Automation
        </button>
      </div>

      <div className="p-3 bg-blue-50 text-sm text-blue-800 rounded-lg border border-blue-200">
        ⚡ <strong>If/Then automations</strong> run automatically when triggers fire. Click the toggle to enable/disable.
      </div>

      {automations.length > 0 ? (
        <div className="space-y-3">
          {automations.map((a) => (
            <div key={a.id} className="card flex items-center gap-4">
              {/* Toggle */}
              <button
                onClick={() => handleToggle(a.id)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  a.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  a.is_active ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>

              {/* If/Then visualization */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <BoltIcon className={`w-4 h-4 ${a.is_active ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className="font-semibold text-gray-900">{a.name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="badge badge-yellow">IF: {triggerLabels[a.trigger_type] || a.trigger_type}</span>
                  <ArrowRightIcon className="w-3 h-3 text-gray-400" />
                  <span className="badge badge-blue">THEN: {actionLabels[a.action_type] || a.action_type}</span>
                </div>
                {a.description && <p className="text-xs text-gray-500 mt-1">{a.description}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { setEditing(a); setShowModal(true); }} className="btn-ghost btn-sm p-1.5">
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(a.id)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:text-red-700">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <BoltIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No automations yet. Create an If/Then rule to automate your workflow.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
            <PlusIcon className="w-4 h-4" /> New Automation
          </button>
        </div>
      )}

      {showModal && (
        <AutomationModal
          automation={editing}
          triggerLabels={triggerLabels}
          actionLabels={actionLabels}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
          t={t}
        />
      )}
    </div>
  );
};

// ─── Automation Modal (If/Then Builder) ────────────────
const AutomationModal = ({ automation, triggerLabels, actionLabels, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    name: automation?.name || '',
    description: automation?.description || '',
    trigger_type: automation?.trigger_type || 'deal_stage_changed',
    action_type: automation?.action_type || 'send_email',
    trigger_config: parseConfigSafe(automation?.trigger_config),
    action_config: parseConfigSafe(automation?.action_config),
  });

  function parseConfigSafe(val) {
    if (!val) return {};
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return {}; } }
    return val;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  const updateTriggerConfig = (key, value) => {
    setForm(prev => ({ ...prev, trigger_config: { ...prev.trigger_config, [key]: value } }));
  };

  const updateActionConfig = (key, value) => {
    setForm(prev => ({ ...form, action_config: { ...prev.action_config, [key]: value } }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-semibold text-gray-900">{automation ? t('app.edit') : 'New Automation'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Basic Info */}
          <div>
            <label className="form-label">Automation Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Notify on Won Deal" required />
          </div>
          <div>
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does this automation do?" />
          </div>

          {/* IF block */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-yellow font-bold">IF</span>
              <p className="text-sm font-medium text-amber-900">When this happens...</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Trigger Type</label>
                <select className="form-input" value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value, trigger_config: {} })}>
                  {Object.entries(triggerLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              {/* Trigger-specific config — only render relevant fields */}
              {form.trigger_type === 'lead_score_reached' && (
                <div>
                  <label className="form-label">Score Threshold</label>
                  <input type="number" className="form-input" value={form.trigger_config.threshold || 50} onChange={e => updateTriggerConfig('threshold', parseInt(e.target.value))} min="1" max="100" />
                </div>
              )}

              {form.trigger_type === 'date_reached' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Specific Date (optional)</label>
                    <input type="date" className="form-input" value={form.trigger_config.date || ''} onChange={e => updateTriggerConfig('date', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Days before close (optional)</label>
                    <input type="number" className="form-input" value={form.trigger_config.days_before_close || ''} onChange={e => updateTriggerConfig('days_before_close', parseInt(e.target.value))} min="1" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ArrowRightIcon className="w-6 h-6 text-gray-400 rotate-90" />
          </div>

          {/* THEN block */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-blue font-bold">THEN</span>
              <p className="text-sm font-medium text-blue-900">Do this...</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="form-label">Action Type</label>
                <select className="form-input" value={form.action_type} onChange={e => setForm({ ...form, action_type: e.target.value, action_config: {} })}>
                  {Object.entries(actionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              {/* Action-specific config */}
              {(form.action_type === 'send_email' || form.action_type === 'send_whatsapp') && (
                <>
                  <div>
                    <label className="form-label">Subject</label>
                    <input className="form-input" value={form.action_config.subject || form.action_config.message_subject || ''} onChange={e => updateActionConfig('subject', e.target.value)} placeholder="Email subject" />
                  </div>
                  <div>
                    <label className="form-label">Body</label>
                    <textarea className="form-input" rows={4} value={form.action_config.body || form.action_config.message_body || ''} onChange={e => updateActionConfig('body', e.target.value)} placeholder="Email body. Use {{placeholders}} if needed." />
                  </div>
                </>
              )}

              {form.action_type === 'create_task' && (
                <>
                  <div>
                    <label className="form-label">Task Title</label>
                    <input className="form-input" value={form.action_config.task_title || ''} onChange={e => updateActionConfig('task_title', e.target.value)} placeholder="Follow up on deal" />
                  </div>
                  <div>
                    <label className="form-label">Task Description</label>
                    <textarea className="form-input" rows={3} value={form.action_config.task_description || ''} onChange={e => updateActionConfig('task_description', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Due Date (YYYY-MM-DD)</label>
                    <input type="date" className="form-input" value={form.action_config.due_date || ''} onChange={e => updateActionConfig('due_date', e.target.value)} />
                  </div>
                </>
              )}

              {form.action_type === 'update_field' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Entity</label>
                    <select className="form-input" value={form.action_config.entity || 'deal'} onChange={e => updateActionConfig('entity', e.target.value)}>
                      <option value="deal">Deal</option>
                      <option value="contact">Contact</option>
                      <option value="company">Company</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Field</label>
                    <input className="form-input" value={form.action_config.field || ''} onChange={e => updateActionConfig('field', e.target.value)} placeholder="priority" />
                  </div>
                  <div>
                    <label className="form-label">Value</label>
                    <input className="form-input" value={form.action_config.value || ''} onChange={e => updateActionConfig('value', e.target.value)} placeholder="high" />
                  </div>
                </div>
              )}

              {form.action_type === 'assign_owner' && (
                <div>
                  <label className="form-label">Routing Rule</label>
                  <select className="form-input" value={form.action_config.routing_rule || 'round_robin'} onChange={e => updateActionConfig('routing_rule', e.target.value)}>
                    <option value="round_robin">Round-robin (any active rep)</option>
                    <option value="by_language">By language preference</option>
                    <option value="by_territory">By territory</option>
                  </select>
                </div>
              )}

              {form.action_type === 'webhook' && (
                <div>
                  <label className="form-label">Webhook URL</label>
                  <input className="form-input" value={form.action_config.url || ''} onChange={e => updateActionConfig('url', e.target.value)} placeholder="https://example.com/webhook" />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('app.cancel')}</button>
            <button type="submit" className="btn-primary">{t('app.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AutomationsPage;