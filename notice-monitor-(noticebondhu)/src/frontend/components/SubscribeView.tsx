/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Bell, Mail, CheckCircle2, CheckSquare, Square, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Language, WebsitePublic, PageView } from '../types.js';
import { translations } from '../translations.js';

interface SubscribeViewProps {
  lang: Language;
  websites: WebsitePublic[];
  selectedWebsiteIds: string[];
  setSelectedWebsiteIds: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentPage: (page: PageView) => void;
}

export const SubscribeView: React.FC<SubscribeViewProps> = ({
  lang,
  websites,
  selectedWebsiteIds,
  setSelectedWebsiteIds,
  setCurrentPage
}) => {
  const t = translations[lang];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ownershipToken, setOwnershipToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; email: string; count: number } | null>(null);

  const toggleWebsite = (id: string) => {
    setSelectedWebsiteIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedWebsiteIds(websites.map(w => w.id));
  };

  const handleDeselectAll = () => {
    setSelectedWebsiteIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !email.includes('@')) {
      setErrorMsg(lang === 'bn' ? 'দয়া করে একটি সঠিক ইমেইল এড্রেস প্রদান করুন।' : 'Please enter a valid email address.');
      return;
    }

    if (selectedWebsiteIds.length === 0) {
      setErrorMsg(lang === 'bn' ? 'অনুগ্রহ করে অন্তত একটি ওয়েবসাইট সিলেক্ট করুন।' : 'Please select at least one website to monitor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          websiteIds: selectedWebsiteIds,
          ownershipToken: ownershipToken.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      setIsSuccess(true);
      setSuccessInfo({
        name: name.trim() || (lang === 'bn' ? 'শিক্ষার্থী' : 'Student'),
        email: email.trim(),
        count: selectedWebsiteIds.length
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error subscribing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess && successInfo) {
    return (
      <div className="py-16 sm:py-24 max-w-2xl mx-auto px-4">
        <div className="text-center p-8 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
            {t.subSuccessTitle}
          </h2>

          <p className="text-base text-slate-600 dark:text-slate-300 mb-6">
            {t.subSuccessDesc}
          </p>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-left text-sm space-y-2 mb-8">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'নাম:' : 'Name:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{successInfo.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'ইমেইল:' : 'Email:'}</span>
              <span className="font-semibold text-slate-900 dark:text-white">{successInfo.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">{lang === 'bn' ? 'অনুসরণকৃত প্রতিষ্ঠান:' : 'Followed Portals:'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{successInfo.count} টি</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage('notices')}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md cursor-pointer"
            >
              {t.ctaViewNotices}
            </button>
            <button
              onClick={() => {
                setIsSuccess(false);
                setName('');
                setEmail('');
                setOwnershipToken('');
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              {t.subAnother}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 mb-4">
          <Bell className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? '১০০% ফ্রি সার্ভিস' : '100% Free Service'}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {t.subTitle}
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {t.subSubtitle}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Contact Details Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{lang === 'bn' ? '১. আপনার যোগাযোগের তথ্য' : '1. Your Contact Information'}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.subNameLabel}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.subNamePlaceholder}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t.subEmailLabel} <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t.subEmailPlaceholder}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t.subEmailHint}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {lang === 'bn' ? 'সাবস্ক্রিপশন ম্যানেজমেন্ট টোকেন (শুধু আপডেটের জন্য)' : 'Subscription management token (updates only)'}
            </label>
            <input
              type="password"
              autoComplete="off"
              value={ownershipToken}
              onChange={e => setOwnershipToken(e.target.value)}
              placeholder={lang === 'bn' ? 'আপনার স্বাগতম/অ্যালার্ট ইমেইলের টোকেন' : 'Token from your welcome/alert email'}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Website Selection Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? '২. কোন কোন প্রতিষ্ঠানের নোটিশ চান?' : '2. Select Portals to Monitor'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? `নির্বাচিত: ${selectedWebsiteIds.length} টি প্রতিষ্ঠান`
                  : `Selected: ${selectedWebsiteIds.length} portal(s)`}
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
              >
                {t.subSelectAll}
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                {t.subDeselectAll}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {websites.map(site => {
              const isSelected = selectedWebsiteIds.includes(site.id);
              return (
                <div
                  key={site.id}
                  onClick={() => toggleWebsite(site.id)}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="mt-0.5">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-emerald-100 dark:fill-emerald-950" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {lang === 'bn' ? site.nameBn : site.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {lang === 'bn' ? site.name : site.nameBn}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="text-center pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-10 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all cursor-pointer text-base sm:text-lg disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>{t.subSubmitting}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Bell className="w-5 h-5" />
                <span>{t.subSubmitBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
