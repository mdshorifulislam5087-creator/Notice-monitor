/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ExternalLink, Search, Clock, CheckCircle2, ShieldAlert, ArrowRight, Bell,
  Plus, Sparkles, Check, ChevronDown, ChevronUp, AlertCircle, Mail, Globe
} from 'lucide-react';
import { Language, WebsitePublic, PageView, WebsiteCategory } from '../types.js';
import { translations } from '../translations.js';

interface WebsiteDirectoryProps {
  lang: Language;
  websites: WebsitePublic[];
  setCurrentPage: (page: PageView) => void;
  onSelectForSubscription?: (websiteId: string) => void;
  onWebsiteAdded?: () => void;
}

interface ScrapedPreviewItem {
  title: string;
  link: string;
  publishDate?: string;
}

export const WebsiteDirectory: React.FC<WebsiteDirectoryProps> = ({
  lang,
  websites,
  setCurrentPage,
  onSelectForSubscription,
  onWebsiteAdded
}) => {
  const t = translations[lang];
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Custom Website Modal States
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<WebsiteCategory>('college');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [email, setEmail] = useState('');
  const [ownershipToken, setOwnershipToken] = useState('');
  const [isJsHeavy, setIsJsHeavy] = useState(false);

  // Manual selector & testing
  const [showAdvancedSelector, setShowAdvancedSelector] = useState(false);
  const [manualSelector, setManualSelector] = useState('');
  const [detectedSelector, setDetectedSelector] = useState<string | null>(null);

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    notices: ScrapedPreviewItem[];
    totalFound: number;
    error?: string;
    tips?: string[];
  } | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: t.catAll },
    { id: 'board', label: t.catBoard },
    { id: 'university', label: t.catUniversity },
    { id: 'college', label: t.catCollege },
    { id: 'government', label: t.catGovernment },
    { id: 'public_service', label: t.catPublicService },
    { id: 'other', label: t.catOther }
  ];

  const filtered = websites.filter(site => {
    const matchesCat = selectedCategory === 'all' || site.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      site.name.toLowerCase().includes(q) ||
      site.nameBn.toLowerCase().includes(q) ||
      site.url.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'board':
        return { label: t.catBoard, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'university':
        return { label: t.catUniversity, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'college':
        return { label: t.catCollege, color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      case 'government':
        return { label: t.catGovernment, color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' };
      case 'public_service':
        return { label: t.catPublicService, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      default:
        return { label: t.catOther || cat, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  const formatInterval = (mins: number) => {
    if (mins === 15) return lang === 'bn' ? 'প্রতি ১৫ মিনিট' : 'Every 15 min';
    if (mins === 60) return lang === 'bn' ? 'প্রতি ১ ঘণ্টা' : 'Every 1 hr';
    if (mins === 360) return lang === 'bn' ? 'প্রতি ৬ ঘণ্টা' : 'Every 6 hrs';
    return `${mins} ${lang === 'bn' ? 'মিনিট' : 'min'}`;
  };

  const handleTestWebsite = async () => {
    if (!url.trim()) {
      setTestResult({
        success: false,
        notices: [],
        totalFound: 0,
        error: lang === 'bn' ? 'অনুগ্রহ করে ওয়েবসাইটের URL প্রদান করুন' : 'Please provide website URL first'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/websites/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          selector: manualSelector.trim() || undefined,
          isJsHeavy
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Test request failed');
      }

      setTestResult({
        success: data.success,
        notices: data.notices || [],
        totalFound: data.totalFound || 0,
        error: data.error,
        tips: data.tips
      });

      if (data.selector) {
        setDetectedSelector(data.selector);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        notices: [],
        totalFound: 0,
        error: err.message || 'Failed to reach website'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCustomWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!name.trim() || !url.trim() || !email.trim()) {
      setSaveError(lang === 'bn' ? 'নাম, URL এবং ইমেইল প্রদান করা আবশ্যক' : 'Name, URL, and Email are required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/websites/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nameBn: nameBn.trim() || name.trim(),
          url: url.trim(),
          category,
          intervalMinutes,
          email: email.trim(),
          ownershipToken: ownershipToken.trim() || undefined,
          selector: manualSelector.trim() || detectedSelector || undefined,
          isJsHeavy
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add custom website');
      }

      setSaveSuccessMsg(data.message || t.customSuccessNotice);
      setTimeout(() => {
        setShowCustomModal(false);
        setSaveSuccessMsg(null);
        setName('');
        setNameBn('');
        setUrl('');
        setManualSelector('');
        setOwnershipToken('');
        setDetectedSelector(null);
        setTestResult(null);
        if (onWebsiteAdded) onWebsiteAdded();
      }, 2500);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="py-14 sm:py-20 bg-slate-50/50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t.supportedTitle}
            </h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              {t.supportedSubtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.searchWebsitePlaceholder}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Prominent "+ নতুন ওয়েবসাইট যোগ করুন" Button */}
            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all cursor-pointer text-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t.btnAddCustomSite}</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Websites Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(site => {
            const badge = getCategoryBadge(site.category);
            return (
              <div
                key={site.id}
                className="flex flex-col justify-between p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                      {site.isCustom && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          <Sparkles className="w-3 h-3 text-purple-600" />
                          <span>{t.customBadge}</span>
                        </span>
                      )}
                    </div>

                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      {t.statusLive}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mb-1">
                    {lang === 'bn' ? site.nameBn : site.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    {lang === 'bn' ? site.name : site.nameBn}
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {t.checkInterval}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatInterval(site.intervalMinutes)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>{t.statNotices}:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {site.totalNoticesFound || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    <span>{t.visitOriginal}</span>
                  </a>

                  <button
                    onClick={() => {
                      if (onSelectForSubscription) {
                        onSelectForSubscription(site.id);
                      }
                      setCurrentPage('subscribe');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'সাবস্ক্রাইব করুন' : 'Follow'}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Dashed "Add your college" Card */}
          <div
            onClick={() => setShowCustomModal(true)}
            className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-emerald-400/80 dark:border-emerald-600/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-500 cursor-pointer transition-all duration-200 text-center min-h-[220px] group select-none shadow-xs"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 shadow-md transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              {t.cardAddCollegeTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-3">
              {t.cardAddCollegeDesc}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">
              {t.cardAddCollegeBtn}
            </span>
          </div>
        </div>

        {/* Big Bottom Banner */}
        <div className="mt-14 p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-700/20 text-center relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
              {lang === 'bn'
                ? 'একটি জরুরি নোটিশও আর মিস করতে চান না?'
                : 'Never miss an urgent academic circular again'}
            </h3>
            <p className="text-emerald-100 text-sm sm:text-base mb-6">
              {lang === 'bn'
                ? 'এখনই আপনার পছন্দের প্রতিষ্ঠানগুলো সিলেক্ট করে ফ্রি ইমেইল নোটিফিকেশন সেট করুন।'
                : 'Subscribe in 30 seconds for free email notifications.'}
            </p>
            <button
              onClick={() => setCurrentPage('subscribe')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-emerald-900 bg-amber-400 hover:bg-amber-300 shadow-md transition-all active:scale-95 cursor-pointer text-base sm:text-lg"
            >
              <Bell className="w-5 h-5" />
              <span>{t.ctaSubscribe}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOM WEBSITE MODAL */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'স্বয়ংক্রিয় রোবটিক ডিটেকশন' : 'Auto-detect AI Heuristics'}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t.modalCustomTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.modalCustomSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Success Message Banner */}
            {saveSuccessMsg && (
              <div className="p-4 mb-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Error Message Banner */}
            {saveError && (
              <div className="p-4 mb-5 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCustomWebsite} className="space-y-5">
              {/* URL with Test & Preview Button */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  {t.fieldSiteUrl} <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={e => {
                        setUrl(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder={t.fieldSiteUrlPlaceholder}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleTestWebsite}
                    disabled={isTesting || !url}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-40 cursor-pointer shrink-0 transition-colors shadow-xs"
                  >
                    {isTesting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>{t.btnTesting}</span>
                      </span>
                    ) : (
                      <span>{t.btnTestPreview}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* TEST RESULTS PREVIEW SECTION */}
              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs transition-all ${
                  testResult.success
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}>
                  {testResult.success ? (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 font-bold">
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {t.testSuccessTitle}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 font-bold">
                          {testResult.totalFound} {lang === 'bn' ? 'টি নোটিশ পাওয়া গেছে' : 'notices found'}
                        </span>
                      </div>

                      {detectedSelector && (
                        <div className="mb-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
                          {t.testDetectedSelector} <span className="font-bold text-emerald-700 dark:text-emerald-300">{detectedSelector}</span>
                        </div>
                      )}

                      <div className="space-y-1.5 mt-2">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                          {t.testPreviewNotices}
                        </span>
                        {testResult.notices.map((n, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-900/60">
                            <span className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1">
                              {idx + 1}. {n.title}
                            </span>
                            <a
                              href={n.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 text-[11px] font-semibold"
                            >
                              Open ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{testResult.error || t.testErrorTitle}</span>
                      </div>
                      {testResult.tips && testResult.tips.length > 0 && (
                        <div className="mt-2 space-y-1 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold block">{t.testErrorTipsTitle}</span>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                            {testResult.tips.map((tip, idx) => (
                              <li key={idx}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Institution Names (Bangla + English) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.fieldSiteName} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={t.fieldSiteNamePlaceholder}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'bn' ? 'বাংলায় নাম (ঐচ্ছিক)' : 'Bangla Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={e => setNameBn(e.target.value)}
                    placeholder="যেমন: ঢাকা কলেজ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Category & Interval */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.adminFieldCategory}
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as WebsiteCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="college">{t.catCollege}</option>
                    <option value="university">{t.catUniversity}</option>
                    <option value="board">{t.catBoard}</option>
                    <option value="government">{t.catGovernment}</option>
                    <option value="other">{t.catOther}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.adminFieldInterval}
                  </label>
                  <select
                    value={intervalMinutes}
                    onChange={e => setIntervalMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value={15}>{t.adminInterval15}</option>
                    <option value={60}>{t.adminInterval60}</option>
                    <option value={360}>{t.adminInterval360}</option>
                  </select>
                </div>
              </div>

              {/* User Subscription Info */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-emerald-600" />
                  <span>{lang === 'bn' ? 'অ্যালার্ট পাওয়ার জন্য আপনার তথ্য (স্বয়ংক্রিয় সাবস্ক্রিপশন)' : 'Your info for automated alerts'}</span>
                </span>

                <div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t.subEmailLabel} *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t.subEmailPlaceholder}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {lang === 'bn' ? 'ম্যানেজমেন্ট টোকেন (আগের সাবস্ক্রিপশন আপডেট হলে)' : 'Management token (when updating an existing subscription)'}
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={ownershipToken}
                    onChange={e => setOwnershipToken(e.target.value)}
                    placeholder={lang === 'bn' ? 'স্বাগতম/অ্যালার্ট ইমেইলের টোকেন' : 'Token from your welcome/alert email'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Collapsed Advanced Selector Option */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSelector(!showAdvancedSelector)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  {showAdvancedSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>{t.advancedSelectorToggle}</span>
                </button>

                {showAdvancedSelector && (
                  <div className="mt-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.adminFieldSelector}
                      </label>
                      <input
                        type="text"
                        value={manualSelector}
                        onChange={e => setManualSelector(e.target.value)}
                        placeholder="table tr td a, .notices a, #noticelist a"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        {t.adminFieldSelectorHint}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={isJsHeavy}
                        onChange={e => setIsJsHeavy(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span>{t.adminFieldJsHeavy}</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  {t.adminCancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? t.savingCustom : t.btnSaveAndSubscribe}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
