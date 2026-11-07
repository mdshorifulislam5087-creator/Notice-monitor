import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileManagedWebsites, SEED_WEBSITES } from './seed.js';

test('default monitor contains the four requested Tavily notice sources', () => {
  assert.deepEqual(
    SEED_WEBSITES.map(site => site.url),
    [
      'https://all-notice.netlify.app/',
      'https://mrist.edu.bd/notices',
      'https://bteb.gov.bd/pages/notices',
      'https://www.duet.ac.bd/notice/all-notices'
    ]
  );
  assert.equal(SEED_WEBSITES.every(site => site.fetchMode === 'tavily'), true);
  assert.equal(SEED_WEBSITES.every(site => site.intervalMinutes === 60), true);
  const mrist = SEED_WEBSITES.find(site => site.id === 'mrist-notices');
  assert.equal(mrist?.name, 'Dr. Mahbubur Rahman Mollah Institute of Science & Technology (MRIST)');
  assert.equal(mrist?.nameBn, 'ড. মাহবুবুর রহমান মোল্লা ইনস্টিটিউট অব সায়েন্স অ্যান্ড টেকনোলজি (এমআরআইএসটি)');
});

test('existing data is migrated to the managed sources without losing runtime state', () => {
  const migrated = reconcileManagedWebsites([
    {
      ...SEED_WEBSITES[2],
      url: 'https://bteb.gov.bd/',
      lastCheckedAt: '2026-11-05T10:00:00.000Z',
      totalNoticesFound: 42
    },
    {
      id: 'dhaka-education-board',
      name: 'Legacy seed',
      nameBn: 'Legacy seed',
      url: 'https://dhakaeducationboard.gov.bd/',
      selector: 'a',
      category: 'board',
      intervalMinutes: 60,
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'custom-source',
      name: 'Custom source',
      nameBn: 'Custom source',
      url: 'https://example.com/notices',
      selector: 'a',
      category: 'other',
      intervalMinutes: 60,
      enabled: true,
      isCustom: true,
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ]);

  assert.equal(migrated.filter(site => SEED_WEBSITES.some(seed => seed.id === site.id)).length, 4);
  assert.equal(migrated.find(site => site.id === 'bteb-gov-bd')?.url, 'https://bteb.gov.bd/pages/notices');
  assert.equal(migrated.find(site => site.id === 'bteb-gov-bd')?.totalNoticesFound, 42);
  assert.equal(migrated.find(site => site.id === 'bteb-gov-bd')?.lastCheckedAt, '2026-11-05T10:00:00.000Z');
  assert.equal(migrated.find(site => site.id === 'dhaka-education-board')?.enabled, false);
  assert.equal(migrated.find(site => site.id === 'custom-source')?.enabled, true);
});
