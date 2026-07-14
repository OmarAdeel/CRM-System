import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  BellIcon,
  LanguageIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  CheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { notificationsAPI } from '../../services/api';
import socket from '../../services/socket';
import toast from 'react-hot-toast';

const Header = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  const loadNotifications = async (onlyUnread = false) => {
    try {
      setLoadingNotifs(true);
      const res = await notificationsAPI.getAll(onlyUnread ? { unread: 1 } : undefined);
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      // silent — avoid toast spam on every render
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Load initially and whenever refreshKey triggers
  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user, refreshKey]);

  // Subscribe to socket 'notification' events for live refresh
  useEffect(() => {
    if (!user) return;
    const unsub1 = socket.subscribe('notification', () => {
      setRefreshKey((k) => k + 1);
    });
    const unsub2 = socket.subscribe('deal:created', () => {
      setRefreshKey((k) => k + 1);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  // Close any menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/contacts?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleMarkRead = async (id, link) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (link) {
        setShowNotifMenu(false);
        navigate(link);
      }
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      toast.success(t('common.success'));
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationsAPI.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshCount();
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const refreshCount = async () => {
    try {
      const res = await notificationsAPI.getUnreadCount();
      setUnreadCount(res.data.unread_count || 0);
    } catch (_) {}
  };

  const formatTimeAgo = (dateStr) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const typeColor = (type) => {
    switch (type) {
      case 'success': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'error': return 'bg-red-500';
      case 'deal': return 'bg-blue-500';
      case 'ai': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('app.search')}
              className="w-full ps-10 pe-4 py-2 rounded-lg border border-gray-300 text-sm
                         placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                         bg-gray-50 hover:bg-white transition-colors"
            />
          </div>
        </form>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title={t('settings.changeLanguage')}
          >
            <LanguageIcon className="w-5 h-5" />
            <span className="sr-only">{t('settings.changeLanguage')}</span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => {
                setShowNotifMenu((s) => !s);
                if (!showNotifMenu) loadNotifications();
              }}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative"
              title={t('app.notifications') || 'Notifications'}
              aria-label="Notifications"
            >
              <BellIcon className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifMenu && (
              <div className="absolute end-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-50 flex flex-col max-h-[28rem]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">
                    {t('app.notifications') || 'Notifications'}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      <CheckIcon className="w-3.5 h-3.5" />
                      {t('common.markAllRead') || 'Mark all read'}
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                  {loadingNotifs ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                      <BellIcon className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">{t('app.noNotifications') || 'No notifications'}</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleMarkRead(n.id, n.link)}
                        className={`w-full text-start flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors group ${
                          !n.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${typeColor(n.type)}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-gray-400 mt-1">{formatTimeAgo(n.created_at)}</p>
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                        )}
                        <span
                          onClick={(e) => handleDelete(n.id, e)}
                          role="button"
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
                          title={t('common.delete') || 'Delete'}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">
                {user?.first_name}
              </span>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute end-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
                  <span className="inline-block mt-1.5 badge badge-blue text-xs">
                    {user?.role}
                  </span>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <UserCircleIcon className="w-4 h-4" />
                  {t('settings.profile')}
                </Link>
                <button
                  onClick={() => { logout(); setShowUserMenu(false); }}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  {t('auth.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;