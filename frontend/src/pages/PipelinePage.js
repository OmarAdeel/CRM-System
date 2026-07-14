import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { pipelinesAPI, dealsAPI } from '../services/api';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const PipelinePage = () => {
  const { t } = useTranslation();
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const res = await pipelinesAPI.getAll();
      const data = res.data.data || [];
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipeline(data[0]);
        fetchDealsForPipeline(data[0].id);
      }
    } catch (err) {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDealsForPipeline = async (pipelineId) => {
    try {
      const res = await dealsAPI.getAll({ pipeline_id: pipelineId, limit: 100 });
      const deals = res.data.data || [];
      // Group deals by stage
      setSelectedPipeline(prev => {
        if (!prev) return prev;
        const stages = prev.stages?.map(stage => ({
          ...stage,
          deals: deals.filter(d => d.stage_id === stage.id),
        })) || [];
        return { ...prev, stages };
      });
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDragStart = (e, dealId) => {
    e.dataTransfer.setData('dealId', dealId);
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    try {
      await dealsAPI.move(dealId, stageId);
      // Refresh pipeline
      fetchDealsForPipeline(selectedPipeline.id);
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!selectedPipeline) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t('pipeline.noPipelines')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('pipeline.title')}</h1>
          {pipelines.length > 1 && (
            <select
              value={selectedPipeline.id}
              onChange={(e) => {
                const p = pipelines.find(pp => pp.id === parseInt(e.target.value));
                if (p) {
                  setSelectedPipeline(p);
                  fetchDealsForPipeline(p.id);
                }
              }}
              className="form-input w-auto py-1.5"
            >
              {pipelines.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <p className="text-sm text-gray-500">{t('pipeline.dragDrop')}</p>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board scrollbar-thin">
        {(selectedPipeline.stages || []).map(stage => (
          <div
            key={stage.id}
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Stage Header */}
            <div className="kanban-column-header">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color_hex }} />
                <h3 className="font-semibold text-sm text-gray-800">{stage.name}</h3>
                {stage.name_ar && <span className="text-xs text-gray-400">{stage.name_ar}</span>}
              </div>
              <span className="text-xs text-gray-500 font-medium">{stage.deals?.length || 0}</span>
            </div>

            {/* Stage Progress Bar */}
            <div className="w-full h-1 bg-gray-200 rounded-full mb-3">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stage.probability_pct}%`,
                  backgroundColor: stage.color_hex,
                }}
              />
            </div>

            {/* Deal Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
              {(stage.deals || []).map(deal => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id)}
                  onClick={() => window.location.href = `/deals/${deal.id}`}
                  className={`kanban-card ${deal.is_rotting ? 'kanban-card-rotten' : ''}`}
                >
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">{deal.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-blue-700">{formatMoney(deal.value)}</span>
                    {deal.is_rotting && (
                      <span className="badge badge-red text-xs">{t('deals.rotten')}</span>
                    )}
                  </div>
                  {deal.contact_name && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{deal.contact_name}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PipelinePage;
