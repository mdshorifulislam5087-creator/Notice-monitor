/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Bell, Heart, Mail, Shield, ExternalLink, Code } from 'lucide-react';
import { Language, PageView } from '../types.js';
import { translations } from '../translations.js';

interface FooterProps {
  lang: Language;
  setCurrentPage: (page: PageView) => void;
}

export const Footer: React.FC<FooterProps> = ({ lang, setCurrentPage }) => {
  const t = translations[lang];

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {t.brandName} (NoticeBondhu)
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md leading-relaxed">
              {lang === 'bn'
                ? 'All Notice, MRIST, BTEB ও DUET-এর হালনাগাদ নোটিশ পর্যবেক্ষণ করে তাৎক্ষণিক ইমেইল অ্যালার্ট প্রদানকারী প্ল্যাটফর্ম।'
                : 'Automated notice monitoring and instant alerts for All Notice, MRIST, BTEB, and DUET.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-emerald-500" />
                Nodemailer SMTP
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-amber-500" />
                Tavily Extract API
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {lang === 'bn' ? 'দরকারী পাতা' : 'Quick Links'}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  onClick={() => setCurrentPage('home')}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  {t.navHome}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('subscribe')}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  {t.navSubscribe}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('notices')}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  {t.navNotices}
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage('admin')}
                  className="hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                >
                  {t.navAdmin}
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Official Portals */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {lang === 'bn' ? 'প্রধান পোর্টালসমূহ' : 'Main Portals'}
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://all-notice.netlify.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-600 flex items-center gap-1"
                >
                  <span>All Notice</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://mrist.edu.bd/notices"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-600 flex items-center gap-1"
                >
                  <span>MRIST</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://bteb.gov.bd/pages/notices"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-600 flex items-center gap-1"
                >
                  <span>BTEB</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href="https://www.duet.ac.bd/notice/all-notices"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-600 flex items-center gap-1"
                >
                  <span>DUET</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} NoticeBondhu (নোটিশবন্ধু). {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত।' : 'All rights reserved.'}</p>
          <p className="flex items-center gap-1 text-slate-500">
            <span>{lang === 'bn' ? 'বাংলাদেশের শিক্ষার্থীদের জন্য নিবেদিত' : 'Built for Bangladeshi Students'}</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          </p>
        </div>
      </div>
    </footer>
  );
};
