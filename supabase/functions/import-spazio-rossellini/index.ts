/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const SITEMAP_URL = 'https://www.spaziorossellini.it/tribe_events-sitemap.xml';
const CATEGORY_SITEMAP_URL =
  'https://www.spaziorossellini.it/tribe_events_cat-sitemap.xml';
const EVENTS_API_URL =
  'https://www.spaziorossellini.it/wp-json/tribe/events/v1/events?per_page=50';

const DEFAULT_REWARDS = { xp: 140, reputation: 20, cachet: 100 };

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type SpazioEvent = {
  id: number;
  title: string;
  url: string;
  start_date: string;
  start_date_details?: { year: string; month: string; day: string; hour: string; minutes: string };
  categories?: Array<{ name?: string; slug?: string }>;
  venue?: { venue?: string };
};

const normalizeUrl = (value: string) => value.replace(/\/+$/, '').trim();

const formatDate = (details?: SpazioEvent['start_date_details'], fallback?: string) => {
  if (details?.year && details?.month && details?.day) {
    const month = String(details.month).padStart(2, '0');
    const day = String(details.day).padStart(2, '0');
    return `${details.year}-${month}-${day}`;
  }
  if (fallback) {
    const [datePart] = fallback.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    if (year && month && day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '2026-01-01';
};

const formatTime = (details?: SpazioEvent['start_date_details'], fallback?: string) => {
  if (details?.hour && details?.minutes != null) {
    return `${String(details.hour).padStart(2, '0')}:${String(details.minutes).padStart(2, '0')}`;
  }
  if (fallback) {
    const [, timePart] = fallback.split(' ');
    if (timePart) return timePart.slice(0, 5);
  }
  return '20:30';
};

const resolveGenre = (categories: SpazioEvent['categories'] = [], allowedSlugs: Set<string>) => {
  const preferred = categories.find((category) => {
    const name = (category?.name ?? '').toString();
    const slug = (category?.slug ?? '').toString();
    if (!name) return false;
    if (name.toUpperCase() === 'IN EVIDENZA' || slug === 'in-evidenza') return false;
    if (allowedSlugs.size > 0 && !allowedSlugs.has(slug)) return false;
    return true;
  });
  return (preferred?.name ?? categories[0]?.name ?? 'Teatro').toString();
};

const fetchSitemapUrls = async () => {
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  const urls = new Set<string>();
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
  if (!res.ok) return new Set<string>();
  const xml = await res.text();
  const slugs = new Set<string>();
  const regex = /<loc>(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?<\/loc>/g;
  let match;
  while ((match = regex.exec(xml))) {
    const url = match[1].trim();
    const slugMatch = url.match(/\/events\/categoria\/([^/]+)\//);
    if (slugMatch?.[1]) slugs.add(slugMatch[1]);
  }
  return slugs;
};

const fetchAllEvents = async () => {
  const events: SpazioEvent[] = [];
  let nextUrl: string | null = EVENTS_API_URL;
  const visited = new Set<string>();
  while (nextUrl && !visited.has(nextUrl)) {
    visited.add(nextUrl);
    const res = await fetch(nextUrl);
    if (!res.ok) throw new Error(`Events API fetch failed: ${res.status}`);
    const payload = await res.json();
    if (Array.isArray(payload.events)) {
      events.push(...payload.events);
    }
    nextUrl = payload.next_rest_url || null;
  }
  return events;
};

const mapEvent = (event: SpazioEvent, allowedCategories: Set<string>) => ({
  id: `SR-${event.id}`,
  name: event.title,
  theatre: event.venue?.venue ?? 'Spazio Rossellini',
  event_date: formatDate(event.start_date_details, event.start_date),
  event_time: formatTime(event.start_date_details, event.start_date),
  genre: resolveGenre(event.categories ?? [], allowedCategories),
  base_rewards: DEFAULT_REWARDS,
  focus_role: null,
});

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Metodo non consentito' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ error: 'Missing Supabase env vars' }, 500);
  }

  // Verify caller JWT and require admin role before allowing bulk import
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Autenticazione richiesta' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Sessione non valida' }, 401);
  }

  const userRole = (user.app_metadata as Record<string, unknown>)?.role as string | undefined;
  if (userRole !== 'admin') {
    return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const sitemapUrls = await fetchSitemapUrls();
    const categorySlugs = await fetchCategorySlugs();
    const apiEvents = await fetchAllEvents();
    const matched = apiEvents.filter((event) =>
      sitemapUrls.has(normalizeUrl(event.url ?? ''))
    );
    const rows = matched.map((event) => mapEvent(event, categorySlugs));

    const { error } = await supabase.from('events').upsert(rows, { onConflict: 'id' });
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({
      sitemapCount: sitemapUrls.size,
      apiCount: apiEvents.length,
      matchedCount: matched.length,
      upserted: rows.length,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Errore' }, 500);
  }
});
