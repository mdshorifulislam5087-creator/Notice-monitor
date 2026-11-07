/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'node:crypto';
import { Website, Notice, Subscriber, Subscription, AlertLog, CheckLog, SystemStats, AdminSettings } from './types.js';
import { reconcileManagedWebsites, SEED_WEBSITES, SEED_NOTICES } from './seed.js';
import { isAuthorizedSubscriber } from './security.js';

interface DatabaseSchema {
  websites: Website[];
  notices: Notice[];
  subscribers: Subscriber[];
  subscriptions: Subscription[];
  alert_logs: AlertLog[];
  check_logs: CheckLog[];
  settings?: AdminSettings;
}

type LegacyWebsite = Website & { creatorTelegramChatId?: string };
type LegacySubscriber = Subscriber & { telegramChatId?: string };
type LegacyAlertLog = Omit<AlertLog, 'channel'> & {
  channel: 'email' | 'telegram';
  telegramChatId?: string;
};

const DATA_DIR = path.resolve(process.env.NOTICEBONDHU_DATA_DIR || path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseService {
  private data: DatabaseSchema = {
    websites: [],
    notices: [],
    subscribers: [],
    subscriptions: [],
    alert_logs: [],
    check_logs: [],
    settings: {
      requireCustomApproval: false
    }
  };
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure all collections exist
        this.data.websites = this.data.websites || [];
        this.data.notices = this.data.notices || [];
        this.data.subscribers = this.data.subscribers || [];
        this.data.subscriptions = this.data.subscriptions || [];
        this.data.alert_logs = this.data.alert_logs || [];
        this.data.check_logs = this.data.check_logs || [];
        this.data.settings = this.data.settings || { requireCustomApproval: false };
      } else {
        // Seed with initial sample websites and notices
        this.data.websites = [...SEED_WEBSITES];
        this.data.notices = [...SEED_NOTICES];
        this.data.subscribers = [];
        this.data.subscriptions = [];
        this.data.alert_logs = [];
        this.data.check_logs = [];
        this.save();
      }
      this.data.websites = reconcileManagedWebsites(this.data.websites);
      this.data.websites = (this.data.websites as LegacyWebsite[]).map(({ creatorTelegramChatId, ...website }) => website);
      this.data.subscribers = (this.data.subscribers as LegacySubscriber[]).map(({ telegramChatId, ...subscriber }) => subscriber);
      this.data.alert_logs = (this.data.alert_logs as LegacyAlertLog[])
        .filter(log => log.channel === 'email')
        .map(({ telegramChatId, ...log }) => log as AlertLog);
      this.save();
      this.isLoaded = true;
    } catch (err) {
      console.error('[DB] Failed to initialize file storage:', err);
      // Fallback in-memory
      this.data.websites = [...SEED_WEBSITES];
      this.data.notices = [...SEED_NOTICES];
    }
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Failed to save state to disk:', err);
    }
  }

  // --- Websites ---
  public normalizeUrl(rawUrl: string): string {
    try {
      const u = new URL(rawUrl.trim());
      // remove trailing slash and hash/search params that don't affect notice page
      let clean = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
      if (u.search) clean += u.search;
      return clean.toLowerCase();
    } catch {
      return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
    }
  }

  public getWebsites(includeDisabled = true): Website[] {
    if (includeDisabled) {
      return this.data.websites;
    }
    // Public view: must be enabled and either approved or without approvalStatus
    return this.data.websites.filter(
      w => w.enabled && (w.approvalStatus === undefined || w.approvalStatus === 'approved')
    );
  }

  public getWebsiteById(id: string): Website | undefined {
    return this.data.websites.find(w => w.id === id);
  }

  public getWebsiteByUrl(url: string): Website | undefined {
    const norm = this.normalizeUrl(url);
    return this.data.websites.find(w => this.normalizeUrl(w.url) === norm);
  }

  public getCustomWebsitesCountByEmail(email: string): number {
    const clean = email.trim().toLowerCase();
    return this.data.websites.filter(
      w => w.isCustom && w.creatorEmail?.toLowerCase() === clean
    ).length;
  }

  public getSettings(): AdminSettings {
    return this.data.settings || { requireCustomApproval: false };
  }

  public updateSettings(updates: Partial<AdminSettings>): AdminSettings {
    this.data.settings = { ...this.getSettings(), ...updates };
    this.save();
    return this.data.settings;
  }

  public addWebsite(website: Omit<Website, 'id' | 'createdAt'>): Website {
    const id = website.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `site-${Date.now()}`;
    // Generate unique ID if already taken
    let finalId = id;
    let counter = 1;
    while (this.data.websites.some(w => w.id === finalId)) {
      finalId = `${id}-${counter++}`;
    }

    const defaultApproval = website.isCustom
      ? (this.getSettings().requireCustomApproval ? 'pending' : 'approved')
      : 'approved';

    const newSite: Website = {
      ...website,
      id: finalId,
      approvalStatus: website.approvalStatus || defaultApproval,
      createdAt: new Date().toISOString()
    };
    this.data.websites.unshift(newSite);
    this.save();
    return newSite;
  }

  public updateWebsite(id: string, updates: Partial<Website>): Website | null {
    const idx = this.data.websites.findIndex(w => w.id === id);
    if (idx === -1) return null;
    this.data.websites[idx] = { ...this.data.websites[idx], ...updates };
    this.save();
    return this.data.websites[idx];
  }

  public deleteWebsite(id: string): boolean {
    const initialLen = this.data.websites.length;
    this.data.websites = this.data.websites.filter(w => w.id !== id);
    if (this.data.websites.length !== initialLen) {
      // also cleanup subscriptions
      this.data.subscriptions = this.data.subscriptions.filter(s => s.websiteId !== id);
      this.save();
      return true;
    }
    return false;
  }

  // --- Notices ---
  public getNotices(params: {
    websiteId?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): { notices: Notice[]; total: number; page: number; totalPages: number } {
    const { websiteId, category, search, page = 1, limit = 10 } = params;
    let list = [...this.data.notices];

    if (websiteId) {
      list = list.filter(n => n.websiteId === websiteId);
    }
    if (category && category !== 'all') {
      list = list.filter(n => n.category === category);
    }
    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      list = list.filter(
        n =>
          n.title.toLowerCase().includes(q) ||
          n.websiteName.toLowerCase().includes(q) ||
          n.websiteNameBn.toLowerCase().includes(q)
      );
    }

    // Sort newest detected first
    list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      notices: paginated,
      total,
      page,
      totalPages
    };
  }

  public hasNotice(websiteId: string, link: string): boolean {
    const normLink = link.trim().toLowerCase();
    return this.data.notices.some(
      n => n.websiteId === websiteId && n.link.trim().toLowerCase() === normLink
    );
  }

  public addNotice(notice: Omit<Notice, 'id' | 'detectedAt'>): Notice {
    const newNotice: Notice = {
      ...notice,
      id: `notice-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      detectedAt: new Date().toISOString()
    };
    this.data.notices.unshift(newNotice);
    this.save();
    return newNotice;
  }

  // --- Subscribers & Subscriptions ---
  public getSubscribers(): (Omit<Subscriber, 'unsubToken'> & { subscribedWebsites: string[] })[] {
    return this.data.subscribers.map(sub => {
      const siteIds = this.data.subscriptions
        .filter(s => s.subscriberId === sub.id)
        .map(s => s.websiteId);
      const { unsubToken, ...publicSubscriber } = sub;
      return {
        ...publicSubscriber,
        subscribedWebsites: siteIds
      };
    });
  }

  public getSubscriberByEmail(email: string): Subscriber | undefined {
    return this.data.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
  }

  public getSubscriberByUnsubToken(token: string): Subscriber | undefined {
    return this.data.subscribers.find(s => s.unsubToken === token);
  }

  public subscribe(payload: {
    name: string;
    email: string;
    websiteIds: string[];
    ownershipToken?: string;
  }): { subscriber: Subscriber; subscribedCount: number; isNew: boolean } {
    const cleanEmail = payload.email.trim().toLowerCase();
    let subscriber = this.getSubscriberByEmail(cleanEmail);
    let isNew = false;

    if (!subscriber) {
      isNew = true;
      subscriber = {
        id: `sub-${randomUUID()}`,
        name: payload.name.trim(),
        email: cleanEmail,
        isActive: true,
        createdAt: new Date().toISOString(),
        unsubToken: randomBytes(32).toString('base64url')
      };
      this.data.subscribers.push(subscriber);
    } else {
      if (!isAuthorizedSubscriber(subscriber.unsubToken, payload.ownershipToken)) {
        throw new Error('OWNERSHIP_TOKEN_REQUIRED');
      }
      // update existing
      subscriber.name = payload.name.trim() || subscriber.name;
      subscriber.isActive = true;
    }

    // Remove old subscriptions for this subscriber
    this.data.subscriptions = this.data.subscriptions.filter(s => s.subscriberId !== subscriber.id);

    // Add new subscriptions
    for (const siteId of payload.websiteIds) {
      if (this.data.websites.some(w => w.id === siteId)) {
        this.data.subscriptions.push({
          id: `subs-${randomUUID()}`,
          subscriberId: subscriber.id,
          websiteId: siteId,
          createdAt: new Date().toISOString()
        });
      }
    }

    this.save();
    const count = this.data.subscriptions.filter(s => s.subscriberId === subscriber.id).length;
    return { subscriber, subscribedCount: count, isNew };
  }

  public unsubscribe(token: string, websiteId?: string): { success: boolean; message: string } {
    const subscriber = this.getSubscriberByUnsubToken(token);

    if (!subscriber) {
      return { success: false, message: 'Subscriber not found' };
    }

    if (websiteId) {
      this.data.subscriptions = this.data.subscriptions.filter(
        s => !(s.subscriberId === subscriber.id && s.websiteId === websiteId)
      );
      this.save();
      return { success: true, message: 'Unsubscribed from specified website' };
    } else {
      // Unsubscribe all
      subscriber.isActive = false;
      this.data.subscriptions = this.data.subscriptions.filter(s => s.subscriberId !== subscriber.id);
      this.save();
      return { success: true, message: 'Successfully unsubscribed from all alerts' };
    }
  }

  public getSubscribersForWebsite(websiteId: string): Subscriber[] {
    const subIds = this.data.subscriptions
      .filter(s => s.websiteId === websiteId)
      .map(s => s.subscriberId);

    return this.data.subscribers.filter(s => s.isActive && subIds.includes(s.id));
  }

  // --- Logs ---
  public addAlertLog(log: Omit<AlertLog, 'id' | 'sentAt'>): AlertLog {
    const newLog: AlertLog = {
      ...log,
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sentAt: new Date().toISOString()
    };
    this.data.alert_logs.unshift(newLog);
    // Keep max 500 logs to prevent memory balloon
    if (this.data.alert_logs.length > 500) {
      this.data.alert_logs = this.data.alert_logs.slice(0, 500);
    }
    this.save();
    return newLog;
  }

  public addCheckLog(log: Omit<CheckLog, 'id' | 'checkedAt'>): CheckLog {
    const newLog: CheckLog = {
      ...log,
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      checkedAt: new Date().toISOString()
    };
    this.data.check_logs.unshift(newLog);
    if (this.data.check_logs.length > 500) {
      this.data.check_logs = this.data.check_logs.slice(0, 500);
    }
    this.save();
    return newLog;
  }

  public getCheckLogs(limit = 50): CheckLog[] {
    return this.data.check_logs.slice(0, limit);
  }

  public getAlertLogs(limit = 50): AlertLog[] {
    return this.data.alert_logs.slice(0, limit);
  }

  // --- Stats ---
  public getStats(): SystemStats {
    const totalSubscribers = this.data.subscribers.filter(s => s.isActive).length;
    const totalNotices = this.data.notices.length;
    const totalWebsites = this.data.websites.length;
    const activeWebsites = this.data.websites.filter(w => w.enabled).length;
    const totalAlertsSent = this.data.alert_logs.length;

    let lastRunAt: string | null = null;
    if (this.data.check_logs.length > 0) {
      lastRunAt = this.data.check_logs[0].checkedAt;
    }

    return {
      totalSubscribers,
      totalNotices,
      totalWebsites,
      activeWebsites,
      totalAlertsSent,
      lastRunAt
    };
  }
}

export const db = new DatabaseService();
