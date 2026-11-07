/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios, { AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import http from 'node:http';
import https from 'node:https';
import { Website, Notice } from './types.js';
import { db } from './db.js';
import { notifier } from './notifier.js';
import { assertSafeUrl, safeDnsLookup } from './security.js';
import { tavilyNoticeProvider, TavilyNoticeItem } from './tavily.js';

const safeHttpAgent = new http.Agent({ lookup: safeDnsLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeDnsLookup });

export interface ScrapedNoticeItem {
  title: string;
  link: string;
  publishDate?: string;
}

export interface ScrapeResult {
  websiteId: string;
  websiteName: string;
  success: boolean;
  noticesFound: number;
  newNoticesCount: number;
  durationMs: number;
  error?: string;
  newNotices: Notice[];
}

interface TavilyProvider {
  fetchNotices(website: Website): Promise<TavilyNoticeItem[]>;
}

type ScraperStorage = Pick<typeof db,
  'hasNotice' |
  'addNotice' |
  'updateWebsite' |
  'addCheckLog' |
  'getSubscribersForWebsite' |
  'getWebsites'
>;

type AlertDispatcher = Pick<typeof notifier, 'dispatchAlerts'>;

// Polite bot User-Agent respecting academic & government portals
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NoticeBondhu-Academic-Monitor/1.0 (Bangladesh Education Alert System; +https://noticebondhu.edu.bd)';

export class NoticeScraper {
  constructor(
    private readonly tavilyProvider: TavilyProvider = tavilyNoticeProvider,
    private readonly storage: ScraperStorage = db,
    private readonly alertDispatcher: AlertDispatcher = notifier
  ) {}

  /**
   * Resiliently fetch HTML using axios with polite headers, timeout, and max size
   */
  public async fetchHtml(url: string, isJsHeavy = false): Promise<string> {
    const safeUrl = await assertSafeUrl(url);
    const config: AxiosRequestConfig = {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 12000,
      maxRedirects: 0,
      maxContentLength: 5 * 1024 * 1024,
      httpAgent: safeHttpAgent,
      httpsAgent: safeHttpsAgent,
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400
    };

    // If website is marked as JS-heavy or if local testing endpoint
    if (isJsHeavy) {
      // NOTE: In production environments with installed chromium, this can invoke Playwright:
      // const browser = await playwright.chromium.launch({ headless: true });
      // const page = await browser.newPage();
      // await page.goto(url, { waitUntil: 'networkidle' });
      // return await page.content();
    }

    const response = await axios.get(safeUrl.href, config);
    return response.data;
  }

  /**
   * Extract notice items from HTML using CSS selector and Cheerio
   */
  public extractNotices(html: string, selector: string, baseUrl: string): ScrapedNoticeItem[] {
    const $ = cheerio.load(html);
    const results: ScrapedNoticeItem[] = [];
    const seenLinks = new Set<string>();

    // Try primary selector, and if empty, fallback to generic notice link patterns
    const selectorsToTry = [
      selector,
      'table tr td a',
      '.notice-list a',
      '.views-field-title a',
      'a[href*="notice"]',
      'a[href$=".pdf"]'
    ].filter(Boolean);

    let matchedElements: cheerio.Cheerio<any> | null = null;
    for (const sel of selectorsToTry) {
      const elements = $(sel);
      if (elements.length > 0) {
        matchedElements = elements;
        break;
      }
    }

    if (!matchedElements || matchedElements.length === 0) {
      return results;
    }

    matchedElements.each((_, el) => {
      const $el = $(el);
      const rawTitle = $el.text().replace(/\s+/g, ' ').trim();
      const rawHref = $el.attr('href')?.trim();

      // Skip empty or trivial anchor links
      if (!rawTitle || rawTitle.length < 5 || !rawHref || rawHref.startsWith('javascript:') || rawHref === '#') {
        return;
      }

      // Skip common navigation labels
      const ignoredLabels = ['home', 'হোম', 'contact', 'লগইন', 'about us', 'যোগাযোগ', 'read more', 'বিস্তারিত'];
      if (ignoredLabels.includes(rawTitle.toLowerCase())) {
        return;
      }

      // Convert relative URL to absolute URL
      let absoluteLink = rawHref;
      try {
        absoluteLink = new URL(rawHref, baseUrl).href;
      } catch {
        absoluteLink = rawHref;
      }

      if (seenLinks.has(absoluteLink)) {
        return;
      }
      seenLinks.add(absoluteLink);

      // Extract date if nearby in the same row/container
      let publishDate: string | undefined;
      const parentRow = $el.closest('tr, li, .views-row, .notice-item');
      if (parentRow.length > 0) {
        const rowText = parentRow.text();
        // Match dates like 16/10/2026 or 2026-10-16 or Bengali digits
        const dateMatch = rowText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
        if (dateMatch) {
          publishDate = dateMatch[0];
        }
      }

      results.push({
        title: rawTitle,
        link: absoluteLink,
        publishDate
      });
    });

    // Limit to top 25 recent notices per check to prevent payload floods
    return results.slice(0, 25);
  }

  public async fetchNoticeItems(website: Website): Promise<ScrapedNoticeItem[]> {
    if (website.fetchMode === 'tavily') {
      return this.tavilyProvider.fetchNotices(website);
    }

    const html = await this.fetchHtml(website.url, website.isJsHeavy);
    return this.extractNotices(html, website.selector, website.url);
  }

  /**
   * Scrape a single website, detect new notices, and dispatch alerts
   */
  public async scrapeWebsite(website: Website, isManual = false): Promise<ScrapeResult> {
    const startTime = Date.now();
    let noticesFound = 0;
    const newNotices: Notice[] = [];

    try {
      const items = await this.fetchNoticeItems(website);
      noticesFound = items.length;

      // Determine if this is the website's very first scrape
      const isFirstRun = (website.totalNoticesFound ?? 0) === 0 && !website.lastCheckedAt;

      for (const item of items) {
        const exists = this.storage.hasNotice(website.id, item.link);
        if (!exists) {
          const added = this.storage.addNotice({
            websiteId: website.id,
            websiteName: website.name,
            websiteNameBn: website.nameBn,
            title: item.title,
            link: item.link,
            publishDate: item.publishDate,
            isInitialRun: isFirstRun,
            category: website.category
          });
          newNotices.push(added);
        }
      }

      const durationMs = Date.now() - startTime;

      // Update website metadata in DB
      this.storage.updateWebsite(website.id, {
        lastCheckedAt: new Date().toISOString(),
        lastCheckStatus: 'success',
        lastCheckError: undefined,
        totalNoticesFound: (website.totalNoticesFound ?? 0) + newNotices.length
      });

      // Record check log
      this.storage.addCheckLog({
        websiteId: website.id,
        websiteName: website.name,
        status: 'success',
        noticesFound,
        newNoticesCount: newNotices.length,
        durationMs
      });

      // Send alerts only for non-initial runs and when new notices exist
      if (!isFirstRun && newNotices.length > 0) {
        const subscribers = this.storage.getSubscribersForWebsite(website.id);
        console.log(`[Scraper] Found ${newNotices.length} new notice(s) for ${website.name}. Alerting ${subscribers.length} subscriber(s)...`);
        
        for (const notice of newNotices) {
          await this.alertDispatcher.dispatchAlerts(notice, subscribers);
        }
      } else if (isFirstRun) {
        console.log(`[Scraper] Initial baseline run completed for ${website.name}. Saved ${newNotices.length} existing notices without alerts.`);
      }

      return {
        websiteId: website.id,
        websiteName: website.name,
        success: true,
        noticesFound,
        newNoticesCount: newNotices.length,
        durationMs,
        newNotices
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err?.message || 'Unknown network or parsing error';
      console.error(`[Scraper] Error scraping ${website.name} (${website.url}):`, errorMessage);

      this.storage.updateWebsite(website.id, {
        lastCheckedAt: new Date().toISOString(),
        lastCheckStatus: 'failed',
        lastCheckError: errorMessage
      });

      this.storage.addCheckLog({
        websiteId: website.id,
        websiteName: website.name,
        status: 'failed',
        noticesFound: 0,
        newNoticesCount: 0,
        durationMs,
        error: errorMessage
      });

      return {
        websiteId: website.id,
        websiteName: website.name,
        success: false,
        noticesFound: 0,
        newNoticesCount: 0,
        durationMs,
        error: errorMessage,
        newNotices: []
      };
    }
  }

  /**
   * Run scraper across all active websites with rate-limiting delay between requests
   */
  public async scrapeAllActiveWebsites(): Promise<ScrapeResult[]> {
    const websites = this.storage.getWebsites(false); // only enabled
    const results: ScrapeResult[] = [];

    console.log(`[Scraper] Starting scheduled scrape run for ${websites.length} active website(s)...`);

    for (const site of websites) {
      const res = await this.scrapeWebsite(site);
      results.push(res);
      // Polite rate-limiting pause between scraping different government servers (1.5 seconds)
      await new Promise(r => setTimeout(r, 1500));
    }

    return results;
  }

  /**
   * Auto-detect notice links and optimal CSS selector using DOM heuristics
   */
  public async autoDetectNotices(
    url: string,
    manualSelector?: string,
    isJsHeavy = false
  ): Promise<{
    success: boolean;
    selector: string;
    pageTitle: string;
    notices: ScrapedNoticeItem[];
    totalFound: number;
    confidence: 'high' | 'medium' | 'low';
    error?: string;
    tips?: string[];
  }> {
    try {
      const html = await this.fetchHtml(url, isJsHeavy);
      const $ = cheerio.load(html);

      const pageTitle = $('title').text().replace(/\s+/g, ' ').trim() || $('h1').first().text().trim() || 'Notice Board';

      // Clone clean DOM without navs, headers, footers, scripts
      const $clean = cheerio.load(html);
      $clean('header, nav, footer, .menu, .navbar, .site-header, .site-footer, script, style, noscript').remove();

      // If user supplied a manual selector, test it first
      if (manualSelector && manualSelector.trim()) {
        const manualItems = this.extractNotices(html, manualSelector.trim(), url);
        if (manualItems.length > 0) {
          return {
            success: true,
            selector: manualSelector.trim(),
            pageTitle,
            notices: manualItems.slice(0, 5),
            totalFound: manualItems.length,
            confidence: 'high'
          };
        }
      }

      // Keyword patterns indicating notices and circulars in Bengali and English
      const noticeKeywordsRegex = /(notice|circular|routine|result|admission|exam|syllabus|hsc|ssc|degree|merit|tender|নোটিশ|বিজ্ঞপ্তি|রুটিন|ভর্তি|পরীক্ষা|ফলাফল|তালিকা|ফরম পূরণ|আসন)/i;

      // Candidate structural selectors to evaluate
      const candidates = [
        '#noticelist a',
        '.noticelist a',
        'table.table tr td a',
        'table tr td a',
        '.notice-board a',
        '.notice-list a',
        '#notices a',
        '.notices a',
        '.views-field-title a',
        'ul.notice-list li a',
        'ul li a[href*="notice"]',
        'a[href*="notice"]',
        'a[href*="circular"]',
        'a[href$=".pdf"]',
        'a[href*=".pdf"]',
        '.list-group a',
        'article a',
        '.card a'
      ];

      let bestSelector = 'table tr td a, .notices a, a[href*="notice"]';
      let bestNotices: ScrapedNoticeItem[] = [];
      let bestScore = -1;

      for (const candidate of candidates) {
        const items = this.extractNotices($clean.html(), candidate, url);
        if (items.length === 0) continue;

        let score = 0;
        let keywordMatches = 0;
        let pdfMatches = 0;

        for (const item of items) {
          // Length check
          if (item.title.length >= 12) score += 2;
          if (noticeKeywordsRegex.test(item.title) || noticeKeywordsRegex.test(item.link)) {
            score += 5;
            keywordMatches++;
          }
          if (item.link.toLowerCase().endsWith('.pdf') || item.link.toLowerCase().includes('.pdf')) {
            score += 4;
            pdfMatches++;
          }
        }

        // Structural weight: table rows and specific notice classes are generally higher quality
        if (candidate.includes('table') || candidate.includes('notice')) {
          score += 6;
        }

        // Favor selectors yielding between 3 and 30 notices (avoiding sitewide link dumps of 200 items)
        if (items.length >= 2 && items.length <= 40) {
          score += 8;
        }

        if (score > bestScore && items.length > 0) {
          bestScore = score;
          bestSelector = candidate;
          bestNotices = items;
        }
      }

      // If candidates did not find anything, do a direct search for links with notice keywords or .pdf
      if (bestNotices.length === 0) {
        const fallbackItems: ScrapedNoticeItem[] = [];
        $clean('a').each((_, el) => {
          const $a = $(el);
          const text = $a.text().replace(/\s+/g, ' ').trim();
          const href = $a.attr('href')?.trim();

          if (!text || text.length < 10 || !href || href.startsWith('#') || href.startsWith('javascript:')) {
            return;
          }

          if (noticeKeywordsRegex.test(text) || (href && (href.includes('.pdf') || href.includes('notice')))) {
            let absLink = href;
            try {
              absLink = new URL(href, url).href;
            } catch {
              absLink = href;
            }
            fallbackItems.push({ title: text, link: absLink });
          }
        });

        if (fallbackItems.length > 0) {
          bestNotices = fallbackItems.slice(0, 25);
          bestSelector = 'a[href*="notice"], a[href$=".pdf"]';
          bestScore = 10;
        }
      }

      if (bestNotices.length === 0) {
        return {
          success: false,
          selector: manualSelector || 'table tr td a, .notices a',
          pageTitle,
          notices: [],
          totalFound: 0,
          confidence: 'low',
          error: 'কোনো নোটিশ শনাক্ত করা যায়নি (No notices detected)',
          tips: [
            'সরাসরি নোটিশ বা সার্কুলার পেজের লিংক দিন (হোমপেজ না দিয়ে যেমন: college.edu.bd/notices)',
            'যদি সাইটটি ডায়নামিক জাভাস্ক্রিপ্ট নির্ভর হয়, তবে JavaScript Heavy অপশনটি চেক করুন',
            'প্রয়োজনে ম্যানুয়ালি CSS Selector নির্দিষ্ট করে দিন (যেমন: .table a)'
          ]
        };
      }

      const confidence = bestScore > 20 ? 'high' : bestScore > 8 ? 'medium' : 'low';

      return {
        success: true,
        selector: bestSelector,
        pageTitle,
        notices: bestNotices.slice(0, 5), // top 5 preview
        totalFound: bestNotices.length,
        confidence
      };
    } catch (err: any) {
      return {
        success: false,
        selector: manualSelector || 'table tr td a',
        pageTitle: '',
        notices: [],
        totalFound: 0,
        confidence: 'low',
        error: err?.message || 'ওয়েবসাইটটি থেকে ডাটা ফেচ করা যায়নি (Failed to fetch website)',
        tips: [
          'ওয়েবসাইটটি সচল এবং ব্রাউজারে লোড হয় কিনা তা পরীক্ষা করুন',
          'URL এর শুরুতে https:// বা http:// সঠিক আছে কিনা যাচাই করুন',
          'ওয়েবসাইটটিতে ক্লাউডফ্লেয়ার বা অ্যাক্সেস ব্লক আছে কিনা দেখুন'
        ]
      };
    }
  }

}

export const scraper = new NoticeScraper();
