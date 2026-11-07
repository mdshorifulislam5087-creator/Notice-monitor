/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import cron, { ScheduledTask } from 'node-cron';
import { db } from './db.js';
import { scraper } from './scraper.js';
import { Website } from './types.js';

export function isWebsiteDue(website: Website, now = Date.now()): boolean {
  if (!website.lastCheckedAt) return true;
  const lastTime = new Date(website.lastCheckedAt).getTime();
  if (!Number.isFinite(lastTime)) return true;
  const normalIntervalMinutes = Math.max(1, website.intervalMinutes || 60);
  const configuredFailureRetry = Number(process.env.NOTICE_FAILURE_RETRY_MINUTES);
  const failureRetryMinutes = Number.isFinite(configuredFailureRetry) && configuredFailureRetry > 0
    ? configuredFailureRetry
    : 5;
  const intervalMinutes = website.lastCheckStatus === 'failed'
    ? Math.min(normalIntervalMinutes, failureRetryMinutes)
    : normalIntervalMinutes;
  const intervalMs = intervalMinutes * 60 * 1000;
  return now - lastTime >= intervalMs;
}

class SchedulerService {
  private cronTask: ScheduledTask | null = null;
  private isChecking = false;

  public start() {
    if (this.cronTask) return;
    console.log('[Scheduler] Initializing automated notice monitoring cron job...');

    // Master scheduler runs every minute and inspects website intervals
    this.cronTask = cron.schedule('* * * * *', async () => {
      await this.runDueChecks();
    });

    void this.runDueChecks();

    console.log('[Scheduler] Cron job active (checking intervals every minute).');
  }

  public stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      console.log('[Scheduler] Cron job stopped.');
    }
  }

  /**
   * Inspect all enabled websites and run scraper on any website whose interval has elapsed
   */
  public async runDueChecks() {
    if (this.isChecking) {
      console.log('[Scheduler] Previous check cycle is still active, skipping tick.');
      return;
    }

    this.isChecking = true;
    try {
      const websites = db.getWebsites(false); // enabled only
      const now = Date.now();

      for (const site of websites) {
        if (isWebsiteDue(site, now)) {
          console.log(`[Scheduler] Checking due website: ${site.name} (Interval: ${site.intervalMinutes}m)`);
          await scraper.scrapeWebsite(site);
          // Polite rate-limiting pause
          await new Promise(r => setTimeout(r, 1200));
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error during scheduled check run:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Force an immediate check for a specific website or all websites
   */
  public async triggerManual(websiteId?: string) {
    if (websiteId) {
      const website = db.getWebsiteById(websiteId);
      if (!website) {
        throw new Error(`Website with ID ${websiteId} not found`);
      }
      return await scraper.scrapeWebsite(website, true);
    } else {
      return await scraper.scrapeAllActiveWebsites();
    }
  }
}

export const scheduler = new SchedulerService();
