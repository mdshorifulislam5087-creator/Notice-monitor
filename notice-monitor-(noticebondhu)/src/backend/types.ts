/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WebsiteCategory = 'board' | 'university' | 'college' | 'government' | 'public_service' | 'other';

export interface Website {
  id: string;
  name: string;
  nameBn: string;
  url: string;
  selector: string;
  category: WebsiteCategory;
  intervalMinutes: number; // 15, 60, 360
  enabled: boolean;
  isJsHeavy?: boolean;
  fetchMode?: 'direct' | 'tavily';
  tavilyExtractUrl?: string;
  isCustom?: boolean;
  creatorEmail?: string;
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  lastCheckedAt?: string;
  lastCheckStatus?: 'success' | 'failed' | 'pending';
  lastCheckError?: string;
  totalNoticesFound?: number;
  createdAt: string;
}

export interface AdminSettings {
  requireCustomApproval: boolean;
}

export interface Notice {
  id: string;
  websiteId: string;
  websiteName: string;
  websiteNameBn: string;
  title: string;
  link: string;
  detectedAt: string;
  publishDate?: string;
  isInitialRun?: boolean;
  category: WebsiteCategory;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  unsubToken: string;
}

export interface Subscription {
  id: string;
  subscriberId: string;
  websiteId: string;
  createdAt: string;
}

export interface AlertLog {
  id: string;
  subscriberId: string;
  subscriberEmail: string;
  noticeId: string;
  noticeTitle: string;
  websiteName: string;
  channel: 'email';
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
  sentAt: string;
}

export interface CheckLog {
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

export interface SystemStats {
  totalSubscribers: number;
  totalNotices: number;
  totalWebsites: number;
  activeWebsites: number;
  totalAlertsSent: number;
  lastRunAt: string | null;
}
