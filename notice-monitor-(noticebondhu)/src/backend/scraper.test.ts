import assert from 'node:assert/strict';
import test from 'node:test';
import { NoticeScraper } from './scraper.js';
import { Website } from './types.js';

const tavilyWebsite: Website = {
  id: 'bteb-gov-bd',
  name: 'Bangladesh Technical Education Board',
  nameBn: 'বাংলাদেশ কারিগরি শিক্ষা বোর্ড',
  url: 'https://bteb.gov.bd/pages/notices',
  selector: 'tavily-extract',
  category: 'board',
  intervalMinutes: 60,
  enabled: true,
  fetchMode: 'tavily',
  createdAt: '2026-01-01T00:00:00.000Z'
};

test('scraper uses Tavily for websites configured with Tavily fetch mode', async () => {
  let receivedWebsiteId = '';
  const scraper = new NoticeScraper({
    fetchNotices: async (website: Website) => {
      receivedWebsiteId = website.id;
      return [{ title: 'New BTEB notice', link: 'https://bteb.gov.bd/pages/notices/123' }];
    }
  });

  const notices = await scraper.fetchNoticeItems(tavilyWebsite);

  assert.equal(receivedWebsiteId, tavilyWebsite.id);
  assert.deepEqual(notices, [
    { title: 'New BTEB notice', link: 'https://bteb.gov.bd/pages/notices/123' }
  ]);
});

test('a new Tavily notice after baseline is persisted and dispatched to email subscribers', async () => {
  const storedNotices: any[] = [];
  const dispatched: any[] = [];
  const subscriber = {
    id: 'sub-1',
    name: 'Student',
    email: 'student@example.com',
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    unsubToken: 'private-token'
  };
  const siteAfterBaseline = {
    ...tavilyWebsite,
    lastCheckedAt: '2026-11-05T10:00:00.000Z',
    totalNoticesFound: 3
  };
  const storage = {
    hasNotice: () => false,
    addNotice: (notice: any) => {
      const saved = { ...notice, id: 'notice-1', detectedAt: '2026-11-05T12:00:00.000Z' };
      storedNotices.push(saved);
      return saved;
    },
    updateWebsite: () => siteAfterBaseline,
    addCheckLog: () => undefined,
    getSubscribersForWebsite: () => [subscriber],
    getWebsites: () => [siteAfterBaseline]
  };
  const alertDispatcher = {
    dispatchAlerts: async (notice: any, subscribers: any[]) => {
      dispatched.push({ notice, subscribers });
    }
  };
  const scraper = new NoticeScraper({
    fetchNotices: async () => [
      { title: 'New examination notice', link: 'https://bteb.gov.bd/pages/notices/456' }
    ]
  }, storage as any, alertDispatcher as any);

  const result = await scraper.scrapeWebsite(siteAfterBaseline);

  assert.equal(result.success, true);
  assert.equal(result.newNoticesCount, 1);
  assert.equal(storedNotices.length, 1);
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].subscribers[0].email, 'student@example.com');
});
