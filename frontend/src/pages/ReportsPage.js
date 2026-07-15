import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, RadialBarChart, RadialBar,
} from 'recharts';
import { dashboardAPI, pipelinesAPI, dealsAPI, aiAPI } from '../services/api';
import {
  BanknotesIcon, ChartBarIcon, TrophyIcon, XCircleIcon,
  ArrowTrendingUpIcon, PhoneIcon, EnvelopeIcon, CalendarIcon, ChatBubbleLeftIcon,
  FireIcon, SparklesIcon, ArrowPathIcon, CpuChipIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

// ─── Vibrant gradient palette ──────────────────────────
const GRADIENTS = {
  blue:    ['#3B82F6', '#1D4ED8'],
  purple:  ['#A855F7', '#7C3AED'],
  pink:    ['#EC4899', '#DB2777'],
  emerald: ['#10B981', '#059669'],
  amber:   ['#F59E0B', '#D97706'],
  red:     ['#EF4444', '#DC2626'],
  cyan:    ['#06B6D4', '#0891B2'],
  indigo:  ['#6366F1', '#4F46E5'],
};

const LOST_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#EAB308', '#A855F7', '#EC4899', '#6B7280'];
const FUNNEL_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EF4444'];
const ACTIVITY_COLORS = {
  calls: '#3B82F6',
  emails: '#A855F7',
  meetings: '#10B981',
  whatsapps: '#06B6D4',
};

// ─── Animated number helper ────────────────────────────
const AnimatedNumber = ({ value, format = (n) => Math.round(n), duration = 1.2 }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = display;
    const startTime = performance.now();
    const tick = (now) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (value - start) * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line
  }, [value]);
  return <>{format(display)}</>;
};

// ─── Animation variants ────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, when: 'beforeChildren' } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 100, damping: 16 } },
};

// ─── Gradient KPI Card ─────────────────────────────────
const KPICard = ({ icon: Icon, label, value, format, gradient, delay }) => (
  <motion.div
    variants={cardVariants}
    whileHover={{ scale: 1.04, y: -4 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="relative overflow-hidden rounded-2xl p-5 shadow-lg cursor-default"
    style={{ background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)` }}
  >
    {/* Decorative blurred circle */}
    <div
      className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-25"
      style={{ background: 'white', filter: 'blur(24px)' }}
    />
    <div className="relative flex items-center gap-4">
      <div className="p-3 rounded-2xl bg-white/25 backdrop-blur-sm shadow-inner">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-white/80 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white tabular-nums mt-0.5">
          <AnimatedNumber value={value} format={format} />
        </p>
      </div>
    </div>
  </motion.div>
);

const ReportsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [lostReasons, setLostReasons] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [hoveredStage, setHoveredStage] = useState(null);
  const [activeTab, setActiveTab] = useState('funnel');
  const [aiInsights, setAiInsights] = useState(null);
  const [aiSource, setAiSource] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadAIInsights = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await aiAPI.generateReportInsights();
      const data = res.data?.data || {};
      setAiInsights(data.insights || '');
      setAiSource(data.source || 'heuristic');
      setAiGeneratedAt(data.generatedAt || new Date().toISOString());
    } catch (err) {
      console.error('AI insights error:', err);
      setAiError(err.response?.data?.message || 'Unable to generate insights right now.');
    } finally {
      setAiLoading(false);
    }
  };

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
      // Auto-generate AI insights once the core data is ready.
      loadAIInsights();
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

  const formatMoney = (val) => {
    const n = parseFloat(val) || 0;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  };

  // ─── Derived data ────────────────────────────────────
  const maxCount = funnel.length > 0 ? Math.max(...funnel.map(f => f.deal_count), 1) : 1;
  const totalPipelineValue = useMemo(
    () => funnel.reduce((sum, f) => sum + (parseFloat(f.total_value) || 0), 0), [funnel]
  );
  const totalDeals = useMemo(() => funnel.reduce((sum, f) => sum + f.deal_count, 0), [funnel]);
  const activeReps = leaderboard.filter(l => l.total_activities > 0).length;
  const totalLost = lostReasons.reduce((s, [, c]) => s + c, 0);
  const lostPieData = lostReasons.map(([reason, count]) => ({ name: reason, value: count }));
  const leaderboardBarData = leaderboard
    .filter(l => l.total_activities > 0)
    .map(l => ({
      name: `${l.first_name} ${l.last_name?.[0]}.`,
      calls: l.calls, emails: l.emails, meetings: l.meetings, whatsapps: l.whatsapps,
      total: l.total_activities,
    }));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Loading analytics…</p>
      </div>
    );
  }

  const tabs = [
    { id: 'funnel', label: t('reports.conversionFunnel'), icon: ArrowTrendingUpIcon, color: 'from-blue-500 to-indigo-600' },
    { id: 'leaderboard', label: t('reports.leaderboard'), icon: TrophyIcon, color: 'from-amber-500 to-orange-600' },
    { id: 'lost', label: t('reports.lostDealAnalysis'), icon: XCircleIcon, color: 'from-rose-500 to-red-600' },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ─── Header with gradient ribbon ─── */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl p-6 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #EC4899 100%)' }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <SparklesIcon className="w-7 h-7 text-amber-300" />
              {t('reports.title')}
            </h1>
            <p className="text-sm text-white/80 mt-1">Interactive insights into your sales performance</p>
          </div>
          {pipelines.length > 0 && (
            <select
              value={selectedPipeline?.id || ''}
              onChange={handlePipelineChange}
              className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm text-white text-sm border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
            >
              {pipelines.map(p => <option key={p.id} value={p.id} className="text-gray-900">{p.name}</option>)}
            </select>
          )}
        </div>
      </motion.div>

      {/* ─── AI Insights featured card ─── */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl p-6 shadow-xl border border-purple-200/50"
        style={{ background: 'linear-gradient(135deg, #2E1065 0%, #4C1D95 35%, #7C3AED 70%, #DB2777 100%)' }}
      >
        {/* Floating decorative blobs */}
        <motion.div
          aria-hidden
          className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-pink-400/20 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -bottom-20 -left-10 w-44 h-44 rounded-full bg-indigo-400/20 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        <div className="relative">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg"
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <CpuChipIcon className="w-7 h-7 text-amber-300" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  AI Insight Report
                  <SparklesIcon className="w-5 h-5 text-amber-300" />
                </h2>
                <p className="text-xs text-white/70 mt-0.5">
                  Auto-generated analysis across your pipeline, team performance, and losses.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {aiSource && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {aiSource}
                </span>
              )}
              <motion.button
                onClick={loadAIInsights}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-purple-700 text-sm font-semibold shadow-md hover:bg-purple-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowPathIcon className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
                {aiLoading ? 'Generating…' : 'Regenerate'}
              </motion.button>
            </div>
          </div>

          {/* Body: loading skeleton / error / insights text */}
          <AnimatePresence mode="wait">
            {aiLoading && !aiInsights ? (
              <motion.div
                key="ai-loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-4 rounded-lg bg-white/20"
                    style={{ width: `${85 - i * 8}%` }}
                    animate={{ opacity: [0.25, 0.5, 0.25] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>
            ) : aiError && !aiInsights ? (
              <motion.div
                key="ai-error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-red-900/30 border border-red-400/40 p-4 text-sm text-red-100"
              >
                {aiError}
              </motion.div>
            ) : aiInsights ? (
              <motion.div
                key="ai-insights"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5"
              >
                <div className="whitespace-pre-line text-sm leading-relaxed text-white/95 font-medium">
                  {aiInsights}
                </div>
                {aiGeneratedAt && (
                  <p className="mt-4 pt-3 border-t border-white/15 text-[11px] text-white/50">
                    Generated {new Date(aiGeneratedAt).toLocaleString()}
                  </p>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ─── KPI Cards (vibrant gradients) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={BanknotesIcon} label="Pipeline Value" value={totalPipelineValue} format={formatMoney} gradient={GRADIENTS.blue} />
        <KPICard icon={ChartBarIcon} label="Active Deals" value={totalDeals} gradient={GRADIENTS.purple} />
        <KPICard icon={TrophyIcon} label="Active Reps" value={activeReps} gradient={GRADIENTS.amber} />
        <KPICard icon={XCircleIcon} label="Lost Deals" value={totalLost} gradient={GRADIENTS.pink} />
      </div>

      {/* ─── Tab Switcher ─── */}
      <motion.div variants={cardVariants} className="flex gap-2 p-1.5 bg-white rounded-2xl shadow-md w-fit border border-gray-100">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-pill"
                className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl shadow-md`}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ═══ Conversion Funnel ═══ */}
        {activeTab === 'funnel' && (
          <motion.div
            key="funnel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow">
                <ArrowTrendingUpIcon className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{t('reports.conversionFunnel')}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6 ps-10">
              {selectedPipeline?.name} · {totalDeals} deals · {formatMoney(totalPipelineValue)}
            </p>

            {funnel.length > 0 ? (
              <div className="space-y-3">
                {funnel.map((item, i) => {
                  const pct = maxCount > 0 ? Math.round((item.deal_count / maxCount) * 100) : 0;
                  const prevPct = i > 0 && funnel[i - 1].deal_count > 0
                    ? Math.round((item.deal_count / funnel[i - 1].deal_count) * 100)
                    : 100;
                  const dropOff = i > 0 ? 100 - prevPct : 0;
                  const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
                  const isHovered = hoveredStage === i;
                  return (
                    <motion.div
                      key={i}
                      onHoverStart={() => setHoveredStage(i)}
                      onHoverEnd={() => setHoveredStage(null)}
                      whileHover={{ scale: 1.02 }}
                      className="cursor-pointer"
                    >
                      <div className="flex justify-between items-center text-sm mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow"
                            style={{ background: color }}
                          >
                            {i + 1}
                          </span>
                          <span className={`font-medium transition-colors ${isHovered ? 'text-indigo-600' : 'text-gray-700'}`}>
                            {item.name_ar || item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <AnimatePresence>
                            {isHovered && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-xs px-2 py-0.5 rounded-full text-white font-medium shadow"
                                style={{ background: color }}
                              >
                                {formatMoney(item.total_value)}
                              </motion.span>
                            )}
                          </AnimatePresence>
                          <span className="text-gray-500 tabular-nums">{item.deal_count} · {pct}%</span>
                        </div>
                      </div>
                      <div className="w-full h-5 bg-gray-100 rounded-full overflow-hidden relative">
                        <motion.div
                          className="h-full rounded-full relative overflow-hidden"
                          style={{ background: `linear-gradient(90deg, ${color}cc 0%, ${color} 100%)` }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.9, delay: i * 0.12, ease: [0.4, 0, 0.2, 1] }}
                        >
                          {isHovered && (
                            <motion.div
                              className="absolute inset-0"
                              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
                              animate={{ x: ['-100%', '200%'] }}
                              transition={{ repeat: Infinity, duration: 1.2 }}
                            />
                          )}
                        </motion.div>
                      </div>
                      <AnimatePresence>
                        {i > 0 && dropOff > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs mt-1 flex items-center gap-1 ps-9"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">↓ {dropOff}% drop</span>
                            <span className="text-gray-400">vs. previous stage</span>
                          </motion.div>
                        )}
                        {i > 0 && dropOff === 0 && (
                          <p className="text-xs text-emerald-600 mt-1 ps-9 font-medium flex items-center gap-1">
                            ✓ No drop-off from previous stage
                          </p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {/* Donut: stage distribution */}
                {funnel.some(f => f.deal_count > 0) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-6 pt-6 border-t border-gray-100"
                  >
                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FireIcon className="w-4 h-4 text-orange-500" />
                      Stage Distribution
                    </p>
                    <div style={{ width: '100%', height: 240 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={funnel.filter(f => f.deal_count > 0).map((f, idx) => ({
                              name: f.name_ar || f.name, value: f.deal_count,
                            }))}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={4}
                          >
                            {funnel.filter(f => f.deal_count > 0).map((entry, idx) => (
                              <Cell key={idx} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} stroke="white" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
            )}
          </motion.div>
        )}

        {/* ═══ Leaderboard ═══ */}
        {activeTab === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rank list */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/40 to-orange-200/40 rounded-full blur-2xl -mr-12 -mt-12" />
                <div className="flex items-center gap-2 mb-5 relative">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow">
                    <TrophyIcon className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900">{t('reports.leaderboard')}</h2>
                </div>
                {leaderboardBarData.length > 0 ? (
                  <div className="space-y-2 relative">
                    {leaderboard.map((item, i) => {
                      const maxTotal = Math.max(...leaderboard.map(l => l.total_activities));
                      const pct = maxTotal > 0 ? (item.total_activities / maxTotal) * 100 : 0;
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                      const ringColor = i === 0 ? 'ring-amber-300' : i === 1 ? 'ring-gray-300' : i === 2 ? 'ring-orange-300' : 'ring-transparent';
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -25 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07, type: 'spring', stiffness: 200 }}
                          whileHover={{ scale: 1.03 }}
                          className={`relative flex items-center gap-3 p-3 rounded-xl ring-2 ${ringColor} ${
                            i === 0 ? 'bg-gradient-to-r from-amber-50 to-orange-50' : 'bg-gray-50'
                          } transition-colors`}
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 shadow-sm bg-white">
                            {medal || <span className="text-gray-500">{i + 1}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{item.first_name} {item.last_name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-2.5 flex-wrap mt-0.5">
                              <span className="flex items-center gap-0.5 text-blue-600"><PhoneIcon className="w-3 h-3" />{item.calls}</span>
                              <span className="flex items-center gap-0.5 text-purple-600"><EnvelopeIcon className="w-3 h-3" />{item.emails}</span>
                              <span className="flex items-center gap-0.5 text-emerald-600"><CalendarIcon className="w-3 h-3" />{item.meetings}</span>
                              <span className="flex items-center gap-0.5 text-cyan-600"><ChatBubbleLeftIcon className="w-3 h-3" />{item.whatsapps}</span>
                            </p>
                          </div>
                          <div className="w-20">
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: 'linear-gradient(90deg, #F59E0B, #F97316)' }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                          <motion.span
                            className="text-base font-bold text-gray-900 tabular-nums"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.07 + 0.3 }}
                          >
                            {item.total_activities}
                          </motion.span>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
                )}
              </div>

              {/* Stacked bar chart */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Activity Breakdown</h2>
                <p className="text-sm text-gray-500 mb-5">Calls · Emails · Meetings · WhatsApp per rep</p>
                {leaderboardBarData.length > 0 ? (
                  <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer>
                      <BarChart data={leaderboardBarData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
                          cursor={{ fill: '#F9FAFB' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                        <Bar dataKey="calls" name={t('reports.calls')} stackId="a" fill={ACTIVITY_COLORS.calls} />
                        <Bar dataKey="emails" name={t('reports.emails')} stackId="a" fill={ACTIVITY_COLORS.emails} />
                        <Bar dataKey="meetings" name={t('reports.meetings')} stackId="a" fill={ACTIVITY_COLORS.meetings} />
                        <Bar dataKey="whatsapps" name="WhatsApp" stackId="a" fill={ACTIVITY_COLORS.whatsapps} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">{t('app.noData')}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ Lost Deal Analysis ═══ */}
        {activeTab === 'lost' && (
          <motion.div
            key="lost"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Donut */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-rose-200/40 to-red-200/40 rounded-full blur-2xl -ml-12 -mt-12" />
              <div className="flex items-center gap-2 mb-4 relative">
                <div className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 shadow">
                  <XCircleIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Loss Reason Distribution</h2>
              </div>
              {lostPieData.length > 0 ? (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={lostPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={4}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {lostPieData.map((entry, idx) => (
                          <Cell key={idx} fill={LOST_COLORS[idx % LOST_COLORS.length]} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', fontSize: 13 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <XCircleIcon className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">No lost deals to analyze 🎉</p>
                </div>
              )}
            </div>

            {/* Breakdown bars */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Loss Reason Breakdown</h2>
              <p className="text-sm text-gray-500 mb-5">Why deals fall through</p>
              {lostReasons.length > 0 ? (
                <div className="space-y-4">
                  {lostReasons.map(([reason, count], i) => {
                    const maxReason = lostReasons[0][1];
                    const pct = maxReason > 0 ? Math.round((count / maxReason) * 100) : 0;
                    const sharePct = totalLost > 0 ? Math.round((count / totalLost) * 100) : 0;
                    const color = LOST_COLORS[i % LOST_COLORS.length];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 25 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <div className="flex items-center justify-between text-sm mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ background: color }} />
                            <span className="text-gray-700 font-medium">{reason}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm" style={{ background: color }}>
                              {count}
                            </span>
                            <span className="text-xs text-gray-400">{sharePct}%</span>
                          </div>
                        </div>
                        <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full relative overflow-hidden"
                            style={{ background: `linear-gradient(90deg, ${color}aa 0%, ${color} 100%)` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                  <p className="text-sm">No lost deals to analyze 🎉</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <motion.p variants={cardVariants} className="text-center text-xs text-gray-400 pt-2">
        Data refreshes in real-time · Click tabs to explore insights
      </motion.p>
    </motion.div>
  );
};

export default ReportsPage;