/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { scraper } from './scraper.js';
import { scheduler } from './scheduler.js';
import { notifier } from './notifier.js';
import { WebsiteCategory } from './types.js';
import {
  ADMIN_SESSION_COOKIE,
  assertSafeUrl,
  createAdminSessionToken,
  getCookie,
  isAuthorizedSubscriber,
  verifyAdminSessionToken
} from './security.js';

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '32kb' }));

const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getAdminConfig(): { password: string; sessionSecret: string } | null {
  const password = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !sessionSecret || sessionSecret.length < 32) return null;
  return { password, sessionSecret };
}

function adminSessionCookie(token: string, maxAge = ADMIN_SESSION_MAX_AGE_SECONDS): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${ADMIN_SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secure}`;
}

function hasValidAdminSession(req: Request): boolean {
  const config = getAdminConfig();
  const token = getCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  return !!config && verifyAdminSessionToken(token, config.sessionSecret);
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (hasValidAdminSession(req)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

const rateLimitBuckets = new Map<string, number[]>();

function toPublicWebsite(website: ReturnType<typeof db.getWebsites>[number]) {
  const {
    selector,
    creatorEmail,
    lastCheckError,
    fetchMode,
    tavilyExtractUrl,
    ...publicFields
  } = website;
  return publicFields;
}

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateLimitBuckets.size > 10_000) {
    for (const [bucketKey, bucket] of rateLimitBuckets) {
      const active = bucket.filter(timestamp => now - timestamp < windowMs);
      if (active.length === 0) rateLimitBuckets.delete(bucketKey);
      else rateLimitBuckets.set(bucketKey, active);
    }
  }
  let timestamps = rateLimitBuckets.get(key) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= limit) {
    rateLimitBuckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return true;
}

// -----------------------------------------------------------------------------
// PUBLIC ROUTES
// -----------------------------------------------------------------------------

/**
 * Health check
 */
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    stats: db.getStats()
  });
});

/**
 * Public System Stats
 */
apiRouter.get('/stats', (_req, res) => {
  res.json(db.getStats());
});

/**
 * List supported websites for subscription and directory
 */
apiRouter.get('/websites', (req, res) => {
  const category = req.query.category as string;
  let websites = db.getWebsites(false); // only enabled and approved for public

  if (category && category !== 'all') {
    websites = websites.filter(w => w.category === category);
  }

  const sanitized = websites.map(toPublicWebsite);
  res.json(sanitized);
});

/**
 * Auto-detect and test a website before adding (public endpoint with rate limiting)
 */
apiRouter.post('/websites/test', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`website-test:${clientIp}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({
        error: 'ঘণ্টায় সর্বোচ্চ ১০ বার টেস্ট রিকোয়েস্ট করা যাবে। কিছুক্ষণ পর আবার চেষ্টা করুন। (Rate limit exceeded: max 10 tests/hr)'
      });
    }

    const { url, selector, isJsHeavy } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'ওয়েবসাইটের URL দিন (URL is required)' });
    }

    const safeUrl = await assertSafeUrl(url);
    const result = await scraper.autoDetectNotices(safeUrl.href, selector, !!isJsHeavy);
    return res.json(result);
  } catch {
    return res.status(400).json({ error: 'URL could not be safely fetched' });
  }
});

/**
 * Add a custom website to monitor with auto-subscription and rate limits
 */
apiRouter.post('/websites/custom', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`website-custom:${clientIp}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many custom website submissions' });
    }

    const { name, nameBn, url, category, intervalMinutes, email, selector, isJsHeavy } = req.body;

    if (!name || !url || !email) {
      return res.status(400).json({ error: 'নাম, নোটিশ পেজের URL এবং ইমেইল বাধ্যতামূলক (Name, URL, and Email are required)' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা দিন (Valid email is required)' });
    }

    const safeUrl = await assertSafeUrl(url);

    // Rate limit: max 5 custom websites per email
    const customCount = db.getCustomWebsitesCountByEmail(email);
    if (customCount >= 5) {
      return res.status(400).json({
        error: 'একটি ইমেইল থেকে সর্বোচ্চ ৫টি কাস্টম ওয়েবসাইট যোগ করা যাবে। (Max 5 custom websites allowed per email)'
      });
    }

    // Duplicate check: normalize URL
    const existingSite = db.getWebsiteByUrl(safeUrl.href);
    if (existingSite) {
      // Auto-subscribe user to existing website
      db.subscribe({
        name: name || 'শিক্ষার্থী',
        email,
        websiteIds: [existingSite.id],
        ownershipToken: req.body.ownershipToken
      });

      return res.json({
        success: true,
        isExisting: true,
        message: 'এই ওয়েবসাইটটি ইতোমধ্যে মনিটর করা হচ্ছে! আপনাকে স্বয়ংক্রিয়ভাবে এতে সাবস্ক্রাইব করা হয়েছে।',
        website: toPublicWebsite(existingSite)
      });
    }

    // Determine selector: use provided, or run quick auto-detect
    let finalSelector = selector?.trim();
    if (!finalSelector) {
      const autoRes = await scraper.autoDetectNotices(safeUrl.href, undefined, !!isJsHeavy);
      finalSelector = autoRes.selector || 'table tr td a, .notices a, a[href*="notice"]';
    }

    const newSite = db.addWebsite({
      name: name.trim(),
      nameBn: nameBn?.trim() || name.trim(),
      url: safeUrl.href,
      selector: finalSelector,
      category: (category as WebsiteCategory) || 'college',
      intervalMinutes: Number(intervalMinutes) || 60,
      enabled: true,
      isJsHeavy: !!isJsHeavy,
      isCustom: true,
      creatorEmail: email.trim().toLowerCase(),
      totalNoticesFound: 0
    });

    // Auto-subscribe the user
    db.subscribe({
      name: name.trim(),
      email: email.trim(),
      websiteIds: [newSite.id]
    });

    // Trigger initial baseline check without sending alerts
    scraper.scrapeWebsite(newSite).catch(err => {
      console.warn('[Routes] Initial scrape error for custom website:', err);
    });

    const isPending = newSite.approvalStatus === 'pending';
    return res.status(201).json({
      success: true,
      isExisting: false,
      message: isPending
        ? 'আপনার কাস্টম ওয়েবসাইটটি সফলভাবে জমা দেওয়া হয়েছে! এডমিন পর্যালোচনার পর সক্রিয় হবে।'
        : 'আপনার ওয়েবসাইটটি সফলভাবে যোগ করা হয়েছে এবং আপনি এতে সাবস্ক্রাইব হয়েছেন!',
      website: toPublicWebsite(newSite)
    });
  } catch (err: any) {
    if (err?.message === 'OWNERSHIP_TOKEN_REQUIRED') {
      return res.status(403).json({ error: 'Ownership token required to change an existing subscription' });
    }
    console.error('[Routes] Custom website submission failed:', err);
    return res.status(400).json({ error: 'Failed to add custom website' });
  }
});

/**
 * List notices with search, website filter, category filter, pagination
 */
apiRouter.get('/notices', (req, res) => {
  const websiteId = req.query.websiteId as string;
  const category = req.query.category as string;
  const search = req.query.search as string;
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 10, 50);

  const result = db.getNotices({
    websiteId,
    category,
    search,
    page,
    limit
  });

  res.json(result);
});

/**
 * Subscribe student to notifications
 */
apiRouter.post('/subscribe', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`subscribe:${clientIp}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many subscription requests' });
    }

    const { name, email, websiteIds, ownershipToken } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'সঠিক ইমেইল ঠিকানা দিন (Valid email is required)' });
    }

    if (!Array.isArray(websiteIds) || websiteIds.length === 0) {
      return res.status(400).json({ error: 'অন্তত একটি ওয়েবসাইট নির্বাচন করুন (Select at least one website)' });
    }

    const { subscriber, subscribedCount, isNew } = db.subscribe({
      name: name || 'শিক্ষার্থী',
      email,
      websiteIds,
      ownershipToken
    });

    if (isNew) {
      notifier.sendSubscriptionWelcome(subscriber).catch(err => {
        console.error('[Routes] Failed to send subscription management email:', err);
      });
    }

    res.json({
      success: true,
      message: isNew
        ? 'সফলভাবে সাবস্ক্রাইব করা হয়েছে! নতুন নোটিশ প্রকাশিত হলে নোটিফিকেশন পাবেন।'
        : 'আপনার সাবস্ক্রিপশন সফলভাবে আপডেট করা হয়েছে।',
      subscriber: {
        id: subscriber.id,
        name: subscriber.name,
        email: subscriber.email
      },
      subscribedCount
    });
  } catch (err: any) {
    if (err?.message === 'OWNERSHIP_TOKEN_REQUIRED') {
      return res.status(403).json({ error: 'Ownership token required to change an existing subscription' });
    }
    console.error('[Routes] Subscription failed:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

/**
 * Unsubscribe student
 */
apiRouter.post('/unsubscribe', (req, res) => {
  const { token, websiteId } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'A valid unsubscribe token is required' });
  }

  const result = db.unsubscribe(token, websiteId);
  if (!result.success) {
    return res.status(404).json({ error: result.message });
  }

  res.json({ success: true, message: result.message });
});

// -----------------------------------------------------------------------------
// ADMIN ROUTES (Protected)
// -----------------------------------------------------------------------------

/**
 * Admin Login
 */
apiRouter.post('/admin/login', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`admin-login:${clientIp}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  const config = getAdminConfig();
  if (!config) {
    return res.status(503).json({ error: 'Admin authentication is not configured' });
  }

  const { password } = req.body;
  if (typeof password === 'string' && isAuthorizedSubscriber(config.password, password)) {
    const token = createAdminSessionToken(config.sessionSecret);
    res.setHeader('Set-Cookie', adminSessionCookie(token));
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'ভুল এডমিন পাসওয়ার্ড (Incorrect admin password)' });
});

apiRouter.get('/admin/session', (req, res) => {
  res.json({ authenticated: hasValidAdminSession(req) });
});

apiRouter.post('/admin/logout', (_req, res) => {
  res.setHeader('Set-Cookie', adminSessionCookie('', 0));
  res.json({ success: true });
});

/**
 * Get all websites with full details (selectors, error state)
 */
apiRouter.get('/admin/websites', requireAdmin, (_req, res) => {
  res.json(db.getWebsites(true));
});

/**
 * Add a new website to monitor
 */
apiRouter.post('/admin/websites', requireAdmin, async (req, res) => {
  try {
    const { name, nameBn, url, selector, category, intervalMinutes, enabled, isJsHeavy } = req.body;

    if (!name || !url || !selector) {
      return res.status(400).json({ error: 'Name, URL, and CSS Selector are required' });
    }

    const safeUrl = await assertSafeUrl(url);
    const newSite = db.addWebsite({
      name,
      nameBn: nameBn || name,
      url: safeUrl.href,
      selector,
      category: (category as WebsiteCategory) || 'board',
      intervalMinutes: Number(intervalMinutes) || 60,
      enabled: enabled !== false,
      isJsHeavy: !!isJsHeavy,
      totalNoticesFound: 0
    });

    // Trigger an initial baseline check automatically in background
    scraper.scrapeWebsite(newSite).catch(err => {
      console.warn('[Routes] Initial scrape error for new website:', err);
    });

    res.status(201).json({ success: true, website: newSite });
  } catch (err) {
    console.error('[Routes] Admin website creation failed:', err);
    res.status(400).json({ error: 'Invalid website configuration' });
  }
});

/**
 * Update an existing website
 */
apiRouter.put('/admin/websites/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getWebsiteById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const updates = {
      name: typeof req.body.name === 'string' ? req.body.name.trim() : existing.name,
      nameBn: typeof req.body.nameBn === 'string' ? req.body.nameBn.trim() : existing.nameBn,
      url: req.body.url ? (await assertSafeUrl(req.body.url)).href : existing.url,
      selector: typeof req.body.selector === 'string' ? req.body.selector.trim() : existing.selector,
      category: req.body.category || existing.category,
      intervalMinutes: Number(req.body.intervalMinutes) || existing.intervalMinutes,
      enabled: typeof req.body.enabled === 'boolean' ? req.body.enabled : existing.enabled,
      isJsHeavy: typeof req.body.isJsHeavy === 'boolean' ? req.body.isJsHeavy : existing.isJsHeavy
    };
    const updated = db.updateWebsite(id, updates);
    res.json({ success: true, website: updated });
  } catch {
    res.status(400).json({ error: 'Invalid website configuration' });
  }
});

/**
 * Get admin system settings
 */
apiRouter.get('/admin/settings', requireAdmin, (_req, res) => {
  res.json(db.getSettings());
});

/**
 * Update admin system settings
 */
apiRouter.put('/admin/settings', requireAdmin, (req, res) => {
  if (typeof req.body.requireCustomApproval !== 'boolean') {
    return res.status(400).json({ error: 'requireCustomApproval must be a boolean' });
  }
  const updated = db.updateSettings({ requireCustomApproval: req.body.requireCustomApproval });
  res.json({ success: true, settings: updated });
});

/**
 * Approve a pending custom website
 */
apiRouter.put('/admin/websites/:id/approve', requireAdmin, (req, res) => {
  const { id } = req.params;
  const updated = db.updateWebsite(id, { approvalStatus: 'approved', enabled: true });
  if (!updated) {
    return res.status(404).json({ error: 'Website not found' });
  }
  res.json({ success: true, website: updated });
});

/**
 * Reject / disable a custom website
 */
apiRouter.put('/admin/websites/:id/reject', requireAdmin, (req, res) => {
  const { id } = req.params;
  const updated = db.updateWebsite(id, { approvalStatus: 'rejected', enabled: false });
  if (!updated) {
    return res.status(404).json({ error: 'Website not found' });
  }
  res.json({ success: true, website: updated });
});

/**
 * Delete a website
 */
apiRouter.delete('/admin/websites/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteWebsite(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Website not found' });
  }

  res.json({ success: true, message: 'Website removed from monitor' });
});

/**
 * Manually trigger scraper for a specific website
 */
apiRouter.post('/admin/websites/:id/check', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await scheduler.triggerManual(id);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manually trigger scraper for all active websites
 */
apiRouter.post('/admin/scrape-all', requireAdmin, async (_req, res) => {
  try {
    const results = await scheduler.triggerManual();
    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Simulate a new notice for quick alert pipeline testing
 */
apiRouter.post('/admin/simulate-notice', requireAdmin, async (req, res) => {
  try {
    const { websiteId, title, link } = req.body;
    const website = db.getWebsiteById(websiteId);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const sampleTitle = title || `[টেস্ট জরুরি নোটিশ] ${website.nameBn} জরুরি বিজ্ঞপ্তি ${new Date().toLocaleTimeString('bn-BD')}`;
    const sampleLink = link || `${website.url}notice-sample-${Date.now()}.pdf`;

    const notice = db.addNotice({
      websiteId: website.id,
      websiteName: website.name,
      websiteNameBn: website.nameBn,
      title: sampleTitle,
      link: sampleLink,
      publishDate: new Date().toLocaleDateString('bn-BD'),
      isInitialRun: false,
      category: website.category
    });

    // Dispatch alerts to subscribers of this website
    const subscribers = db.getSubscribersForWebsite(website.id);
    await notifier.dispatchAlerts(notice, subscribers);

    res.json({
      success: true,
      message: `Simulated notice created and alerts dispatched to ${subscribers.length} subscriber(s)`,
      notice,
      subscribersCount: subscribers.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get check logs & alert logs
 */
apiRouter.get('/admin/logs', requireAdmin, (_req, res) => {
  res.json({
    checkLogs: db.getCheckLogs(50),
    alertLogs: db.getAlertLogs(50)
  });
});

/**
 * Get subscribers list
 */
apiRouter.get('/admin/subscribers', requireAdmin, (_req, res) => {
  res.json(db.getSubscribers());
});

// -----------------------------------------------------------------------------
// TEST FIXTURES / MOCK ENDPOINTS (For reliable offline/geo-blocked testing)
// -----------------------------------------------------------------------------
apiRouter.get('/mock-sites/:siteId', (req, res) => {
  const { siteId } = req.params;
  const timestamp = new Date().toLocaleDateString('bn-BD');

  const html = `
    <!DOCTYPE html>
    <html lang="bn">
    <head><meta charset="utf-8"><title>Mock Education Portal</title></head>
    <body>
      <div class="header"><h1>বাংলাদেশ শিক্ষা ও পরীক্ষা পোর্টাল</h1></div>
      <div id="noticelist" class="notices">
        <h2>সর্বশেষ নোটিশসমূহ</h2>
        <table class="table">
          <thead><tr><th>তারিখ</th><th>শিরোনাম</th><th>ডাউনলোড</th></tr></thead>
          <tbody>
            <tr>
              <td>${timestamp}</td>
              <td><a href="/mock-files/form-fillup-notice-2026.pdf">২০২৬ সালের চূড়ান্ত পরীক্ষার অনলাইন ফরম পূরণ ও ফি জমাদান সংক্রান্ত বিজ্ঞপ্তি</a></td>
              <td>PDF</td>
            </tr>
            <tr>
              <td>১৫ অক্টোবর ২০২৬</td>
              <td><a href="/mock-files/registration-correction-2026.pdf">রেজিস্ট্রেশন কার্ডের ভুল সংশোধন ও শাখা পরিবর্তনের সময়সীমা বৃদ্ধি</a></td>
              <td>PDF</td>
            </tr>
            <tr>
              <td>১৪ অক্টোবর ২০২৬</td>
              <td><a href="/mock-files/scholarship-notice-2026.pdf">মেধাবৃত্তি ও সাধারণ বৃত্তিপ্রাপ্ত শিক্ষার্থীদের তালিকা ও নীতিমালা</a></td>
              <td>PDF</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
