/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, ArrowRight, ShieldCheck, Sparkles, CheckCircle2, Zap } from 'lucide-react';
import { Language, PageView, SystemStats } from '../types.js';
import { translations } from '../translations.js';

interface HeroProps {
  lang: Language;
  stats: SystemStats;
  setCurrentPage: (page: PageView) => void;
}

export const Hero: React.FC<HeroProps> = ({ lang, stats, setCurrentPage }) => {
  const t = translations[lang];

  return (
    <div className="relative overflow-hidden pt-8 pb-14 md:pt-16 md:pb-20 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50/30 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950">
      {/* Background glowing blurred decorative circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-emerald-400/20 to-teal-300/20 dark:from-emerald-600/10 dark:to-teal-500/10 blur-3xl pointer-events-none -z-10 rounded-full" />
      <div className="absolute -top-10 right-10 w-72 h-72 bg-amber-400/10 dark:bg-amber-500/5 blur-2xl pointer-events-none -z-10 rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50 mb-6 shadow-xs animate-fade-in">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t.appBadge}</span>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-emerald-500"></span>
            <span className="hidden sm:inline-block text-emerald-700 dark:text-emerald-300 font-normal">{t.avgDetectionTime}</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.18] sm:leading-[1.15] mb-5">
            {t.heroHeadline}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 dark:from-emerald-400 dark:via-teal-300 dark:to-sky-400">
              {lang === 'bn' ? 'সরাসরি আপনার ফোনে!' : 'Sent Direct to You!'}
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-2xl mx-auto">
            {t.heroSubheadline}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
            <button
              onClick={() => setCurrentPage('subscribe')}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/35 active:scale-[0.98] transition-all cursor-pointer text-base sm:text-lg"
            >
              <Bell className="w-5 h-5 animate-bounce" />
              <span>{t.ctaSubscribe}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setCurrentPage('notices')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer text-base"
            >
              <Zap className="w-4 h-4 text-amber-500" />
              <span>{t.ctaViewNotices}</span>
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {lang === 'bn' ? 'তাৎক্ষণিক ইমেইল অ্যালার্ট' : 'Instant Email Alerts'}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {lang === 'bn' ? '১০০% ফ্রি ও নিরাপদ' : '100% Free & Safe'}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {lang === 'bn' ? '১-ক্লিকে আনসাবস্ক্রাইব' : '1-Click Unsubscribe'}
            </span>
          </div>
        </div>

        {/* Real-time stats row */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {stats.totalSubscribers.toLocaleString('bn-BD')} +
            </div>
            <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              {t.statSubscribers}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
              {stats.totalNotices.toLocaleString('bn-BD')}
            </div>
            <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              {t.statNotices}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {stats.activeWebsites.toLocaleString('bn-BD')}
            </div>
            <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              {t.statWebsites}
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {stats.totalAlertsSent.toLocaleString('bn-BD')}
            </div>
            <div className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
              {t.statAlerts}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
