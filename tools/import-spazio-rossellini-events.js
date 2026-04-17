const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SITEMAP_URL = 'https://www.spaziorossellini.it/tribe_events-sitemap.xml';
const EVENTS_API_URL =
  'https://www.spaziorossellini.it/wp-json/tribe/events/v1/events?per_page=50';
const CATEGORY_SITEMAP_URL =
  'https://www.spaziorossellini.it/tribe_events_cat-sitemap.xml';

const DEFAULT_REWARDS = { xp: 140, reputation: 20, cachet: 100 };

const loadEnv = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnv();

const DRY_RUN = process.env.DRY_RUN === '1';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MONTHS_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

const normalizeUrl = (value) => value.replace(/\/+$/, '').trim();

const formatDate = (details, fallback) => {
  if (details?.year && details?.month && details?.day) {
    const day = String(details.day).padStart(2, '0');
    const monthIndex = Number(details.month) - 1;
    const monthLabel = MONTHS_IT[monthIndex] ?? 'Gen';
    return `${day} ${monthLabel} ${details.year}`;
  }
  if (fallback) {
    const [datePart] = fallback.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      const monthLabel = MONTHS_IT[month - 1] ?? 'Gen';
      return `${String(day).padStart(2, '0')} ${monthLabel} ${year}`;
    }
  }
  return '01 Gen 2026';
};

const formatTime = (details, fallback) => {
  if (details?.hour != null && details?.minutes != null) {
    return `${String(details.hour).padStart(2, '0')}:${String(details.minutes).padStart(2, '0')}`;
  }
  if (fallback) {
    const [, timePart] = fallback.split(' ');
    if (timePart) {
      return timePart.slice(0, 5);
    }
  }
  return '20:30';
};

const resolveGenre = (categories = [], allowedSlugs) => {
  const preferred = categories.find((category) => {
    const name = (category?.name ?? '').toString();
    const slug = (category?.slug ?? '').toString();
    if (!name) return false;
    if (name.toUpperCase() === 'IN EVIDENZA' || slug === 'in-evidenza') return false;
    if (allowedSlugs && allowedSlugs.size > 0 && !allowedSlugs.has(slug)) {
      return false;
    }
    return true;
  });
  return (preferred?.name ?? categories[0]?.name ?? 'Teatro').toString();
};

const chunk = (items, size) => {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const fetchSitemapUrls = async () => {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    throw new Error(`Sitemap fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  const urls = new Set();
  const regex = /<loc>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/loc>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const url = match[1].trim();
    if (url.includes('/event/')) {
      urls.add(normalizeUrl(url));
    }
  }
  return urls;
};

const fetchCategorySlugs = async () => {
  const res = await fetch(CATEGORY_SITEMAP_URL);
  if (!res.ok) {
    return new Set();
  }
  const xml = await res.text();
  const slugs = new Set();
  const regex = /<loc>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/loc>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const url = match[1].trim();
    const slugMatch = url.match(/\/events\/categoria\/([^/]+)\//);
    if (slugMatch?.[1]) {
      slugs.add(slugMatch[1]);
    }
  }
  return slugs;
};

const fetchAllEvents = async () => {
  const events = [];
  let nextUrl = EVENTS_API_URL;
  const visited = new Set();

  while (nextUrl && !visited.has(nextUrl)) {
    visited.add(nextUrl);
    const res = await fetch(nextUrl);
    if (!res.ok) {
      throw new Error(`Events API fetch failed: ${res.status}`);
    }
    const payload = await res.json();
    if (Array.isArray(payload.events)) {
      events.push(...payload.events);
    }
    nextUrl = payload.next_rest_url || null;
  }

  return events;
};

const mapEvent = (event, allowedCategories) => ({
  id: `SR-${event.id}`,
  name: event.title,
  theatre: event.venue?.venue ?? 'Spazio Rossellini',
  event_date: formatDate(event.start_date_details, event.start_date),
  event_time: formatTime(event.start_date_details, event.start_date),
  genre: resolveGenre(event.categories, allowedCategories),
  base_rewards: DEFAULT_REWARDS,
  focus_role: null,
});

const upsertEvents = async (rows) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const batches = chunk(rows, 50);
  for (const batch of batches) {
    const { error } = await supabase.from('events').upsert(batch, { onConflict: 'id' });
    if (error) {
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }
  }
};

const run = async () => {
  const sitemapUrls = await fetchSitemapUrls();
  const categorySlugs = await fetchCategorySlugs();
  const apiEvents = await fetchAllEvents();
  const filtered = apiEvents.filter((event) =>
    sitemapUrls.has(normalizeUrl(event.url ?? ''))
  );
  const mapped = filtered.map((event) => mapEvent(event, categorySlugs));

  console.log(`Sitemap URLs: ${sitemapUrls.size}`);
  console.log(`API events: ${apiEvents.length}`);
  console.log(`Matched events: ${mapped.length}`);

  if (DRY_RUN) {
    console.log(JSON.stringify(mapped.slice(0, 5), null, 2));
    return;
  }

  await upsertEvents(mapped);
  console.log('Import completed.');
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
