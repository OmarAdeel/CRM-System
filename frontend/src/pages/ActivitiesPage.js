import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { activitiesAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ActivitiesPage = () => {
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await activitiesAPI.getAll({ limit: 50 });
      setActivities(res.data.data || []);
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('activities.title')}</h1>
        <button className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          {t('activities.addActivity')}
        </button>
      </div>

      {activities.length > 0 ? (
        <div className="space-y-3">
          {activities.map((a) => (
            <div key={a.id} className="card flex gap-4 hover:shadow-md transition-shadow">
              <div className="text-2xl flex-shrink-0">{activityIcons[a.activity_type]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge badge-gray text-xs">{a.activity_type}</span>
                  <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p className="font-medium text-gray-900">{a.subject}</p>
                {a.content && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.content}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{a.user_name}</span>
                  {a.contact_name && <span>• {a.contact_name}</span>}
                  {a.deal_title && <span>• {a.deal_title}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500">{t('activities.noActivities')}</div>
      )}
    </div>
  );
};

export default ActivitiesPage;
