/**
 * Tavily Extract integration for monitored notice discovery.
 * API contract: https://docs.tavily.com/documentation/api-reference/endpoint/extract
 */

import { load } from 'cheerio';
import { Website } from './types.js';

export interface TavilyNoticeItem {
  title: string;
  link: string;
  publishDate?: string;
}

interface TavilyExtractResult {
  url?: unknown;
  raw_content?: unknown;
}

interface TavilyExtractResponse { results?: unknown; }
interface MristEntry { id?: unknown; cat_name?: unknown; created_at?: unknown; }
type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function normalizedDomain(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isAllowedResultUrl(rawUrl: string, allowedDomain: string, baseUrl: string): URL | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const resultDomain = normalizedDomain(url.hostname);
    if (resultDomain !== allowedDomain && !resultDomain.endsWith(`.${allowedDomain}`)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function cleanTitle(value: string): string {
  return load(`<body>${value}</body>`).text().replace(/\s+/g, ' ').trim();
}

function extractDepth(): 'basic' | 'advanced' {
  return process.env.TAVILY_EXTRACT_DEPTH === 'basic' ? 'basic' : 'advanced';
}

function parseMristJson(rawContent: string, website: Website): TavilyNoticeItem[] {
  let payload: unknown;
  // Tavily's Markdown renderer adds escapes such as \_ and \) inside JSON
  // string values. Remove only escapes that JSON itself does not recognize.
  const normalizedJson = rawContent.replace(/\\([^"\\/bfnrtu])/g, '$1');
  try {
    payload = JSON.parse(normalizedJson);
  } catch {
    const recovered: MristEntry[] = [];
    const rowPattern = /"id":(\d+),"cat\\?_name":"([\s\S]*?)","description":[\s\S]*?,"created\\?_at":"([^"]+)"/g;
    for (const match of rawContent.matchAll(rowPattern)) {
      const title = match[2]
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .replace(/\\(["\\/bfnrt])/g, (_, escaped: string) => ({
          '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t'
        })[escaped] || escaped)
        .replace(/\\([^"\\/bfnrtu])/g, '$1');
      recovered.push({ id: match[1], cat_name: title, created_at: match[3] });
    }
    payload = recovered;
  }
  const rows = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : []);

  return (rows as MristEntry[])
    .filter(row => (typeof row.id === 'number' || typeof row.id === 'string') && typeof row.cat_name === 'string')
    .sort((left, right) => {
      const rightTime = typeof right.created_at === 'string' ? Date.parse(right.created_at) || 0 : 0;
      const leftTime = typeof left.created_at === 'string' ? Date.parse(left.created_at) || 0 : 0;
      return rightTime - leftTime || Number(right.id) - Number(left.id);
    })
    .map(row => ({
      title: cleanTitle(row.cat_name as string),
      link: new URL(`/view-notice/${encodeURIComponent(String(row.id))}`, website.url).href,
      publishDate: typeof row.created_at === 'string' ? row.created_at : undefined
    }))
    .filter(item => item.title.length > 0)
    .slice(0, 25);
}

function parseMarkdown(rawContent: string, website: Website): TavilyNoticeItem[] {
  const allowedDomain = normalizedDomain(new URL(website.url).hostname);
  const notices: TavilyNoticeItem[] = [];
  const seenLinks = new Set<string>();
  let currentDate: string | undefined;

  const addNotice = (titleValue: string, linkValue: string, publishDate?: string) => {
    const title = cleanTitle(titleValue);
    const link = isAllowedResultUrl(linkValue.trim(), allowedDomain, website.url);
    if (!title || !link) return;
    const key = link.href.toLowerCase();
    if (seenLinks.has(key)) return;
    seenLinks.add(key);
    notices.push({ title, link: link.href, publishDate });
  };

  for (const rawLine of rawContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^\d{2}\s+[A-Z]{3}\s+\d{4}$/.test(line)) {
      currentDate = line;
      continue;
    }
    const heading = line.match(/^#{4,6}\s+\[([^\]]+)]\(\s*([^)]+?)\s*\)/);
    if (heading && currentDate) {
      addNotice(heading[1], heading[2], currentDate);
      continue;
    }
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length < 6 || !/^(?:\d+|[০-৯]+)$/.test(cells[0])) continue;
    const actionLink = cells[5].match(/\[[^\]]+]\(\s*([^)]+?)\s*\)/);
    if (actionLink) addNotice(cells[1], actionLink[1], cells[4] || undefined);
  }
  return notices.slice(0, 25);
}

export class TavilyNoticeProvider {
  constructor(
    private readonly apiKey = process.env.TAVILY_API_KEY || '',
    private readonly fetchImplementation: FetchImplementation = fetch
  ) {}

  public async fetchNotices(website: Website): Promise<TavilyNoticeItem[]> {
    const apiKey = this.apiKey.trim();
    if (!apiKey) throw new Error('TAVILY_API_KEY is not configured');
    const extractUrl = website.tavilyExtractUrl?.trim() || website.url;
    const allowedDomain = normalizedDomain(new URL(website.url).hostname);
    const configuredExtractUrl = isAllowedResultUrl(extractUrl, allowedDomain, website.url);
    if (!configuredExtractUrl) throw new Error(`Invalid Tavily extract URL for ${website.name}`);

    const response = await this.fetchImplementation('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        urls: configuredExtractUrl.href,
        extract_depth: extractDepth(),
        format: website.id === 'mrist-notices' ? 'text' : 'markdown',
        include_images: false,
        include_favicon: false,
        include_usage: true,
        timeout: 30
      }),
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) throw new Error(`Tavily request failed with status ${response.status}`);

    const payload = await response.json() as TavilyExtractResponse;
    if (!Array.isArray(payload.results)) {
      throw new Error(`Tavily returned an invalid extract response for ${website.name}`);
    }
    const result = (payload.results as TavilyExtractResult[]).find(candidate => {
      if (typeof candidate?.url !== 'string' || typeof candidate?.raw_content !== 'string') return false;
      return Boolean(isAllowedResultUrl(candidate.url, allowedDomain, website.url));
    });
    if (!result || typeof result.raw_content !== 'string') {
      throw new Error(`Tavily could not extract ${website.name}`);
    }
    return website.id === 'mrist-notices'
      ? parseMristJson(result.raw_content, website)
      : parseMarkdown(result.raw_content, website);
  }
}

export const tavilyNoticeProvider = new TavilyNoticeProvider();
