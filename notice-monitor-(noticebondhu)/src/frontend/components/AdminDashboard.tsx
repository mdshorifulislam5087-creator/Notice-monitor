/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield, Key, Plus, Trash2, Edit, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Play, Clock, Globe, ListFilter, Users, Zap, Check, Eye
} from 'lucide-react';
import {
  Language, WebsiteAdmin, SystemStats, CheckLogItem, AlertLogItem, SubscriberItem, WebsiteCategory
} from '../types.js';
import { translations } from '../translations.js';

interface AdminDashboardProps {
  lang: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang }) => {
  const t = translations[lang];

  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'websites' | 'logs' | 'subscribers' | 'testing'>('websites');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [websites, setWebsites] = useState<WebsiteAdmin[]>([]);
  const [checkLogs, setCheckLogs] = useState<CheckLogItem[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLogItem[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Edit / Add Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameBn: '',
    url: '',
    selector: '',
    category: 'board' as WebsiteCategory,
    intervalMinutes: 60,
    enabled: true,
    isJsHeavy: false
  });

  // Testing & Simulation states
  const [simWebsiteId, setSimWebsiteId] = useState('');
  const [simTitle, setSimTitle] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setToken('cookie-session');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setPassword('');
  };

  const [settings, setSettings] = useState<{ requireCustomApproval: boolean }>({ requireCustomApproval: false });
  const [siteFilter, setSiteFilter] = useState<'all' | 'custom' | 'pending'>('all');

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [resStats, resWebsites, resLogs, resSubs, resSettings] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/admin/websites'),
        fetch('/api/admin/logs'),
        fetch('/api/admin/subscribers'),
        fetch('/api/admin/settings')
      ]);

      if (resWebsites.status === 401) {
        handleLogout();
        return;
      }

      const statsData = await resStats.json();
      const websitesData = await resWebsites.json();
      const logsData = await resLogs.json();
      const subsData = await resSubs.json();
      const settingsData = await resSettings.json();

      setStats(statsData);
      setWebsites(websitesData);
      setCheckLogs(logsData.checkLogs || []);
      setAlertLogs(logsData.alertLogs || []);
      setSubscribers(subsData || []);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequireApproval = async () => {
    if (!token) return;
    try {
      const newSetting = !settings.requireCustomApproval;
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requireCustomApproval: newSetting })
      });
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        showNotification(
          newSetting
            ? 'কাস্টম সাইটের জন্য এডমিন অনুমোদন বাধ্যতামূলক করা হয়েছে।'
            : 'কাস্টম সাইট এখন যোগ করার সাথে সাথে সরাসরি সক্রিয় হবে।'
        );
      }
    } catch (err: any) {
      showNotification(`Error updating settings: ${err.message}`);
    }
  };

  const handleApproveWebsite = async (id: string, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/websites/${id}/approve`, {
        method: 'PUT',
      });
      if (res.ok) {
        showNotification(`Approved ${name}`);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Error approving: ${err.message}`);
    }
  };

  const handleRejectWebsite = async (id: string, name: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/websites/${id}/reject`, {
        method: 'PUT',
      });
      if (res.ok) {
        showNotification(`Disabled/Rejected ${name}`);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    }
  };

  useEffect(() => {
    fetch('/api/admin/session')
      .then(res => res.json())
      .then(data => setToken(data.authenticated ? 'cookie-session' : null))
      .catch(() => setToken(null));
  }, []);

  useEffect(() => {
    if (token) fetchData();
  }, [token]);

  const showNotification = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleScrapeAll = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scrape-all', {
        method: 'POST',
      });
      const data = await res.json();
      showNotification(`Scrape completed across ${data.results?.length || 0} websites!`);
      await fetchData();
    } catch (err: any) {
      showNotification(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeSite = async (siteId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/websites/${siteId}/check`, {
        method: 'POST',
      });
      const data = await res.json();
      showNotification(
        data.result?.success
          ? `Check success! Found ${data.result.noticesFound} notices (${data.result.newNoticesCount} new).`
          : `Check failed: ${data.result?.error || 'Unknown error'}`
      );
      await fetchData();
    } catch (err: any) {
      showNotification(`Error checking site: ${err.message}`);
    }
  };

  const handleDeleteWebsite = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/websites/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showNotification(`Deleted ${name}`);
        await fetchData();
      }
    } catch (err: any) {
      showNotification(`Error deleting: ${err.message}`);
    }
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setFormData({
      name: '',
      nameBn: '',
      url: '',
      selector: '#noticelist a, table tr td a',
      category: 'board',
      intervalMinutes: 60,
      enabled: true,
      isJsHeavy: false
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (site: WebsiteAdmin) => {
    setModalMode('edit');
    setEditingId(site.id);
    setFormData({
      name: site.name,
      nameBn: site.nameBn,
      url: site.url,
      selector: site.selector,
      category: site.category,
      intervalMinutes: site.intervalMinutes,
      enabled: site.enabled,
      isJsHeavy: !!site.isJsHeavy
    });
    setShowModal(true);
  };

  const handleSaveWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/admin/websites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error);
        }
        showNotification('Website successfully added and queued for monitoring!');
      } else if (editingId) {
        const res = await fetch(`/api/admin/websites/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error);
        }
        showNotification('Website configuration updated!');
      }

      setShowModal(false);
      await fetchData();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleSimulateNotice = async () => {
    if (!token || !simWebsiteId) return;
    try {
      const res = await fetch('/api/admin/simulate-notice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          websiteId: simWebsiteId,
          title: simTitle || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showNotification(`Simulated notice triggered! Alerted ${data.subscribersCount} subscriber(s).`);
      setSimTitle('');
      await fetchData();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    }
  };

  // Login Screen
  if (token === undefined) {
    return <div className="py-20 text-center text-sm text-slate-500">Checking admin session…</div>;
  }

  if (!token) {
    return (
      <div className="py-20 max-w-md mx-auto px-4">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Shield className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
            {t.adminLoginTitle}
          </h2>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {t.adminLoginPrompt}
          </p>

          {authError && (
            <div className="p-3 mb-5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              name="username"
              value="admin"
              autoComplete="username"
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              className="sr-only"
            />
            <div className="text-left">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                {t.adminPasswordLabel}
              </label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md cursor-pointer text-sm"
            >
              {t.adminLoginBtn}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t.adminTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Admin Mode
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t.adminSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
          >
            {t.adminLogoutBtn}
          </button>
        </div>
      </div>

      {/* Floating Action Feedback Notification */}
      {actionFeedback && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Admin Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statSubscribers}</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalSubscribers}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statNotices}</div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalNotices}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statWebsites}</div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.activeWebsites} / {stats.totalWebsites}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.statAlerts}</div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{stats.totalAlertsSent}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 mb-8">
        <button
          onClick={() => setActiveTab('websites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'websites'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t.adminTabWebsites} ({websites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>{t.adminTabStats}</span>
        </button>

        <button
          onClick={() => setActiveTab('subscribers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'subscribers'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t.adminTabSubscribers} ({subscribers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'testing'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{t.adminTabTestAlert}</span>
        </button>
      </div>

      {/* TAB 1: WEBSITES MANAGEMENT */}
      {activeTab === 'websites' && (
        <div className="space-y-6">
          {/* Approval Settings Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                  {t.adminToggleRequireApproval}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {settings.requireCustomApproval
                    ? (lang === 'bn' ? 'সক্রিয়: শিক্ষার্থীরা কাস্টম সাইট যোগ করলে এডমিন অনুমোদনের পর চালু হবে' : 'Active: Custom sites require admin review before going live')
                    : (lang === 'bn' ? 'নিষ্ক্রিয়: শিক্ষার্থীরা কাস্টম সাইট যোগ করলে সরাসরি তাৎক্ষণিক চালু হবে' : 'Inactive: Custom sites go live immediately upon submission')}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleRequireApproval}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                settings.requireCustomApproval
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {settings.requireCustomApproval ? 'ON (সক্রিয়)' : 'OFF (স্বয়ংক্রিয়)'}
            </button>
          </div>

          {/* Action Row & Sub-Filters */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSiteFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  siteFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                All ({websites.length})
              </button>
              <button
                onClick={() => setSiteFilter('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  siteFilter === 'custom'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                }`}
              >
                {t.adminCustomOnly} ({websites.filter(w => w.isCustom).length})
              </button>
              <button
                onClick={() => setSiteFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  siteFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                }`}
              >
                Pending ({websites.filter(w => w.approvalStatus === 'pending').length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenAddModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.adminAddSiteBtn}</span>
              </button>

              <button
                onClick={handleScrapeAll}
                disabled={loading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl font-bold text-slate-800 dark:text-slate-200 bg-amber-400 hover:bg-amber-300 dark:bg-amber-500 shadow-xs cursor-pointer text-xs disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{loading ? t.adminScraping : t.adminScrapeAllBtn}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {websites
              .filter(site => {
                if (siteFilter === 'custom') return site.isCustom;
                if (siteFilter === 'pending') return site.approvalStatus === 'pending';
                return true;
              })
              .map(site => (
              <div
                key={site.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`w-2.5 h-2.5 rounded-full ${site.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {site.nameBn} <span className="text-xs text-slate-400 font-normal">({site.name})</span>
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {site.category}
                    </span>
                    {site.isCustom && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        ✨ {t.customBadge}
                      </span>
                    )}
                    {site.approvalStatus === 'pending' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        ⏳ {t.pendingBadge}
                      </span>
                    )}
                    {site.approvalStatus === 'approved' && site.isCustom && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ {t.approvedBadge}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mb-2 font-mono">
                    {site.url}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                    {site.creatorEmail && (
                      <span className="flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded">
                        <Users className="w-3 h-3" />
                        {t.adminCreatorEmail}: {site.creatorEmail}
                      </span>
                    )}
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      Selector: {site.selector}
                    </span>
                    <span>Interval: {site.intervalMinutes}m</span>
                    <span>Notices: <b>{site.totalNoticesFound || 0}</b></span>
                    {site.lastCheckedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(site.lastCheckedAt).toLocaleTimeString()}
                      </span>
                    )}
                    {site.lastCheckStatus === 'failed' && (
                      <span className="text-rose-600 font-semibold">
                        Error: {site.lastCheckError || 'Failed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 flex-wrap">
                  {/* Approval Actions for Custom Websites */}
                  {site.approvalStatus === 'pending' && (
                    <button
                      onClick={() => handleApproveWebsite(site.id, site.name)}
                      title="Approve this custom website"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.adminApproveBtn}</span>
                    </button>
                  )}

                  {site.isCustom && site.approvalStatus === 'approved' && (
                    <button
                      onClick={() => handleRejectWebsite(site.id, site.name)}
                      title="Disable / Reject this custom website"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      {t.adminRejectBtn}
                    </button>
                  )}

                  <button
                    onClick={() => handleScrapeSite(site.id)}
                    title="Run scrape check right now"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{t.adminRunCheck}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEditModal(site)}
                    title="Edit site"
                    className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteWebsite(site.id, site.name)}
                    title="Delete site"
                    className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-8">
          {/* Check Logs */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              {t.adminLogsCheckTitle}
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3.5">{t.adminLogStatus}</th>
                    <th className="p-3.5">{t.adminLogSite}</th>
                    <th className="p-3.5">{t.adminLogFound}</th>
                    <th className="p-3.5">New</th>
                    <th className="p-3.5">{t.adminLogDuration}</th>
                    <th className="p-3.5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {checkLogs.slice(0, 20).map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 font-bold ${log.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {log.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-medium">{log.websiteName}</td>
                      <td className="p-3.5">{log.noticesFound}</td>
                      <td className="p-3.5 font-bold text-emerald-600">{log.newNoticesCount}</td>
                      <td className="p-3.5 font-mono">{log.durationMs}ms</td>
                      <td className="p-3.5 text-slate-400">{new Date(log.checkedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alert Logs */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
              {t.adminLogsAlertTitle}
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="p-3.5">{t.adminLogChannel}</th>
                    <th className="p-3.5">{t.adminLogRecipient}</th>
                    <th className="p-3.5">Notice Title</th>
                    <th className="p-3.5">{t.adminLogStatus}</th>
                    <th className="p-3.5">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {alertLogs.slice(0, 20).map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold uppercase">{log.channel}</td>
                      <td className="p-3.5 font-mono">{log.subscriberEmail}</td>
                      <td className="p-3.5 max-w-xs truncate">{log.noticeTitle}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                          log.status === 'simulated' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400">{new Date(log.sentAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIBERS */}
      {activeTab === 'subscribers' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Registered Subscribers ({subscribers.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Portals Subscribed</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {subscribers.map(sub => (
                  <tr key={sub.id}>
                    <td className="p-3 font-semibold">{sub.name}</td>
                    <td className="p-3 font-mono">{sub.email}</td>
                    <td className="p-3 font-bold text-emerald-600">{sub.subscribedWebsites.length} portals</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${sub.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {sub.isActive ? 'Active' : 'Unsubscribed'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{new Date(sub.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ALERT TESTING & SIMULATION */}
      {activeTab === 'testing' && (
        <div className="max-w-2xl">
          {/* Simulate Notice */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.adminSimulateNotice}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.adminSimulatePrompt}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Website
              </label>
              <select
                value={simWebsiteId}
                onChange={e => setSimWebsiteId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              >
                <option value="">Select a website to test</option>
                {websites.map(w => (
                  <option key={w.id} value={w.id}>{w.nameBn} ({w.name})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notice Title (Optional)
              </label>
              <input
                type="text"
                value={simTitle}
                onChange={e => setSimTitle(e.target.value)}
                placeholder="[টেস্ট নোটিশ] ২০২৬ সালের জরুরি পরীক্ষার বিজ্ঞপ্তি"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
              />
            </div>

            <button
              onClick={handleSimulateNotice}
              disabled={!simWebsiteId}
              className="w-full py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 cursor-pointer text-xs"
            >
              Trigger Simulated Notice Alert 🚀
            </button>
          </div>

        </div>
      )}

      {/* Website Modal (Add / Edit) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              {modalMode === 'add' ? t.adminSiteFormTitleAdd : t.adminSiteFormTitleEdit}
            </h2>

            <form onSubmit={handleSaveWebsite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.adminFieldName} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Dhaka Education Board"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.adminFieldNameBn} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nameBn}
                  onChange={e => setFormData({ ...formData, nameBn: e.target.value })}
                  placeholder="মাধ্যমিক ও উচ্চমাধ্যমিক শিক্ষা বোর্ড, ঢাকা"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.adminFieldUrl} *
                </label>
                <input
                  type="url"
                  required
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://dhakaeducationboard.gov.bd/"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t.adminFieldSelector} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.selector}
                  onChange={e => setFormData({ ...formData, selector: e.target.value })}
                  placeholder="#noticelist a, .views-field-title a, table tr td a"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  {t.adminFieldSelectorHint}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.adminFieldCategory}
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as WebsiteCategory })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="board">Education Board</option>
                    <option value="university">University</option>
                    <option value="college">College</option>
                    <option value="government">Government / Directorate</option>
                    <option value="public_service">Public Service (BPSC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.adminFieldInterval}
                  </label>
                  <select
                    value={formData.intervalMinutes}
                    onChange={e => setFormData({ ...formData, intervalMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value={15}>15 Minutes</option>
                    <option value={60}>1 Hour</option>
                    <option value={360}>6 Hours</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>{t.adminFieldEnabled}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isJsHeavy}
                    onChange={e => setFormData({ ...formData, isJsHeavy: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>JS Heavy (Playwright Fallback)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  {t.adminCancelBtn}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  {t.adminSaveBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
