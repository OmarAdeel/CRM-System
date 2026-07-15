import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth if token is invalid
      localStorage.removeItem('crm_token');
      delete api.defaults.headers.common['Authorization'];
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
};

// ─── Contacts ──────────────────────────────────────────
export const contactsAPI = {
  getAll: (params) => api.get('/contacts', { params }),
  getById: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  enrich: (id) => api.post(`/contacts/${id}/enrich`),
  merge: (data) => api.post('/contacts/merge', data),
  detectDuplicates: () => api.get('/contacts/duplicates'),
};

// ─── Companies ─────────────────────────────────────────
export const companiesAPI = {
  getAll: (params) => api.get('/companies', { params }),
  getById: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  delete: (id) => api.delete(`/companies/${id}`),
  enrich: (id) => api.post(`/companies/${id}/enrich`),
};

// ─── Deals ─────────────────────────────────────────────
export const dealsAPI = {
  getAll: (params) => api.get('/deals', { params }),
  getById: (id) => api.get(`/deals/${id}`),
  create: (data) => api.post('/deals', data),
  update: (id, data) => api.put(`/deals/${id}`, data),
  delete: (id) => api.delete(`/deals/${id}`),
  move: (id, stageId) => api.patch(`/deals/${id}/move`, { stage_id: stageId }),
  addProduct: (id, data) => api.post(`/deals/${id}/products`, data),
  removeProduct: (dealId, productId) => api.delete(`/deals/${dealId}/products/${productId}`),
};

// ─── Pipelines ─────────────────────────────────────────
export const pipelinesAPI = {
  getAll: () => api.get('/pipelines'),
  getById: (id) => api.get(`/pipelines/${id}`),
  create: (data) => api.post('/pipelines', data),
  update: (id, data) => api.put(`/pipelines/${id}`, data),
  delete: (id) => api.delete(`/pipelines/${id}`),
  addStage: (id, data) => api.post(`/pipelines/${id}/stages`, data),
  updateStage: (pipelineId, stageId, data) => api.put(`/pipelines/${pipelineId}/stages/${stageId}`, data),
  deleteStage: (pipelineId, stageId) => api.delete(`/pipelines/${pipelineId}/stages/${stageId}`),
};

// ─── Activities ────────────────────────────────────────
export const activitiesAPI = {
  getAll: (params) => api.get('/activities', { params }),
  getByContact: (contactId, params) => api.get(`/activities/contact/${contactId}`, { params }),
  getByDeal: (dealId, params) => api.get(`/activities/deal/${dealId}`, { params }),
  create: (data) => api.post('/activities', data),
  update: (id, data) => api.put(`/activities/${id}`, data),
  delete: (id) => api.delete(`/activities/${id}`),
};

// ─── Products ──────────────────────────────────────────
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

// ─── Dashboard ─────────────────────────────────────────
export const dashboardAPI = {
  getStats: (params) => api.get('/dashboard/stats', { params }),
  getLeaderboard: (params) => api.get('/dashboard/leaderboard', { params }),
  getForecast: () => api.get('/dashboard/forecast'),
  getFunnel: (pipelineId) => api.get(`/dashboard/funnel/${pipelineId}`),
};

// ─── AI ────────────────────────────────────────────────
export const aiAPI = {
  getRecommendations: () => api.get('/ai/recommendations'),
  dismissRecommendation: (id) => api.patch(`/ai/recommendations/${id}/dismiss`),
  draftEmail: (data) => api.post('/ai/draft-email', data),
  scoreLead: (contactId) => api.post(`/ai/score-lead/${contactId}`),
  translate: (data) => api.post('/ai/translate', data),
  enrichContact: (contactId) => api.post(`/ai/enrich-contact/${contactId}`),
  enrichCompany: (companyId) => api.post(`/ai/enrich-company/${companyId}`),
  generateSummary: (dealId) => api.post(`/ai/generate-summary/${dealId}`),
  scanStagnant: () => api.post('/ai/scan-stagnant'),
  getStatus: () => api.get('/ai/status'),
  generateReportInsights: () => api.post('/ai/report-insights', {}, { timeout: 100000 }),
};

// ─── Automations ───────────────────────────────────────
export const automationsAPI = {
  getAll: () => api.get('/automations'),
  getById: (id) => api.get(`/automations/${id}`),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  delete: (id) => api.delete(`/automations/${id}`),
  toggle: (id) => api.patch(`/automations/${id}/toggle`),
};

// ─── Custom Fields ─────────────────────────────────────
export const customFieldsAPI = {
  getAll: (entityType) => api.get('/custom-fields', { params: { entity_type: entityType } }),
  create: (data) => api.post('/custom-fields', data),
  update: (id, data) => api.put(`/custom-fields/${id}`, data),
  delete: (id) => api.delete(`/custom-fields/${id}`),
};

// ─── Templates ─────────────────────────────────────────
export const templatesAPI = {
  getAll: (params) => api.get('/templates', { params }),
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
};

// ─── Import / Export ──────────────────────────────────
export const importExportAPI = {
  import: (entityType, formData) => api.post(`/import-export/import/${entityType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  export: (entityType, params) => api.get(`/import-export/export/${entityType}`, {
    params,
    responseType: 'blob',
  }),
};

// ─── Audit ─────────────────────────────────────────────
export const auditAPI = {
  getAll: (params) => api.get('/audit', { params }),
};

// ─── Users ─────────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  toggleActive: (id) => api.patch(`/users/${id}/toggle-active`),
};

// ─── Billing ───────────────────────────────────────────
export const billingAPI = {
  getSubscription: () => api.get('/billing/subscription'),
  getPlans: () => api.get('/billing/plans'),
  createCheckoutSession: (plan) => api.post('/billing/create-checkout', { plan }),
  cancelSubscription: () => api.post('/billing/cancel'),
  getInvoices: () => api.get('/billing/invoices'),
};

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export const emailAPI = {
  send: (data) => api.post('/email/send', data),
  getLogs: () => api.get('/email/logs'),
  getLog: (id) => api.get(`/email/logs/${id}`),
};

export const whatsappAPI = {
  send: (data) => api.post('/whatsapp/send', data),
  getHistory: (contactId) => api.get(`/whatsapp/history/${contactId}`),
  getStatus: () => api.get('/whatsapp/status'),
};

export const oauthAPI = {
  getStatus: () => api.get('/auth/oauth/status'),
  connectGoogle: () => `${API_BASE_URL.replace('/api','')}/api/auth/google`,
  connectMicrosoft: () => `${API_BASE_URL.replace('/api','')}/api/auth/microsoft`,
  syncEmails: () => api.post('/auth/oauth/sync-emails'),
};

export default api;
