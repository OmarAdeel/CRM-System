import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PhoneIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  EllipsisVerticalIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { whatsappAPI, contactsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────
const timeLabel = (iso, t) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;
  if (sameDay) return time;
  if (isYest) return t('messages.yesterday');
  return d.toLocaleDateString();
};

const fullDirection = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / (1000 * 60 * 60 * 24);
  if (diff < 1) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString();
};

const MessagesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAr = (user?.language || 'en') === 'ar';

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const scrollRef = useRef(null);
  const listEndRef = useRef(null);

  // Localised display name for a contact row
  const contactName = useCallback((c) => {
    if (!c) return '';
    if (isAr) {
      const ar = [c.first_name_ar, c.last_name_ar].filter(Boolean).join(' ');
      if (ar) return ar;
    }
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone || (t('messages.noPhone'));
  }, [isAr, t]);

  const companyName = useCallback((c) => {
    if (!c) return '';
    return isAr ? (c.company_name_ar || c.company_name) : (c.company_name || c.company_name_ar);
  }, [isAr]);

  // ─── Load conversation list ───
  const loadConversations = useCallback(async () => {
    try {
      const res = await whatsappAPI.getConversations();
      const list = res.data?.data || [];
      setConversations(list);
      return list;
    } catch (err) {
      console.error('loadConversations error:', err);
      toast.error(t('common.error'));
      return [];
    }
  }, [t]);

  // ─── Load messages for a conversation ───
  const loadMessages = useCallback(async (contactId) => {
    try {
      const res = await whatsappAPI.getHistory(contactId);
      setMessages(res.data?.data || []);
      // mark inbound as read
      whatsappAPI.markRead(contactId).catch(() => {});
      // refresh unread counts in the list (best-effort)
      setConversations((prev) => prev.map((c) =>
        c.contact_id === contactId ? { ...c, unread: 0 } : c
      ));
    } catch (err) {
      console.error('loadMessages error:', err);
      setMessages([]);
    }
  }, []);

  // ─── Initial load ───
  useEffect(() => {
    (async () => {
      const list = await loadConversations();
      setLoading(false);
      if (list.length > 0) {
        // pick the most recent conversation by default
        const first = list[0];
        setActiveId(first.contact_id);
        setActiveConv(first);
        loadMessages(first.contact_id);
      }
    })();
  }, []);

  // ─── Search: type-ahead across all contacts ───
  useEffect(() => {
    if (!search.trim()) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await contactsAPI.getAll({ search: search.trim(), limit: 20 });
        if (!cancelled) setSearchHits(res.data?.data || []);
      } catch (e) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [search]);

  // ─── Socket.io live updates ───
  useEffect(() => {
    const onReceived = (data) => {
      const cid = Number(data?.contactId);
      if (!cid) return;
      // If active conversation, append the message locally
      if (cid === activeId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `in_${Date.now()}`,
            to_number: data.from || '',
            message: data.body,
            direction: 'inbound',
            status: 'read',
            created_at: new Date().toISOString(),
          },
        ]);
        whatsappAPI.markRead(cid).catch(() => {});
      } else {
        const conv = conversations.find((c) => c.contact_id === cid);
        const who = conv ? contactName(conv) : (data.from || 'New message');
        toast(`${who}: ${data.body}`, { icon: '💬' });
      }
      // Move/refresh conversation list
      loadConversations();
    };
    const onSent = (data) => {
      const cid = Number(data?.contactId);
      if (cid && cid === activeId) {
        setMessages((prev) => [
          ...prev,
          {
            id: `out_${Date.now()}`,
            to_number: data.to || '',
            message: data.body,
            direction: 'outbound',
            status: 'sent',
            created_at: new Date().toISOString(),
          },
        ]);
      }
      loadConversations();
    };
    const unsub1 = socket.subscribe('whatsapp:received', onReceived);
    const unsub2 = socket.subscribe('whatsapp:sent', onSent);
    return () => { unsub1(); unsub2(); };
  }, [activeId, contactName, loadConversations]);

  // ─── Auto-scroll to the latest message ───
  useEffect(() => {
    if (listEndRef.current) listEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Select a conversation ───
  const selectConversation = (conv) => {
    setActiveId(conv.contact_id);
    setActiveConv(conv);
    setShowSearch(false);
    setSearch('');
    loadMessages(conv.contact_id);
  };

  // ─── Start a new conversation from search ───
  const startNewConversation = async (contact) => {
    // Upsert: create the conversation thread by selecting it; if it already
    // exists in the list, just select it.
    const existing = conversations.find((c) => c.contact_id === contact.id);
    if (existing) {
      selectConversation(existing);
      return;
    }
    const conv = {
      contact_id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      first_name_ar: contact.first_name_ar,
      last_name_ar: contact.last_name_ar,
      phone: contact.phone,
      email: contact.email,
      company_name: contact.company_name,
      company_name_ar: contact.company_name_ar,
      last_message: '',
      last_direction: null,
      last_at: null,
      total_messages: 0,
      inbound_count: 0,
      unread: 0,
    };
    setConversations((prev) => [conv, ...prev]);
    selectConversation(conv);
  };

  // ─── Send a message ───
  const sendMessage = async () => {
    if (!draft.trim() || !activeConv || !activeConv.phone) return;
    const text = draft.trim();
    setDraft('');
    setSending(true);
    // Optimistic append
    const tempId = `out_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, to_number: activeConv.phone, message: text, direction: 'outbound', status: 'sent', created_at: new Date().toISOString() },
    ]);
    try {
      await whatsappAPI.send({
        to: activeConv.phone,
        message: text,
        contact_id: activeConv.contact_id,
      });
      toast.success(t('messages.messageSent'));
      loadConversations();
    } catch (err) {
      console.error('send error:', err);
      toast.error(t('messages.errorSending'));
      // roll back the optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // ─── Simulate an inbound reply (free dev-mode demo) ───
  const simulateReply = async () => {
    if (!activeConv) return;
    const text = draft.trim() || (isAr
      ? 'شكراً، تم استلام رسالتك. سأعود إليك قريباً.'
      : 'Thanks, I got your message — I will get back to you shortly.');
    setSimulating(true);
    try {
      await whatsappAPI.simulateInbound({ contact_id: activeConv.contact_id, message: text });
      toast.success(t('messages.replySimulated'));
      setDraft('');
    } catch (err) {
      console.error('simulate error:', err);
      toast.error(t('messages.errorSimulating'));
    } finally {
      setSimulating(false);
    }
  };

  // ─── Key handler: Enter to send, Shift+Enter for newline ───
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent" />
        <p className="text-sm text-gray-400">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-9rem)]">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-5 shadow-lg mb-4"
        style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 60%, #065F46 100%)' }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-teal-300/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20">
              <ChatBubbleLeftRightIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {t('messages.title')}
                <SparklesIcon className="w-5 h-5 text-emerald-200" />
              </h1>
              <p className="text-xs text-white/75 mt-0.5">{t('messages.subtitle')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-medium text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            {t('messages.devModeBadge')}
          </span>
        </div>
      </motion.div>

      {/* ─── Chat container ─── */}
      <div className="flex-1 flex overflow-hidden rounded-2xl shadow-xl border border-gray-200 bg-white min-h-0">
        {/* ═══ Conversations list (start side) ═══ */}
        <aside
          className={`${activeId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-e border-gray-200 bg-gray-50/60 min-h-0`}
        >
          {/* Search */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                placeholder={t('messages.search')}
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
              />
            </div>
            <AnimatePresence>
              {showSearch && search.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-2 max-h-72 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-lg"
                >
                  {searchHits.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-400">{t('messages.selectContact')}</p>
                  ) : (
                    searchHits.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={() => startNewConversation(c)}
                        className="w-full text-start px-3 py-2 flex items-center gap-2 hover:bg-emerald-50 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(c.first_name?.[0] || '')}{(c.last_name?.[0] || '')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{contactName(c)}</p>
                          <p className="text-xs text-gray-500 truncate">{c.phone || t('messages.noPhone')}</p>
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto" ref={scrollRef}>
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8 text-gray-400">
                <ChatBubbleLeftRightIcon className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">{t('messages.noConversations')}</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.contact_id === activeId;
                return (
                  <button
                    key={conv.contact_id || conv.phone}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-start px-3 py-3 flex items-start gap-3 border-b border-gray-100 transition-colors ${
                      isActive ? 'bg-emerald-100/60' : 'hover:bg-white'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-sm font-bold">
                        {contactName(conv)?.[0]?.toUpperCase() || '?'}
                      </div>
                      {conv.unread > 0 && (
                        <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    {/* Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{contactName(conv)}</p>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{timeLabel(conv.last_at, t)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${conv.last_direction === 'inbound' ? 'text-gray-700' : 'text-gray-500'}`}>
                        {conv.last_direction === 'outbound' ? '↗ ' : ''}
                        {conv.last_message || t('messages.created')}
                      </p>
                      {companyName(conv) && (
                        <p className="text-[11px] text-emerald-700 mt-1 truncate">{companyName(conv)}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ═══ Chat panel (end side) ═══ */}
        <section
          className={`${activeId ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}
          style={{ background: 'linear-gradient(180deg, #ECE5DD 0%, #E8E0D5 100%)' }}
        >
          {activeConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                <button
                  onClick={() => { setActiveId(null); setActiveConv(null); setMessages([]); }}
                  className="md:hidden p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
                  aria-label="back"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {contactName(activeConv)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{contactName(activeConv)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {activeConv.phone || t('messages.noPhone')}
                    {activeConv.email ? ` · ${activeConv.email}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/contacts/${activeConv.contact_id}`)}
                  className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                  title={t('messages.viewContact')}
                >
                  <UserCircleIcon className="w-5 h-5" />
                </button>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />{t('messages.online')}
                </span>
              </div>

              {/* Messages scroll area */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 min-h-0" ref={scrollRef}>
                <div className="max-w-2xl mx-auto space-y-2">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 py-12">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 mb-3 opacity-40" />
                      <p className="text-sm">{t('messages.noConversationSelected')}</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const outbound = m.direction === 'outbound';
                      const prev = messages[idx - 1];
                      const showStamp = !prev || new Date(m.created_at).toDateString() !== new Date(prev.created_at).toDateString();
                      return (
                        <React.Fragment key={m.id || idx}>
                          {showStamp && (
                            <div className="flex justify-center my-2">
                              <span className="px-3 py-1 rounded-full bg-white/80 text-[11px] text-gray-500 shadow-sm">
                                {fullDirection(m.created_at)}
                              </span>
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.18 }}
                            className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`relative max-w-[80%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-line break-words ${
                                outbound
                                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-br-md'
                                  : 'bg-white text-gray-800 rounded-bl-md'
                              }`}
                            >
                              {m.message}
                              <span className={`block text-[10px] mt-1 ${outbound ? 'text-white/70 text-end' : 'text-gray-400 text-start'}`}>
                                {fullDirection(m.created_at)}
                                {outbound && m.status === 'dev' && ' · dev'}
                                {outbound && m.status === 'sent' && ' · ✓'}
                              </span>
                            </div>
                          </motion.div>
                        </React.Fragment>
                      );
                    })
                  )}
                  <div ref={listEndRef} />
                </div>
              </div>

              {/* Composer */}
              <div className="px-3 sm:px-6 py-3 bg-white border-t border-gray-200">
                <div className="max-w-2xl mx-auto flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    placeholder={t('messages.typeMessage')}
                    className="flex-1 resize-none px-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 text-sm max-h-32"
                    style={{ minHeight: '42px' }}
                  />
                  <motion.button
                    onClick={simulateReply}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    disabled={simulating || !activeConv}
                    title={t('messages.simulateReply')}
                    className="flex-shrink-0 p-2.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
                  >
                    <SparklesIcon className={`w-5 h-5 ${simulating ? 'animate-spin' : ''}`} />
                  </motion.button>
                  <motion.button
                    onClick={sendMessage}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    disabled={sending || !draft.trim()}
                    title={t('messages.send')}
                    className="flex-shrink-0 p-2.5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 transition-all"
                  >
                    <PaperAirplaneIcon className="w-5 h-5 rotate-90" />
                  </motion.button>
                </div>
                <p className="mt-1.5 text-center text-[11px] text-gray-400">
                  ✨ {t('messages.simulateReply')} · ➤ {t('messages.send')}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 text-gray-500">
              <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-sm">{t('messages.noConversationSelected')}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesPage;