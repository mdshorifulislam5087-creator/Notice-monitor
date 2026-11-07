/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'bn' | 'en';
export type Theme = 'light' | 'dark';
export type PageView = 'home' | 'subscribe' | 'notices' | 'admin' | 'unsubscribe';
export type WebsiteCategory = 'board' | 'university' | 'college' | 'government' | 'public_service' | 'other';

export interface WebsitePublic {
  id: string;
  name: string;
  nameBn: string;
  url: string;
  category: WebsiteCategory;
  intervalMinutes: number;
  enabled: boolean;
  isJsHeavy?: boolean;
  isCustom?: boolean;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  lastCheckedAt?: string;
  lastCheckStatus?: 'success' | 'failed' | 'pending';
  totalNoticesFound?: number;
}

export interface WebsiteAdmin extends WebsitePublic {
  selector: string;
  creatorEmail?: string;
  lastCheckError?: string;
  createdAt: string;
}

export interface NoticeItem {
  id: string;
  websiteId: string;
  websiteName: string;
  websiteNameBn: string;
  title: string;
  link: string;
  detectedAt: string;
  publishDate?: string;
  category: 'board' | 'university' | 'college' | 'government' | 'public_service';
}

export interface SystemStats {
  totalSubscribers: number;
  totalNotices: number;
  totalWebsites: number;
  activeWebsites: number;
  totalAlertsSent: number;
  lastRunAt: string | null;
}

export interface CheckLogItem {
  id: string;
  websiteId: string;
  websiteName: string;
  status: 'success' | 'failed';
  noticesFound: number;
  newNoticesCount: number;
  durationMs: number;
  error?: string;
  checkedAt: string;
}

export interface AlertLogItem {
  id: string;
  subscriberEmail: string;
  noticeTitle: string;
  websiteName: string;
  channel: 'email';
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
  sentAt: string;
}

export interface SubscriberItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  subscribedWebsites: string[];
}
