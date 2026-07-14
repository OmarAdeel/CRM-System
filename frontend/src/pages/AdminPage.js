import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { usersAPI, auditAPI } from '../services/api';
import {
  ShieldCheckIcon, UsersIcon, ClockIcon, PlusIcon, PencilIcon,
  XMarkIcon, UserPlusIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AdminPage = () => {
  const { t } = useTranslation();
  const { isAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  if (!isAdmin && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs = [
    { id: 'users', label: t('admin.users'), icon: UsersIcon, roles: ['admin'] },
    { id: 'audit', label: t('admin.auditLogs'), icon: ClockIcon, roles: ['admin', 'manager'] },
    { id: 'subscription', label: t('admin.subscription'), icon: ShieldCheckIcon, roles: ['admin'] },
  ];

  const visibleTabs = tabs.filter(tab => tab.roles.includes(isAdmin ? 'admin' : 'manager'));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('admin.title')}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-56 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5 flex-shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {activeTab === 'users' && isAdmin && <UsersTab t={t} />}
          {activeTab === 'audit' && <AuditTab t={t} />}
          {activeTab === 'subscription' && isAdmin && <SubscriptionTab t={t} />}
        </div>
      </div>
    </div>
  );
};

// ─── Users Tab ─────────────────────────────────────────
const UsersTab = ({ t }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersAPI.getAll({ limit: 100 });
      setUsers(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await usersAPI.toggleActive(userId);
      toast.success(t('common.saved'));
      fetchUsers();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleCreate = async (formData) => {
    try {
      await usersAPI.create(formData);
      toast.success(t('common.saved'));
      setShowAddUser(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    }
  };

  const handleUpdate = async (userId, formData) => {
    try {
      await usersAPI.update(userId, formData);
      toast.success(t('common.saved'));
      setEditingUser(null);
      fetchUsers();
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
        <h2 className="text-lg font-semibold text-gray-900">{t('admin.users')} ({users.length})</h2>
        <button onClick={() => setShowAddUser(true)} className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" />
          {t('app.create')}
        </button>
      </div>

      <div className="table-container">
        <table className="table-crm">
          <thead>
            <tr>
              <th>Name</th>
              <th>{t('auth.email')}</th>
              <th>Role</th>
              <th>Language</th>
              <th>Territory</th>
              <th>{t('common.status')}</th>
              <th>Last Login</th>
              <th>{t('app.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-gray-900">
                  {u.first_name} {u.last_name}
                </td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${
                    u.role === 'admin' ? 'badge-red' : u.role === 'manager' ? 'badge-yellow' : 'badge-blue'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td>{u.language === 'ar' ? '🇸🇦 AR' : '🇬🇧 EN'}</td>
                <td>{u.territory || '—'}</td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>
                    {u.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingUser(u)} className="btn-ghost btn-sm p-1.5">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u.id)}
                      className={`btn-sm px-2 py-1 text-xs rounded-md ${
                        u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddUser && (
        <UserModal title={t('app.create')} onSave={handleCreate} onClose={() => setShowAddUser(false)} t={t} />
      )}
      {editingUser && (
        <UserModal title={t('app.edit')} user={editingUser} onSave={(data) => handleUpdate(editingUser.id, data)} onClose={() => setEditingUser(null)} t={t} />
      )}
    </div>
  );
};

// ─── User Modal (Create/Edit) ──────────────────────────
const UserModal = ({ title, user, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    password: user ? '' : 'changeme123',
    role: user?.role || 'rep',
    language: user?.language || 'en',
    territory: user?.territory || '',
    manager_id: user?.manager_id || null,
  });

  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">First Name</label>
              <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div>
              <label className="form-label">Last Name</label>
              <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="form-label">{t('auth.email')}</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          {!user && (
            <div>
              <label className="form-label">{t('auth.password')}</label>
              <input type="text" className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="rep">Rep</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="form-label">Language</label>
              <select className="form-input" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Territory</label>
            <input className="form-input" value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} />
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

// ─── Audit Log Tab ─────────────────────────────────────
const AuditTab = ({ t }) => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ entity_type: '', action: '' });

  useEffect(() => { fetchLogs(); }, [filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await auditAPI.getAll({ ...filter, limit: pagination.limit });
      setLogs(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const actionColors = {
    create: 'badge-green', update: 'badge-blue', delete: 'badge-red',
    login: 'badge-gray', logout: 'badge-gray', export: 'badge-yellow', import: 'badge-yellow', merge: 'badge-blue',
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {t('admin.auditLogs')} ({pagination.total})
      </h2>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filter.entity_type}
          onChange={e => setFilter({ ...filter, entity_type: e.target.value })}
          className="form-input w-auto py-2"
        >
          <option value="">All Entities</option>
          <option value="user">User</option>
          <option value="company">Company</option>
          <option value="contact">Contact</option>
          <option value="deal">Deal</option>
        </select>
        <select
          value={filter.action}
          onChange={e => setFilter({ ...filter, action: e.target.value })}
          className="form-input w-auto py-2"
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="export">Export</option>
          <option value="import">Import</option>
          <option value="merge">Merge</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="table-crm">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Entity</th>
              <th>Action</th>
              <th>Entity ID</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.user_name ? `${log.user_name} ${log.user_last_name || ''}` : `User #${log.user_id}`}</td>
                <td><span className="badge badge-gray">{log.entity_type}</span></td>
                <td><span className={`badge ${actionColors[log.action] || 'badge-gray'}`}>{log.action}</span></td>
                <td>{log.entity_id || '—'}</td>
                <td className="font-mono text-xs">{log.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && !loading && (
        <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
      )}
    </div>
  );
};

// ─── Subscription Tab ──────────────────────────────────
const SubscriptionTab = ({ t }) => {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    // Fetch subscription from billingAPI
    import('../services/api').then(({ billingAPI }) => {
      billingAPI.getSubscription().then(res => setSubscription(res.data.data)).catch(() => {});
    });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{t('admin.subscription')}</h2>
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="Plan" value={subscription?.plan || '—'} />
          <InfoItem label="Status" value={subscription?.status || '—'} />
          <InfoItem label="Users" value={subscription?.user_count || '—'} />
          <InfoItem label="Price/User" value={subscription?.price_per_user ? `$${subscription.price_per_user}` : '—'} />
          <InfoItem label="Stripe ID" value={subscription?.stripe_customer_id || '—'} />
          <InfoItem label="Period Start" value={subscription?.current_period_start || '—'} />
          <InfoItem label="Period End" value={subscription?.current_period_end || '—'} />
          <InfoItem label="Trial Ends" value={subscription?.trial_ends_at || '—'} />
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
    <p className="text-sm text-gray-900 capitalize">{value || '—'}</p>
  </div>
);

export default AdminPage;