/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './frontend/components/Navbar.js';
import { Hero } from './frontend/components/Hero.js';
import { HowItWorks } from './frontend/components/HowItWorks.js';
import { WebsiteDirectory } from './frontend/components/WebsiteDirectory.js';
import { SubscribeView } from './frontend/components/SubscribeView.js';
import { NoticesView } from './frontend/components/NoticesView.js';
import { AdminDashboard } from './frontend/components/AdminDashboard.js';
import { UnsubscribeView } from './frontend/components/UnsubscribeView.js';
import { Footer } from './frontend/components/Footer.js';
import { Language, Theme, PageView, WebsitePublic, SystemStats } from './frontend/types.js';

export default function App() {
  const [lang, setLang] = useState<Language>('bn');
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('noticebondhu_theme') as Theme) || 'light';
  });

  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [websites, setWebsites] = useState<WebsitePublic[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalSubscribers: 0,
    totalNotices: 0,
    totalWebsites: 0,
    activeWebsites: 0,
    totalAlertsSent: 0,
    lastRunAt: null
  });

  const [selectedWebsiteIds, setSelectedWebsiteIds] = useState<string[]>([]);
  const [unsubEmail, setUnsubEmail] = useState<string>('');
  const [unsubToken, setUnsubToken] = useState<string>('');

  // Sync theme with document element
  useEffect(() => {
    localStorage.setItem('noticebondhu_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Read URL query parameters on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as PageView;
    const emailParam = params.get('email');
    const tokenParam = params.get('token');

    if (viewParam) {
      setCurrentPage(viewParam);
    }
    if (emailParam) setUnsubEmail(emailParam);
    if (tokenParam) {
      setUnsubToken(tokenParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchInitialData = async () => {
    try {
      const [resSites, resStats] = await Promise.all([
        fetch('/api/websites'),
        fetch('/api/stats')
      ]);

      if (resSites.ok) {
        const sitesData = await resSites.json();
        setWebsites(sitesData);
        // By default, pre-select top 2 boards for subscriber convenience if none chosen
        setSelectedWebsiteIds(prev => prev.length > 0 ? prev : sitesData.slice(0, 2).map((s: WebsitePublic) => s.id));
      }

      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }
    } catch (err) {
      console.warn('API fetch warning, using fallback seed state:', err);
    }
  };

  // Fetch initial websites and system stats from API
  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleSelectWebsiteForSubscription = (siteId: string) => {
    setSelectedWebsiteIds(prev => (prev.includes(siteId) ? prev : [...prev, siteId]));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Navbar
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        activeSitesCount={stats.activeWebsites}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <>
            <Hero
              lang={lang}
              stats={stats}
              setCurrentPage={setCurrentPage}
            />
            <HowItWorks lang={lang} />
            <WebsiteDirectory
              lang={lang}
              websites={websites}
              setCurrentPage={setCurrentPage}
              onSelectForSubscription={handleSelectWebsiteForSubscription}
              onWebsiteAdded={fetchInitialData}
            />
          </>
        )}

        {currentPage === 'subscribe' && (
          <SubscribeView
            lang={lang}
            websites={websites}
            selectedWebsiteIds={selectedWebsiteIds}
            setSelectedWebsiteIds={setSelectedWebsiteIds}
            setCurrentPage={setCurrentPage}
          />
        )}

        {currentPage === 'notices' && (
          <NoticesView
            lang={lang}
            websites={websites}
          />
        )}

        {currentPage === 'admin' && (
          <AdminDashboard
            lang={lang}
          />
        )}

        {currentPage === 'unsubscribe' && (
          <UnsubscribeView
            lang={lang}
            initialEmail={unsubEmail}
            initialToken={unsubToken}
            setCurrentPage={setCurrentPage}
          />
        )}
      </main>

      <Footer
        lang={lang}
        setCurrentPage={setCurrentPage}
      />
    </div>
  );
}
