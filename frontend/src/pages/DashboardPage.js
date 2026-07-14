import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardAPI, aiAPI } from '../services/api';
import {
  CurrencyDollarIcon,
  CheckBadgeIcon,
  FunnelIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const DashboardPage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, recsRes] = await Promise.all([
          dashboardAPI.getStats(),
          aiAPI.getRecommendations(),
        ]);
        setStats(statsRes.data.data);
        setRecommendations(recsRes.data.data || []);
      } catch (err) {
        toast.error(t('common.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val || 0);

  const statCards = [
    { label: t('dashboard.totalRevenue'), value: formatMoney(stats?.totalRevenue), icon: CurrencyDollarIcon, color: 'bg-blue-50 text-blue-600' },
    { label: 'MRR', value: formatMoney(stats?.mrr), icon: ChartBarIcon, color: 'bg-indigo-50 text-indigo-600' },
    { label: t('dashboard.dealsWon'), value: stats?.dealsWon || 0, icon: CheckBadgeIcon, color: 'bg-emerald-50 text-emerald-600' },
    { label: t('dashboard.activePipeline'), value: formatMoney(stats?.activePipelineValue), sub: `${stats?.activePipeline || 0} deals`, icon: FunnelIcon, color: 'bg-purple-50 text-purple-600' },
    { label: t('dashboard.conversionRate'), value: `${stats?.conversionRate || 0}%`, icon: ChartBarIcon, color: 'bg-amber-50 text-amber-600' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.color} flex-shrink-0`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 truncate">{card.label}</p>
              <p className="text-xl font-bold text-gray-900 truncate">{card.value}</p>
              {card.sub && <p className="text-xs text-gray-400">{card.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Forecast & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.forecast')}</h2>
          {stats?.forecast && stats.forecast.length > 0 ? (
            <div className="space-y-3">
              {stats.forecast.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{item.name_ar || item.name}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatMoney(item.weighted_value)}
                      <span className="text-xs text-gray-400 ms-2">({item.deal_count} deals)</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${item.probability_pct}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100 flex justify-between font-semibold">
                <span className="text-gray-900">Total Weighted</span>
                <span className="text-blue-700">
                  {formatMoney(stats.forecast.reduce((sum, f) => sum + parseFloat(f.weighted_value), 0))}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('app.noData')}</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('ai.nextBestAction')}</h2>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.slice(0, 5).map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{rec.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('ai.noRecommendations')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
