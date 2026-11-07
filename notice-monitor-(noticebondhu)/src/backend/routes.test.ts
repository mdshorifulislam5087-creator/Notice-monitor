import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';

test('admin and subscriber security boundaries work end to end', async () => {
  const originalCwd = process.cwd();
  const testDirectory = mkdtempSync(path.join(tmpdir(), 'noticebondhu-routes-'));
  process.chdir(testDirectory);
  process.env.ADMIN_PASSWORD = 'correct horse battery staple';
  process.env.ADMIN_SESSION_SECRET = 'integration-session-secret-with-more-than-32-characters';

  const [{ apiRouter }, { db }] = await Promise.all([
    import(`./routes.js?test=${Date.now()}`),
    import('./db.js')
  ]);
  const app = express();
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const legacyBearer = await fetch(`${baseUrl}/api/admin/websites`, {
      headers: { Authorization: 'Bearer admin123' }
    });
    assert.equal(legacyBearer.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct horse battery staple' })
    });
    assert.equal(login.status, 200);
    assert.deepEqual(await login.json(), { success: true });
    const cookie = login.headers.get('set-cookie');
    assert.match(cookie || '', /HttpOnly/);
    assert.doesNotMatch(cookie || '', /correct horse battery staple/);

    const session = await fetch(`${baseUrl}/api/admin/session`, {
      headers: { Cookie: cookie || '' }
    });
    assert.equal(session.status, 200);

    db.addWebsite({
      name: 'Private Creator Site',
      nameBn: 'Private Creator Site',
      url: 'https://example.com/notices',
      selector: '.notice a',
      category: 'college',
      intervalMinutes: 60,
      enabled: true,
      isCustom: true,
      creatorEmail: 'creator@example.com',
      totalNoticesFound: 0
    });
    const publicWebsites = await fetch(`${baseUrl}/api/websites`);
    const publicWebsiteList = await publicWebsites.json() as Record<string, unknown>[];
    const managedSource = publicWebsiteList.find(site => site.id === 'all-notice-netlify');
    assert.ok(managedSource);
    assert.equal('fetchMode' in managedSource, false);
    assert.equal('tavilyExtractUrl' in managedSource, false);
    const privateCreatorSite = publicWebsiteList.find(site => site.name === 'Private Creator Site');
    assert.ok(privateCreatorSite);
    assert.equal('selector' in privateCreatorSite, false);
    assert.equal('creatorEmail' in privateCreatorSite, false);

    const subscribe = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email: 'student@example.com',
        telegramChatId: '999999',
        websiteIds: ['dhaka-education-board']
      })
    });
    assert.equal(subscribe.status, 200);
    const subscribePayload = await subscribe.json() as { subscriber: Record<string, unknown> };
    assert.equal('telegramChatId' in subscribePayload.subscriber, false);
    assert.equal('telegramChatId' in (db.getSubscriberByEmail('student@example.com') as unknown as Record<string, unknown>), false);
    const ownershipToken = db.getSubscriberByEmail('student@example.com')?.unsubToken;
    assert.ok(ownershipToken);

    const unauthorizedUpdate = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker',
        email: 'student@example.com',
        telegramChatId: '999999',
        websiteIds: ['national-university-bd']
      })
    });
    assert.equal(unauthorizedUpdate.status, 403);

    const authorizedUpdate = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email: 'student@example.com',
        websiteIds: ['national-university-bd'],
        ownershipToken
      })
    });
    assert.equal(authorizedUpdate.status, 200);

    const adminSubscribers = await fetch(`${baseUrl}/api/admin/subscribers`, {
      headers: { Cookie: cookie || '' }
    });
    const subscriberList = await adminSubscribers.json() as Record<string, unknown>[];
    assert.equal(adminSubscribers.status, 200);
    assert.equal('unsubToken' in subscriberList[0], false);

    const removedTelegramEndpoint = await fetch(`${baseUrl}/api/admin/test-telegram`, {
      method: 'POST',
      headers: { Cookie: cookie || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '999999' })
    });
    assert.equal(removedTelegramEndpoint.status, 404);

    const emailOnlyUnsubscribe = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@example.com' })
    });
    assert.equal(emailOnlyUnsubscribe.status, 400);

    const authorizedUnsubscribe = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ownershipToken })
    });
    assert.equal(authorizedUnsubscribe.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
    process.chdir(originalCwd);
    rmSync(testDirectory, { recursive: true, force: true });
  }
});
