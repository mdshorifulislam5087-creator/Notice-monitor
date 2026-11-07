/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BellOff, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Language, PageView } from '../types.js';
import { translations } from '../translations.js';

interface UnsubscribeViewProps {
  lang: Language;
  initialEmail?: string;
  initialToken?: string;
  setCurrentPage: (page: PageView) => void;
}

export const UnsubscribeView: React.FC<UnsubscribeViewProps> = ({
  lang,
  initialEmail = '',
  initialToken = '',
  setCurrentPage
}) => {
  const t = translations[lang];

  const [unsubscribeToken, setUnsubscribeToken] = useState(initialToken);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unsubscribeToken) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: unsubscribeToken
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unsubscribe');
      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unsubscribe failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="py-20 max-w-lg mx-auto px-4 text-center">
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {t.unsubSuccessTitle}
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {t.unsubSuccessDesc}
          </p>

          <button
            onClick={() => setCurrentPage('home')}
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer text-sm"
          >
            {lang === 'bn' ? 'মূল পাতায় ফিরে যান' : 'Back to Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20 max-w-lg mx-auto px-4">
      <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
        <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BellOff className="w-7 h-7" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t.unsubTitle}
        </h2>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {t.unsubDesc}
        </p>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUnsubscribe} className="space-y-4">
          <input
            type="text"
            required
            value={unsubscribeToken}
            onChange={e => setUnsubscribeToken(e.target.value)}
            placeholder={initialEmail ? 'Use the secure token from your email link' : 'Unsubscribe token'}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer text-sm"
          >
            {isSubmitting ? (lang === 'bn' ? 'প্রক্রিয়াধীন...' : 'Processing...') : t.unsubConfirmBtn}
          </button>
        </form>
      </div>
    </div>
  );
};
