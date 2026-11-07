import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup as dnsLookupCallback, type LookupAddress, type LookupAllOptions } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';

export const ADMIN_SESSION_COOKIE = 'noticebondhu_admin_session';

type Resolver = (hostname: string) => Promise<LookupAddress[]>;

const blockedAddresses = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['100::', 64],
  ['2001:2::', 48],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8]
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}

function signSessionPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = createHash('sha256').update(left).digest();
  const rightBuffer = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken(
  secret: string,
  now = Date.now(),
  ttlMs = 8 * 60 * 60 * 1000
): string {
  if (secret.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters');
  }

  const payload = `v1.${now + ttlMs}.${randomBytes(18).toString('base64url')}`;
  return `${payload}.${signSessionPayload(payload, secret)}`;
}

export function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now()
): boolean {
  if (!token || secret.length < 32) return false;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;

  const payload = parts.slice(0, 3).join('.');
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  return safeEqual(parts[3], signSessionPayload(payload, secret));
}

export function getCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;

  for (const item of header.split(';')) {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex === -1) continue;
    if (item.slice(0, separatorIndex).trim() === name) {
      return item.slice(separatorIndex + 1).trim();
    }
  }
  return undefined;
}

export function isAuthorizedSubscriber(storedToken: string, providedToken?: string): boolean {
  return typeof providedToken === 'string' && safeEqual(storedToken, providedToken);
}

export function isPublicIpAddress(rawAddress: string): boolean {
  const address = rawAddress.replace(/^\[|\]$/g, '').toLowerCase();
  const mappedIpv4 = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (mappedIpv4) return isPublicIpAddress(mappedIpv4);

  const family = isIP(address);
  if (family === 4) return !blockedAddresses.check(address, 'ipv4');
  if (family === 6) return !blockedAddresses.check(address, 'ipv6');
  return false;
}

export const safeDnsLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookupCallback(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '');
    if (addresses.length === 0 || addresses.some(item => !isPublicIpAddress(item.address))) {
      const blockedError = new Error('DNS lookup returned a private or reserved address') as NodeJS.ErrnoException;
      blockedError.code = 'EACCES';
      return callback(blockedError, '');
    }

    if ((options as LookupAllOptions).all) {
      return callback(null, addresses);
    }
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

export async function assertSafeUrl(
  rawUrl: string,
  resolver: Resolver = hostname => dnsLookup(hostname, { all: true, verbatim: true })
): Promise<URL> {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
    throw new Error('Invalid URL');
  }

  const url = new URL(rawUrl.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed');
  }
  if (url.username || url.password) {
    throw new Error('URL credentials are not allowed');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Private hostnames are not allowed');
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) as 4 | 6 }]
    : await resolver(hostname);

  if (addresses.length === 0 || addresses.some(item => !isPublicIpAddress(item.address))) {
    throw new Error('URL must resolve only to public IP addresses');
  }

  return url;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeNotificationUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}
