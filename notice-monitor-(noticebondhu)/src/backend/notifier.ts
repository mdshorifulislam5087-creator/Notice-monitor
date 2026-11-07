/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer, { Transporter } from 'nodemailer';
import { Notice, Subscriber } from './types.js';
import { db } from './db.js';
import { escapeHtml, safeNotificationUrl } from './security.js';

export class NotifierService {
  private transporter: Transporter | null = null;
  private appUrl: string;

  constructor() {
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = process.env.SMTP_SECURE === 'true';

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass }
        });
        console.log('[Notifier] SMTP Transporter configured for', user);
      } catch (err) {
        console.error('[Notifier] Failed to create SMTP transporter:', err);
        this.transporter = null;
      }
    } else {
      console.log('[Notifier] SMTP credentials not fully provided; emails will run in simulation/log mode.');
    }
  }

  /**
   * Dispatch notice alerts to all active email subscribers.
   */
  public async dispatchAlerts(notice: Notice, subscribers: Subscriber[]) {
    for (const sub of subscribers) {
      if (!sub.isActive) continue;

      if (sub.email) {
        await this.sendEmailAlert(sub, notice);
      }

      // Subtle pause between dispatches to avoid SMTP rate limits.
      await new Promise(r => setTimeout(r, 200));
    }
  }

  /**
   * Send email alert using Nodemailer with responsive HTML template and unsubscribe link
   */
  public async sendEmailAlert(
    subscriber: Subscriber,
    notice: Notice
  ): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
    const fromAddress = process.env.SMTP_FROM || 'NoticeBondhu Alerts <alerts@noticebondhu.edu.bd>';
    const unsubUrl = `${this.appUrl}?view=unsubscribe&token=${encodeURIComponent(subscriber.unsubToken)}`;
    const recipientName = escapeHtml(subscriber.name || 'শিক্ষার্থী');
    const websiteName = escapeHtml(notice.websiteNameBn || notice.websiteName);
    const noticeTitle = escapeHtml(notice.title);
    const publishDate = notice.publishDate ? escapeHtml(notice.publishDate) : '';
    const noticeLink = escapeHtml(safeNotificationUrl(notice.link));

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #0f766e, #0369a1); color: #ffffff; padding: 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 700; }
          .badge { display: inline-block; background: #fef08a; color: #854d0e; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
          .content { padding: 28px; }
          .notice-box { background: #f8fafc; border-left: 4px solid #0f766e; padding: 18px; border-radius: 6px; margin: 20px 0; }
          .notice-title { font-size: 17px; font-weight: 600; color: #0f172a; line-height: 1.5; margin-bottom: 8px; }
          .notice-meta { font-size: 13px; color: #64748b; }
          .btn { display: inline-block; background: #0f766e; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-top: 15px; }
          .footer { background: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
          .footer a { color: #0284c7; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 নতুন নোটিশ প্রকাশ</h1>
            <div class="badge">নোটিশবন্ধু (NoticeBondhu) সতর্কবার্তা</div>
          </div>
          <div class="content">
            <p>প্রিয় <strong>${recipientName}</strong>,</p>
            <p>আপনার সাবস্ক্রাইব করা প্রতিষ্ঠান থেকে একটি নতুন নোটিশ প্রকাশিত হয়েছে:</p>
            
            <div class="notice-box">
              <div class="notice-meta">🏛 <strong>${websiteName}</strong></div>
              <div class="notice-title">${noticeTitle}</div>
              ${publishDate ? `<div class="notice-meta">📅 প্রকাশের তারিখ: ${publishDate}</div>` : ''}
              
              <div style="margin-top: 14px;">
                <a href="${noticeLink}" class="btn" target="_blank" rel="noopener noreferrer">মূল নোটিশ / PDF দেখুন ➔</a>
              </div>
            </div>
            
            <p style="font-size: 13px; color: #475569; margin-top: 20px;">
              জরুরি প্রয়োজনে বন্ধুদের সাথে নোটিশটি শেয়ার করতে পারেন।
            </p>
          </div>
          <div class="footer">
            <p>আপনি NoticeBondhu এ নোটিশ অ্যালার্টের জন্য সাবস্ক্রাইব করেছিলেন।</p>
            <p><a href="${escapeHtml(unsubUrl)}">আনসাবস্ক্রাইব করতে এখানে ক্লিক করুন (Unsubscribe)</a></p>
            <p>© ${new Date().getFullYear()} NoticeBondhu - Bangladesh Academic Notice Monitor</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Check if transporter is available
    if (!this.transporter) {
      console.log(`[Notifier:Email:Simulated] To: ${subscriber.email} | Notice: ${notice.title}`);
      db.addAlertLog({
        subscriberId: subscriber.id,
        subscriberEmail: subscriber.email,
        noticeId: notice.id,
        noticeTitle: notice.title,
        websiteName: notice.websiteName,
        channel: 'email',
        status: 'simulated'
      });
      return { success: true, simulated: true };
    }

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: subscriber.email,
        subject: `[নতুন নোটিশ] ${notice.websiteNameBn || notice.websiteName}: ${notice.title.substring(0, 60)}...`.replace(/[\r\n]+/g, ' '),
        html: htmlContent
      });

      db.addAlertLog({
        subscriberId: subscriber.id,
        subscriberEmail: subscriber.email,
        noticeId: notice.id,
        noticeTitle: notice.title,
        websiteName: notice.websiteName,
        channel: 'email',
        status: 'sent'
      });
      return { success: true };
    } catch (err: any) {
      const errMsg = err?.message || 'SMTP dispatch error';
      console.error(`[Notifier:Email:Error] ${errMsg}`);
      db.addAlertLog({
        subscriberId: subscriber.id,
        subscriberEmail: subscriber.email,
        noticeId: notice.id,
        noticeTitle: notice.title,
        websiteName: notice.websiteName,
        channel: 'email',
        status: 'failed',
        error: errMsg
      });
      return { success: false, error: errMsg };
    }
  }

  public async sendSubscriptionWelcome(subscriber: Subscriber): Promise<void> {
    if (!this.transporter) {
      console.log(`[Notifier:Email:Simulated] Welcome message for: ${subscriber.email}`);
      return;
    }

    const managementUrl = safeNotificationUrl(
      `${this.appUrl}?view=unsubscribe&token=${encodeURIComponent(subscriber.unsubToken)}`
    );
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'NoticeBondhu Alerts <alerts@noticebondhu.edu.bd>',
      to: subscriber.email,
      subject: 'NoticeBondhu subscription management link',
      html: `
        <p>প্রিয় ${escapeHtml(subscriber.name || 'শিক্ষার্থী')},</p>
        <p>Your NoticeBondhu subscription is active. Keep this private link to manage or unsubscribe:</p>
        <p><a href="${escapeHtml(managementUrl)}">Manage NoticeBondhu subscription</a></p>
        <p>This link contains your private management token. Do not share it.</p>
      `
    });
  }

}

export const notifier = new NotifierService();
