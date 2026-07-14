import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  BanknotesIcon,
  ArrowsRightLeftIcon,
  ClockIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  BoltIcon,
  ArrowUpTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);

  // Keep collapsed state aligned with viewport on resize,
  // but always start collapsed unless the user explicitly expands.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setCollapsed(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navItems = [
    { path: '/dashboard', icon: HomeIcon, label: t('navigation.dashboard') },
    { path: '/contacts', icon: UsersIcon, label: t('navigation.contacts') },
    { path: '/companies', icon: BuildingOfficeIcon, label: t('navigation.companies') },
    { path: '/deals', icon: BanknotesIcon, label: t('navigation.deals') },
    { path: '/pipeline', icon: ArrowsRightLeftIcon, label: t('navigation.pipeline') },
    { path: '/activities', icon: ClockIcon, label: t('navigation.activities') },
    { path: '/reports', icon: ChartBarIcon, label: t('navigation.reports') },
  ];

  const toolItems = [
    { path: '/templates', icon: DocumentTextIcon, label: t('navigation.templates') },
    { path: '/automations', icon: BoltIcon, label: t('navigation.automations') },
    { path: '/import-export', icon: ArrowUpTrayIcon, label: t('navigation.importExport') },
  ];

  const adminItems = [
    { path: '/settings', icon: Cog6ToothIcon, label: t('navigation.settings') },
    { path: '/admin', icon: ShieldCheckIcon, label: t('navigation.admin'), roles: ['admin', 'manager'] },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (path) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
    ${isActive(path)
      ? 'bg-blue-50 text-blue-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    } ${collapsed ? 'justify-center' : ''}`;

  return (
    <aside
      className={`fixed inset-y-0 start-0 z-30 flex flex-col bg-white border-e border-gray-200
        transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b border-gray-200 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">CR</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-gray-900 text-lg">{t('app.title')}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main Nav */}
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navLinkClass(item.path)}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-gray-200" />

        {/* Tools */}
        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Tools
          </p>
        )}
        <div className="space-y-0.5">
          {toolItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navLinkClass(item.path)}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-gray-200" />

        {/* Admin / Settings */}
        <div className="space-y-0.5">
          {adminItems.map((item) => {
            if (item.roles && !item.roles.includes(user?.role)) return null;
            return (
              <NavLink key={item.path} to={item.path} className={navLinkClass(item.path)}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -end-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center
                   text-gray-400 hover:text-gray-600 shadow-sm"
      >
        {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronLeftIcon className="w-3 h-3" />}
      </button>

      {/* User info at bottom */}
      {!collapsed && (
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-semibold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
