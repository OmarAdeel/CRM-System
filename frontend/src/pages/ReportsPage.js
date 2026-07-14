import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardAPI, pipelinesAPI, dealsAPI } from '../services/api';
import toast from 'react-hot-toast';

const ReportsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [lostReasons, setLostReasons] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lbRes, pipeRes] = await Promise.all([
        dashboardAPI.getLeaderboard(),
        pipelinesAPI.getAll(),
      ]);
      setLeaderboard(lbRes.data.data || []);
      setPipelines(pipeRes.data.data || []);
      if (pipeRes.data.data?.length > 0) {
        const defaultPipe = pipeRes.data.data.find(p => p.is_default) || pipeRes.data.data[0];
        setSelectedPipeline(defaultPipe);
        await loadFunnel(defaultPipe.id);
      }
      await loadLostReasons();
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const loadFunnel = async (pipelineId) => {
    try {
      const res = await dashboardAPI.getFunnel(pipelineId);
      setFunnel(res.data.data || []);
    } catch (err) {
      console.error('Funnel error:', err);
    }
  };

  const loadLostReasons = async () => {
    try {
      const res = await dealsAPI.getAll({ status: 'lost', limit: 100 });
      const deals = res.data.data || [];
      // Aggregate loss reasons
      const reasonMap = {};
      deals.forEach(d => {
        const reason = d.loss_reason || 'No reason given';
        reasonMap[reason] = (reasonMap[reason] || 0) + 1;
      });
      setLostReasons(Object.entries(reasonMap).sort((a, b) => b[1] - a[1]));
    } catch (err) {
      console.error('Lost reasons error:', err);
    }
  };

  const handlePipelineChange = (e) => {
    const pipe = pipelines.find(p => p.id === parseInt(e.target.value));
    if (pipe) {
      setSelectedPipeline(pipe);
      loadFunnel(pipe.id);
    }
  };

  // Calculate funnel conversion
  const maxCount = funnel.length > 0 ? funnel[0].deal_count : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('reports.conversionFunnel')}</h2>
            {pipelines.length > 0 && (
              <select
                value={selectedPipeline?.id || ''}
                onChange={handlePipelineChange}
                className="form-input w-auto py-1.5 text-sm"
              >
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          {funnel.length > 0 ? (
            <div className="space-y-4">
              {funnel.map((item, i) => {
                const pct = maxCount > 0 ? Math.round((item.deal_count / maxCount) * 100) : 0;
                const prevPct = i > 0 && funnel[i-1].deal_count > 0
                  ? Math.round((item.deal_count / funnel[i-1].deal_count) * 100)
                  : 100;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{item.name_ar || item.name}</span>
                      <span className="text-gray-500">{item.deal_count} deals · {pct}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {i > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {prevPct < 100 ? `↓ ${100 - prevPct}% drop-off from previous stage` : 'No drop-off'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
          )}
        </div>

        {/* Activity Leaderboard */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.leaderboard')}</h2>
          {leaderboard.length > 0 && leaderboard.some(l => l.total_activities > 0) ? (
            <div className="space-y-3">
              {leaderboard.map((item, i) => (
                <div key={item.id} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-amber-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{item.first_name} {item.last_name}</p>
                    <p className="text-xs text-gray-500">
                      {item.calls} calls · {item.emails} emails · {item.meetings} meetings
                    </p>
                  </div>
                  <span className="text-sm font-bold text-blue-700">{item.total_activities}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
          )}
        </div>

        {/* Lost Deal Analysis */}
        <div className="card lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('reports.lostDealAnalysis')}</h2>
          {lostReasons.length > 0 ? (
            <div className="space-y-3">
              {lostReasons.map(([reason, count], i) => {
                const maxReason = lostReasons[0][1];
                const pct = maxReason > 0 ? Math.round((count / maxReason) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{reason}</span>
                      <span className="text-gray-500">{count} {count === 1 ? 'deal' : 'deals'}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No lost deals to analyze. 🎉</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;