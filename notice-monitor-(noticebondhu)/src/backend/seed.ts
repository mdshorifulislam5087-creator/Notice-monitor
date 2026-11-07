/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Website, Notice } from './types.js';

export const SEED_WEBSITES: Website[] = [
  {
    id: 'all-notice-netlify',
    name: 'All Notice',
    nameBn: 'অল নোটিশ',
    url: 'https://all-notice.netlify.app/',
    selector: 'tavily-extract',
    category: 'other',
    intervalMinutes: 60,
    enabled: true,
    fetchMode: 'tavily',
    createdAt: '2026-01-01T00:00:00.000Z',
    totalNoticesFound: 0
  },
  {
    id: 'mrist-notices',
    name: 'Dr. Mahbubur Rahman Mollah Institute of Science & Technology (MRIST)',
    nameBn: 'ড. মাহবুবুর রহমান মোল্লা ইনস্টিটিউট অব সায়েন্স অ্যান্ড টেকনোলজি (এমআরআইএসটি)',
    url: 'https://mrist.edu.bd/notices',
    selector: 'tavily-extract',
    category: 'college',
    intervalMinutes: 60,
    enabled: true,
    fetchMode: 'tavily',
    tavilyExtractUrl: 'https://mrist.edu.bd/notices-datatable',
    createdAt: '2026-01-01T00:00:00.000Z',
    totalNoticesFound: 0
  },
  {
    id: 'bteb-gov-bd',
    name: 'Bangladesh Technical Education Board (BTEB)',
    nameBn: 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড',
    url: 'https://bteb.gov.bd/pages/notices',
    selector: 'tavily-extract',
    category: 'board',
    intervalMinutes: 60,
    enabled: true,
    fetchMode: 'tavily',
    createdAt: '2026-01-01T00:00:00.000Z',
    totalNoticesFound: 0
  },
  {
    id: 'duet-notices',
    name: 'Dhaka University of Engineering & Technology (DUET)',
    nameBn: 'ঢাকা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয় (ডুয়েট)',
    url: 'https://www.duet.ac.bd/notice/all-notices',
    selector: 'tavily-extract',
    category: 'university',
    intervalMinutes: 60,
    enabled: true,
    fetchMode: 'tavily',
    createdAt: '2026-01-01T00:00:00.000Z',
    totalNoticesFound: 0
  }
];

const LEGACY_SEED_WEBSITE_IDS = new Set([
  'dhaka-education-board',
  'national-university-bd',
  'dshe-gov-bd',
  'bpsc-gov-bd'
]);

export function reconcileManagedWebsites(existingWebsites: Website[]): Website[] {
  const managedById = new Map(SEED_WEBSITES.map(site => [site.id, site]));
  const reconciled = existingWebsites.map(existing => {
    const managed = managedById.get(existing.id);
    if (managed) {
      managedById.delete(existing.id);
      return {
        ...existing,
        ...managed,
        createdAt: existing.createdAt,
        lastCheckedAt: existing.lastCheckedAt,
        lastCheckStatus: existing.lastCheckStatus,
        lastCheckError: existing.lastCheckError,
        totalNoticesFound: existing.totalNoticesFound ?? managed.totalNoticesFound
      };
    }

    if (!existing.isCustom && LEGACY_SEED_WEBSITE_IDS.has(existing.id)) {
      return { ...existing, enabled: false };
    }
    return existing;
  });

  return [...managedById.values(), ...reconciled];
}

// Notices are populated only by verified scraper runs so demo content is never
// presented as current operational data.
export const SEED_NOTICES: Notice[] = [];
