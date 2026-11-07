# Notice Monitor (NoticeBondhu - নোটিশবন্ধু) 🇧🇩

> **Automated Notice Monitor & Email Alert System for Bangladeshi Students**
> Automatically detects new notices on college, education board, and government websites, then sends SMTP email alerts to subscribers.

---

## 🌟 Features

- **Tavily Notice Extraction**: Uses Tavily Extract on each exact source page to monitor All Notice, MRIST, BTEB, and DUET every hour.
- **Custom-site Scraper**: User-submitted notice pages still use the SSRF-protected Cheerio/axios detector with custom CSS selectors.
- **Diff & New Notice Isolation**: Detects genuine new circulars and avoids sending duplicate alerts or spamming baseline existing notices on initial runs.
- **Nodemailer SMTP**: Responsive HTML emails in Bangla and English containing official notice details and a secure 1-click unsubscribe link.
- **Admin Control Suite**:
  - Add / edit / delete monitored websites (name, URL, selector, 15m/1h/6h intervals, toggle).
  - Live scraper test trigger and immediate manual check.
  - "Simulate Notice" button to test the email delivery pipeline end-to-end.
  - Comprehensive audit logs (scrape checks, duration, alert delivery logs, subscribers).
- **Bangla + English Support**: Default Bangla with instant toggle switch and Hind Siliguri typography.
- **Dark & Light Mode**: Auto-persisted theme.

---

## 📁 Project Architecture

```
├── /data                    # Persistent JSON store for websites, notices, and logs
├── /src
│   ├── /backend             # Backend services & scraper engine
│   │   ├── types.ts         # Data models (Website, Notice, Subscriber, Logs)
│   │   ├── db.ts            # Local JSON persistence layer
│   │   ├── seed.ts          # Seed data with Bangladeshi educational boards & universities
│   │   ├── tavily.ts       # Exact-page Tavily Extract client
│   │   ├── scraper.ts       # Tavily/direct collection, diffing, persistence, alerts
│   │   ├── scheduler.ts     # node-cron scheduler for periodic checks
│   │   ├── notifier.ts      # Nodemailer SMTP email dispatcher
│   │   └── routes.ts        # Express REST API routes (/api/*)
│   ├── /frontend            # React frontend UI
│   │   ├── types.ts         # Frontend interfaces
│   │   ├── translations.ts  # Bangla (default) & English i18n
│   │   └── /components
│   │       ├── Navbar.tsx   # Header, branding, language & theme switches
│   │       ├── Hero.tsx     # Hero banner, stats pills, CTA
│   │       ├── HowItWorks.tsx # 4-step illustrated guide
│   │       ├── WebsiteDirectory.tsx # Supported websites catalog & category filter
│   │       ├── SubscribeView.tsx # Student email subscription form
│   │       ├── NoticesView.tsx # Searchable, paginated live notices feed
│   │       ├── AdminDashboard.tsx # Password-protected admin suite & test tools
│   │       ├── UnsubscribeView.tsx # 1-click unsubscribe handler
│   │       └── Footer.tsx   # Bangladeshi student sentinel credits & links
├── .env.example             # Safe environment-variable template
├── server.ts                # Full-stack Express server (Vite middleware in dev)
├── package.json
└── README.md
```

---

## 🚀 Step-by-Step Setup Guide

### 1. How to Run Locally

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Create your `.env` configuration file:**
   ```bash
   cp .env.example .env
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

---

### 2. Configure Tavily

Create a Tavily API key and set it only in `.env` or your deployment environment:

```env
TAVILY_API_KEY="tvly-your-key"
TAVILY_EXTRACT_DEPTH="advanced"
NOTICE_FAILURE_RETRY_MINUTES="5"
```

The key is sent as a Bearer token to `https://api.tavily.com/extract`. Each request targets the configured notice page, and extracted links are restricted to that source domain. The first successful run creates a baseline without emailing old notices; later runs save and alert only newly discovered URLs.

Official Tavily API reference: https://docs.tavily.com/documentation/api-reference/endpoint/extract

### 3. How to Set Up Gmail SMTP App Password

To send beautiful HTML email notifications via Gmail:

1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Enable **2-Step Verification** if not already enabled.
3. Search for **"App passwords"** in the top search bar (or go to `Security` > `2-Step Verification` > `App passwords`).
4. Enter an app name (e.g., `NoticeBondhu`) and click **Create**.
5. Google will display a **16-character code** (e.g., `abcd efgh ijkl mnop`).
6. Add your credentials into `.env`:
   ```env
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="your-email@gmail.com"
   SMTP_PASS="abcdefghijklmnop"
   SMTP_FROM="NoticeBondhu Alerts <your-email@gmail.com>"
   ```

*(Note: If SMTP is not configured, NoticeBondhu runs in simulation/audit mode without crashing, so you can test all features effortlessly).*

---

### 4. Data Storage

NoticeBondhu currently stores state in `data/db.json`. The file is created automatically and is intentionally ignored by Git because it contains subscriber information and operational logs.

For production, mount a persistent disk and point `NOTICEBONDHU_DATA_DIR` to it (the default is `./data`). Run a single application instance: ephemeral filesystems or multiple replicas can lose or overwrite state. A managed database adapter is required before horizontally scaling the service.

---

### 5. How to Deploy to Render or Railway

#### Option A: Deploy on Render
1. Push your code to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New +** > **Web Service**.
3. Connect your repository.
4. Set the following settings:
   - **Environment:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
5. In **Environment Variables**, add:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `ADMIN_PASSWORD=your-long-unique-password`
   - `ADMIN_SESSION_SECRET=at-least-32-random-characters`
   - `TAVILY_API_KEY=...`
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_SECURE=false`
   - `SMTP_USER=...`
   - `SMTP_PASS=...`
   - `SMTP_FROM=NoticeBondhu Alerts <your-email@gmail.com>`
6. Click **Deploy Web Service**!

#### Option B: Deploy on Railway
1. Go to [Railway.app](https://railway.app) and create a **New Project**.
2. Select **Deploy from GitHub repo**.
3. Under service settings, add your Environment Variables (`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `TAVILY_API_KEY`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).
4. Railway will automatically detect Node.js, run `npm run build`, and execute `npm start`.

---

## 🏫 Custom Website & Auto-Detect Engine

NoticeBondhu empowers any student or institution to add their college, university, or department website to the monitoring sentinel without needing to know HTML or CSS selectors.

### 1. Smart Heuristic Auto-Detection (`POST /api/websites/test`)
- **How it works**: Analyzes the page DOM tree using structural link heuristics (`table tr td a`, `li a`, repeating list containers), scores candidate selectors against notice keywords (`notice`, `circular`, `routine`, `result`, `নোটিশ`, `বিজ্ঞপ্তি`, `.pdf`), and discards navigational links (`header`, `nav`, `footer`).
- **Preview**: Displays the top 5 notices discovered (with titles and links) and reveals the inferred selector before saving.
- **Rate Limit**: Max 10 test requests per IP per hour.
- **SSRF Protection**: Strict host validation; loopback (`127.0.0.1`), link-local/cloud metadata (`169.254.169.254`), and private IPv4/IPv6 CIDR blocks are blocked.

### 2. User Submission & Auto-Subscription (`POST /api/websites/custom`)
- **Auto-Subscription**: The submitting user's email is automatically subscribed to their new custom portal.
- **Duplicate Prevention**: If the normalized URL is already monitored, the system avoids creating duplicates and seamlessly subscribes the user to the existing portal.
- **Baseline Run**: On the first check, existing notices are cataloged without sending spam alerts.
- **Quota**: Max 5 custom websites per email.
- **Admin Review Option**: Admin dashboard has a toggle to mandate admin approval for new custom websites before they appear publicly.

---

## 📡 REST API Reference

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/websites` | GET | Public | List all active monitored websites |
| `/api/websites/test` | POST | Public (Rate-limited) | Test & auto-detect notices from a URL |
| `/api/websites/custom` | POST | Public (Rate-limited) | Add a custom website & auto-subscribe |
| `/api/notices` | GET | Public | Search, filter, and paginate detected notices |
| `/api/subscribe` | POST | Public | Subscribe to notice alerts via email |
| `/api/unsubscribe` | POST | Public | 1-click unsubscribe from alerts |
| `/api/stats` | GET | Public | Public monitor statistics |
| `/api/admin/login` | POST | Public | Authenticate admin password |
| `/api/admin/websites` | GET, POST | Admin | Manage monitored websites |
| `/api/admin/websites/:id` | PUT, DELETE | Admin | Update or remove website |
| `/api/admin/websites/:id/approve` | PUT | Admin | Approve pending custom website |
| `/api/admin/websites/:id/reject` | PUT | Admin | Disable / reject custom website |
| `/api/admin/settings` | GET, PUT | Admin | Toggle custom website approval mode |
| `/api/admin/scrape-all` | POST | Admin | Trigger immediate crawl across all sites |
| `/api/admin/simulate-notice` | POST | Admin | Trigger simulated notice to test alerts |
| `/api/admin/logs` | GET | Admin | View check logs and alert dispatch logs |
| `/api/admin/subscribers` | GET | Admin | View subscriber list |

Updating an existing subscription requires its `ownershipToken`. Unsubscribe requests require the secure token from the email link; an email address alone is never accepted as authorization.

---

## 🛡 Admin Authentication

- Set both `ADMIN_PASSWORD` and a random `ADMIN_SESSION_SECRET` of at least 32 characters. There is no default password.
- Successful login creates a signed, `httpOnly`, `SameSite=Strict` session cookie; the password is never returned to the browser or stored in `localStorage`.
- Navigate to the **Admin Dashboard** tab to manage websites, run checks, and view logs.
