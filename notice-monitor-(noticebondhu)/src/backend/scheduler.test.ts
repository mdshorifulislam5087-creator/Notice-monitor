import assert from 'node:assert/strict';
import test from 'node:test';
import { isWebsiteDue } from './scheduler.js';
import { Website } from './types.js';

const website: Website = {
  id: 'source',
  name: 'Source',
  nameBn: 'Source',
  url: 'https://example.com/notices',
  selector: 'tavily-search',
  category: 'other',
  intervalMinutes: 60,
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z'
};

test('website is due on its first run or when its interval elapsed', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  assert.equal(isWebsiteDue(website, now), true);
  assert.equal(isWebsiteDue({ ...website, lastCheckedAt: '2026-11-05T10:59:59Z' }, now), true);
  assert.equal(isWebsiteDue({ ...website, lastCheckedAt: '2026-11-05T11:30:00Z' }, now), false);
});

test('invalid last-check timestamps are retried instead of disabling automation', () => {
  assert.equal(isWebsiteDue({ ...website, lastCheckedAt: 'invalid' }, Date.now()), true);
});

test('failed checks retry after five minutes instead of waiting the full source interval', () => {
  const now = Date.parse('2026-11-05T12:00:00Z');
  const failedWebsite = {
    ...website,
    lastCheckStatus: 'failed' as const,
    lastCheckedAt: '2026-11-05T11:54:59Z'
  };
  assert.equal(isWebsiteDue(failedWebsite, now), true);
  assert.equal(
    isWebsiteDue({ ...failedWebsite, lastCheckedAt: '2026-11-05T11:58:00Z' }, now),
    false
  );
});
