import type { AtclPromotion, AtclPromotionSlot } from '../data/atcl_promotions';
import { getLocalAtclPromotionBySlot, isAtclPromotionActive } from '../data/atcl_promotions';

type PromotionBySlot = Partial<Record<AtclPromotionSlot, AtclPromotion>>;

export type AtclNewsTickerItem = {
  id: string;
  title: string;
  url: string;
  sourceLabel: string;
  publishedAt?: string;
};

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  categories: string[];
};

type PromoSourceKey = 'atcl-rss' | 'rossellini-rss' | 'atcl-rest' | 'rossellini-rest';

const REMOTE_CACHE_TTL_MS = 15 * 60 * 1000;
const REMOTE_CACHE_ERROR_TTL_MS = 30 * 1000; // short backoff on failure so retries succeed quickly
const RSS_ACCEPT_HEADER = 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8';
const NEWS_TICKER_DEFAULT_LIMIT = 20;
const REMOTE_FETCH_TIMEOUT_MS = 8000;

const ATCL_FEED_URL =
  import.meta.env.VITE_ATCL_PROMO_FEED_URL ?? 'https://www.atcllazio.it/feed/';
const ROSSELLINI_FEED_URL =
  import.meta.env.VITE_ROSSELLINI_PROMO_FEED_URL ??
  'https://www.spaziorossellini.it/category/slide-evidenza/feed/';

const ATCL_REST_PROMO_URL =
  import.meta.env.VITE_ATCL_PROMO_REST_URL ??
  'https://www.atcllazio.it/wp-json/wp/v2/posts?categories=421&per_page=6&_fields=title,link,date,excerpt';
const ROSSELLINI_REST_PROMO_URL =
  import.meta.env.VITE_ROSSELLINI_PROMO_REST_URL ??
  'https://www.spaziorossellini.it/wp-json/wp/v2/posts?categories=21&per_page=6&_fields=title,link,date,excerpt';
const ATCL_PROMO_PROXY_PATH =
  import.meta.env.VITE_ATCL_PROMO_PROXY_PATH ?? '/api/promotions/proxy';
const ATCL_PROMO_USE_LOCAL_PROXY =
  parseOptionalBooleanEnv(import.meta.env.VITE_ATCL_PROMO_USE_LOCAL_PROXY) ?? true;
const ATCL_PROMO_ALLOW_EXTERNAL_FALLBACK =
  parseOptionalBooleanEnv(import.meta.env.VITE_ATCL_PROMO_ALLOW_EXTERNAL_FALLBACK) ?? false;
const ATCL_PROMO_CORS_PROXY_TEMPLATE =
  import.meta.env.VITE_ATCL_PROMO_CORS_PROXY_TEMPLATE ??
  'https://api.allorigins.win/raw?url={url}';
const ATCL_PROMO_ALLOW_DIRECT_FETCH =
  parseOptionalBooleanEnv(import.meta.env.VITE_ATCL_PROMO_ALLOW_DIRECT_FETCH) ?? false;

let remoteCacheExpiresAt = 0;
let remoteCacheData: PromotionBySlot | null = null;
let inflightLoad: Promise<PromotionBySlot> | null = null;
let remoteFeedCacheExpiresAt = 0;
let remoteFeedCacheData: { atclItems: RssItem[]; rosselliniItems: RssItem[] } | null = null;
let inflightFeedLoad: Promise<{ atclItems: RssItem[]; rosselliniItems: RssItem[] }> | null = null;

export function getLocalAtclNewsTickerItems(now: Date = new Date()): AtclNewsTickerItem[] {
  const homePromotion = getLocalAtclPromotionBySlot('home', now);
  const turnsPromotion = getLocalAtclPromotionBySlot('turns', now);
  const localPromotions = [homePromotion, turnsPromotion].filter(
    (promotion): promotion is AtclPromotion => Boolean(promotion)
  );

  return localPromotions.map((promotion, index) => ({
    id: `local-${promotion.id}-${index}`,
    title: collapseWhitespace(promotion.title),
    url: promotion.ctaUrl ?? 'https://www.atcllazio.it/',
    sourceLabel: promotion.badgeLabel || 'ATCL',
    publishedAt: promotion.startsAt,
  }));
}

export async function getAtclNewsTickerItemsSmart(
  limit = NEWS_TICKER_DEFAULT_LIMIT,
  now: Date = new Date()
): Promise<AtclNewsTickerItem[]> {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : NEWS_TICKER_DEFAULT_LIMIT;
  const remoteItems = await loadRemoteNewsTickerItemsSafe();
  if (remoteItems.length > 0) {
    return remoteItems.slice(0, normalizedLimit);
  }
  return getLocalAtclNewsTickerItems(now).slice(0, normalizedLimit);
}

export async function getAtclPromotionBySlotSmart(
  slot: AtclPromotionSlot,
  now: Date = new Date()
): Promise<AtclPromotion | null> {
  const remotePromotions = await loadRemotePromotionsSafe();
  const remote = remotePromotions[slot];
  if (remote && isAtclPromotionActive(remote, now)) {
    return remote;
  }
  return getLocalAtclPromotionBySlot(slot, now);
}

async function loadRemotePromotionsSafe(): Promise<PromotionBySlot> {
  const now = Date.now();
  if (remoteCacheData && remoteCacheExpiresAt > now) {
    return remoteCacheData;
  }
  if (inflightLoad) {
    return inflightLoad;
  }

  inflightLoad = loadRemotePromotions()
    .then((data) => {
      remoteCacheData = data;
      remoteCacheExpiresAt = Date.now() + REMOTE_CACHE_TTL_MS;
      return data;
    })
    .catch(() => {
      // Do not overwrite a valid cached result; use a short backoff TTL so
      // the next call retries after network recovery instead of waiting 15 min.
      const fallback = remoteCacheData ?? {};
      if (!remoteCacheData) {
        remoteCacheData = fallback;
      }
      remoteCacheExpiresAt = Date.now() + REMOTE_CACHE_ERROR_TTL_MS;
      return fallback;
    })
    .finally(() => {
      inflightLoad = null;
    });

  return inflightLoad;
}

async function loadRemoteNewsTickerItemsSafe(): Promise<AtclNewsTickerItem[]> {
  const feedBundle = await loadRemoteFeedBundleSafe();
  return mapFeedBundleToNewsTickerItems(feedBundle.atclItems, feedBundle.rosselliniItems);
}

async function loadRemoteFeedBundleSafe(): Promise<{ atclItems: RssItem[]; rosselliniItems: RssItem[] }> {
  const now = Date.now();
  if (remoteFeedCacheData && remoteFeedCacheExpiresAt > now) {
    return remoteFeedCacheData;
  }

  if (inflightFeedLoad) {
    return inflightFeedLoad;
  }

  inflightFeedLoad = Promise.all([fetchAtclItems(), fetchRosselliniItems()])
    .then(([atclItems, rosselliniItems]) => {
      const bundle = { atclItems, rosselliniItems };
      remoteFeedCacheData = bundle;
      remoteFeedCacheExpiresAt = Date.now() + REMOTE_CACHE_TTL_MS;
      return bundle;
    })
    .catch(() => {
      // Do not overwrite a valid cached result; use a short backoff TTL so
      // the next call retries after network recovery instead of waiting 15 min.
      const fallback = remoteFeedCacheData ?? { atclItems: [], rosselliniItems: [] };
      if (!remoteFeedCacheData) {
        remoteFeedCacheData = fallback;
      }
      remoteFeedCacheExpiresAt = Date.now() + REMOTE_CACHE_ERROR_TTL_MS;
      return fallback;
    })
    .finally(() => {
      inflightFeedLoad = null;
    });

  return inflightFeedLoad;
}

async function loadRemotePromotions(): Promise<PromotionBySlot> {
  const { atclItems, rosselliniItems } = await loadRemoteFeedBundleSafe();

  const atclTop =
    atclItems.find((item) =>
      item.categories.some((category) => /promo|news|novit/i.test(category))
    ) ?? atclItems[0];
  const rosselliniTop = rosselliniItems[0];

  const promotions: PromotionBySlot = {};
  if (atclTop) {
    promotions.home = mapItemToPromotion(atclTop, {
      slot: 'home',
      badgeLabel: 'Novita ATCL',
      ctaLabel: 'Apri notizia',
    });
  }
  if (rosselliniTop) {
    promotions.turns = mapItemToPromotion(rosselliniTop, {
      slot: 'turns',
      badgeLabel: 'Spazio Rossellini',
      ctaLabel: 'Dettagli evento',
    });
  }
  return promotions;
}

function mapFeedBundleToNewsTickerItems(atclItems: RssItem[], rosselliniItems: RssItem[]): AtclNewsTickerItem[] {
  const merged = [
    ...atclItems.map((item) => mapRssItemToTickerItem(item, 'ATCL')),
    ...rosselliniItems.map((item) => mapRssItemToTickerItem(item, 'Spazio Rossellini')),
  ].filter((item): item is AtclNewsTickerItem => Boolean(item));

  const dedupedByUrl = new Map<string, AtclNewsTickerItem>();
  for (const item of merged) {
    const key = collapseWhitespace(item.url).toLowerCase();
    if (!key) continue;
    if (dedupedByUrl.has(key)) continue;
    dedupedByUrl.set(key, item);
  }

  return Array.from(dedupedByUrl.values()).sort((left, right) => {
    const rightTs = toTimestamp(right.publishedAt);
    const leftTs = toTimestamp(left.publishedAt);
    return rightTs - leftTs;
  });
}

async function fetchAtclItems(): Promise<RssItem[]> {
  const fromRss = await fetchRssItems(ATCL_FEED_URL, 'atcl-rss');
  if (fromRss.length > 0) return fromRss;
  return fetchWordpressPosts(ATCL_REST_PROMO_URL, 'atcl-rest');
}

async function fetchRosselliniItems(): Promise<RssItem[]> {
  const fromRss = await fetchRssItems(ROSSELLINI_FEED_URL, 'rossellini-rss');
  if (fromRss.length > 0) return fromRss;
  return fetchWordpressPosts(ROSSELLINI_REST_PROMO_URL, 'rossellini-rest');
}

async function fetchRssItems(url: string, sourceKey: PromoSourceKey): Promise<RssItem[]> {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return [];

  for (const candidateUrl of buildRemoteFetchCandidates(url, sourceKey)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        headers: {
          accept: RSS_ACCEPT_HEADER,
        },
        signal: controller.signal,
      });
      if (!response.ok) continue;

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, 'application/xml');
      if (xml.querySelector('parsererror')) continue;

      const items = Array.from(xml.querySelectorAll('channel > item'))
        .map((item) => {
          const title = collapseWhitespace(item.querySelector('title')?.textContent ?? '');
          const link = collapseWhitespace(item.querySelector('link')?.textContent ?? '');
          const pubDate = collapseWhitespace(item.querySelector('pubDate')?.textContent ?? '');
          const description = sanitizeText(item.querySelector('description')?.textContent ?? '');
          const categories = Array.from(item.querySelectorAll('category'))
            .map((category) => collapseWhitespace(category.textContent ?? ''))
            .filter(Boolean);

          return { title, link, pubDate, description, categories };
        })
        .filter((item) => Boolean(item.title || item.link));

      if (items.length > 0) return items;
    } catch {
      // best effort: try next candidate URL
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return [];
}

async function fetchWordpressPosts(url: string, sourceKey: PromoSourceKey): Promise<RssItem[]> {
  for (const candidateUrl of buildRemoteFetchCandidates(url, sourceKey)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        headers: {
          accept: 'application/json',
        },
        signal: controller.signal,
      });
      if (!response.ok) continue;

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) continue;

      const items = payload
        .map((entry) => {
          const item = entry as {
            link?: unknown;
            date?: unknown;
            title?: { rendered?: unknown };
            excerpt?: { rendered?: unknown };
          };

          const title = sanitizeText(asString(item.title?.rendered));
          const description = sanitizeText(asString(item.excerpt?.rendered));
          const link = collapseWhitespace(asString(item.link));
          const pubDate = collapseWhitespace(asString(item.date));

          return {
            title,
            description,
            link,
            pubDate,
            categories: [],
          };
        })
        .filter((item) => Boolean(item.title || item.link));

      if (items.length > 0) return items;
    } catch {
      // best effort: try next candidate URL
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return [];
}

function buildRemoteFetchCandidates(url: string, sourceKey: PromoSourceKey): string[] {
  const localProxyUrl = buildLocalProxyUrl(sourceKey);
  const externalProxyUrl = buildExternalProxyUrl(url);
  const directUrlCandidates = ATCL_PROMO_ALLOW_DIRECT_FETCH ? [url] : [];
  const externalCandidates = ATCL_PROMO_ALLOW_EXTERNAL_FALLBACK
    ? [externalProxyUrl, ...directUrlCandidates]
    : directUrlCandidates;
  const candidates = ATCL_PROMO_USE_LOCAL_PROXY
    ? [localProxyUrl, ...externalCandidates]
    : externalCandidates;

  const unique: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  return unique;
}

function buildLocalProxyUrl(sourceKey: PromoSourceKey): string {
  const separator = ATCL_PROMO_PROXY_PATH.includes('?') ? '&' : '?';
  return `${ATCL_PROMO_PROXY_PATH}${separator}source=${encodeURIComponent(sourceKey)}`;
}

function buildExternalProxyUrl(url: string): string {
  const encodedTarget = encodeURIComponent(url);
  if (ATCL_PROMO_CORS_PROXY_TEMPLATE.includes('{url}')) {
    return ATCL_PROMO_CORS_PROXY_TEMPLATE.replace('{url}', encodedTarget);
  }
  const separator = ATCL_PROMO_CORS_PROXY_TEMPLATE.includes('?') ? '&' : '?';
  return `${ATCL_PROMO_CORS_PROXY_TEMPLATE}${separator}url=${encodedTarget}`;
}

function mapRssItemToTickerItem(item: RssItem, sourceLabel: string): AtclNewsTickerItem | null {
  const title = truncate(collapseWhitespace(item.title), 160);
  const url = collapseWhitespace(item.link);
  if (!title || !url) return null;

  const publishedAt = toIsoDate(item.pubDate);
  const idSeed = `${sourceLabel}-${url}`.toLowerCase();
  const id = idSeed.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || `ticker-${Date.now()}`;
  return {
    id,
    title,
    url,
    sourceLabel,
    publishedAt,
  };
}

function mapItemToPromotion(
  item: RssItem,
  config: { slot: AtclPromotionSlot; badgeLabel: string; ctaLabel: string }
): AtclPromotion {
  const slug = (item.link || item.title || config.slot)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return {
    id: `${config.slot}-${slug || 'news'}`,
    slot: config.slot,
    badgeLabel: config.badgeLabel,
    title: truncate(collapseWhitespace(item.title) || 'Novita in evidenza', 120),
    description:
      truncate(item.description || 'Consulta i dettagli sul sito ufficiale.', 220),
    ctaLabel: config.ctaLabel,
    ctaUrl: item.link || undefined,
    startsAt: toIsoDate(item.pubDate),
  };
}

function toIsoDate(value: string): string | undefined {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeText(value: string): string {
  const withoutBoilerplate = value.replace(/The post[\s\S]*$/i, '');
  return collapseWhitespace(stripHtml(withoutBoilerplate));
}

function stripHtml(value: string): string {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return value.replace(/<[^>]+>/g, ' ');
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return doc.body?.textContent ?? '';
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseOptionalBooleanEnv(value: unknown): boolean | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
}
