import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_SESSION_COOKIE,
  assertSafeUrl,
  createAdminSessionToken,
  escapeHtml,
  getCookie,
  isAuthorizedSubscriber,
  isPublicIpAddress,
  safeNotificationUrl,
  safeDnsLookup,
  verifyAdminSessionToken
} from './security.js';

const sessionSecret = 'test-session-secret-that-is-at-least-32-characters';

test('admin session tokens are signed, expire, and reject tampering', () => {
  const now = 1_800_000_000_000;
  const token = createAdminSessionToken(sessionSecret, now, 60_000);

  assert.equal(verifyAdminSessionToken(token, sessionSecret, now + 1_000), true);
  assert.equal(verifyAdminSessionToken(`${token}x`, sessionSecret, now + 1_000), false);
  assert.equal(verifyAdminSessionToken(token, sessionSecret, now + 60_001), false);
});

test('cookie parsing returns only the exact admin session cookie', () => {
  const header = `theme=dark; ${ADMIN_SESSION_COOKIE}=signed-token; other=value`;
  assert.equal(getCookie(header, ADMIN_SESSION_COOKIE), 'signed-token');
  assert.equal(getCookie(header, 'missing'), undefined);
});

test('subscriber changes require the matching ownership token', () => {
  assert.equal(isAuthorizedSubscriber('stored-secret', 'stored-secret'), true);
  assert.equal(isAuthorizedSubscriber('stored-secret', 'wrong-secret'), false);
  assert.equal(isAuthorizedSubscriber('stored-secret', undefined), false);
});

test('private, loopback, link-local, documentation, and mapped IPs are rejected', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.168.1.1',
    '203.0.113.5',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1'
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true);
});

test('safe URL validation rejects a hostname resolving to any private address', async () => {
  await assert.rejects(
    assertSafeUrl('https://example.com/notices', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ]),
    /public IP address/
  );
});

test('safe URL validation accepts HTTP(S) URLs resolving only to public addresses', async () => {
  const url = await assertSafeUrl('https://example.com/notices', async () => [
    { address: '93.184.216.34', family: 4 }
  ]);
  assert.equal(url.href, 'https://example.com/notices');
});

test('socket DNS lookup blocks private addresses at connection time', async () => {
  const error = await new Promise<NodeJS.ErrnoException | null>(resolve => {
    safeDnsLookup('127.0.0.1', {}, lookupError => resolve(lookupError));
  });
  assert.equal(error?.code, 'EACCES');
});

test('notification HTML escapes scraped and subscriber-controlled values', () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">&'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;'
  );
});

test('notification links allow only HTTP(S) destinations', () => {
  assert.equal(safeNotificationUrl('https://example.com/notice.pdf'), 'https://example.com/notice.pdf');
  assert.equal(safeNotificationUrl('javascript:alert(1)'), '#');
  assert.equal(safeNotificationUrl('not a url'), '#');
});
