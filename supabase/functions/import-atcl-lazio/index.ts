/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const ATCL_BASE_URL = 'https://www.atcllazio.it';
const WP_API = `${ATCL_BASE_URL}/wp-json/wp/v2`;
const SHOW_CATEGORY_SLUG = 'programma';
const DEFAULT_THEATRE = 'ATCL Lazio';
const DEFAULT_REWARDS = { xp: 140, reputation: 20, cachet: 100 };
const FETCH_TIMEOUT_MS = 20_000;
const MAX_PAGES = 20;
const POSTS_PER_PAGE = 50;
const MIN_LOOKBACK = 30;
const MAX_LOOKBACK = 730;
const DEFAULT_LOOKBACK = 400;

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const ITALIAN_MONTHS: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04',
  maggio: '05', giugno: '06', luglio: '07', agosto: '08',
  settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

function parseItalianDate(text: string): string | null {
  const monthNames = Object.keys(ITALIAN_MONTHS).join('|');
  const pattern = new RegExp(`(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})`, 'i');
  const m = pattern.exec(text);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = ITALIAN_MONTHS[m[2].toLowerCase()];
  const year = m[3];
  return `${year}-${month}-${day}`;
}

function parseTime(text: string): string | null {
  // Handles: "ore 21:00", "21:00", "21.00", "21h00"
  const m = text.match(/\b(?:ore\s+)?(\d{1,2})[:.h](\d{2})\b/i);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  agrave: 'à', aacute: 'á', egrave: 'è', eacute: 'é',
  igrave: 'ì', iacute: 'í', ograve: 'ò', oacute: 'ó', ugrave: 'ù', uacute: 'ú',
  Agrave: 'À', Aacute: 'Á', Egrave: 'È', Eacute: 'É',
  Igrave: 'Ì', Iacute: 'Í', Ograve: 'Ò', Oacute: 'Ó', Ugrave: 'Ù', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', ccedil: 'ç', Ccedil: 'Ç',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”',
  lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…',
  euro: '€', copy: '©', reg: '®', trade: '™',
};

function decodeHtmlEntities(text: string): string {
  // Decode numeric entities (decimal and hex)
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => HTML_ENTITIES[name] ?? HTML_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(html: string): string {
  const stripped = html.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(stripped)
    .replace(/\s+/g, ' ')
    .trim();
}

interface ShowInfo {
  date: string | null;
  time: string | null;
  theatre: string | null;
}

function parseShowContent(html: string): ShowInfo {
  let date: string | null = null;
  let time: string | null = null;
  let theatre: string | null = null;

  // Strategy 1: labeled <strong> pairs — <strong>Data:</strong> 16 Maggio 2026
  // Also handles <strong>Data</strong>: 16 Maggio 2026 (colon outside)
  const labelValueRe = /<strong[^>]*>([^<]{1,50}?):?<\/strong>\s*:?\s*([^<\n]{1,150})/gi;
  let m;
  while ((m = labelValueRe.exec(html))) {
    const label = stripTags(m[1]).toLowerCase().replace(/:$/, '').trim();
    const raw = stripTags(m[2]).trim();
    if (!raw) continue;

    if (!date && /data|quando|giorno/.test(label)) {
      date = parseItalianDate(raw);
    }
    if (!time && /or[ae]|orario/.test(label)) {
      time = parseTime(raw);
    }
    if (!theatre && /teatro|luogo|dove|sede|spazio/.test(label)) {
      // "Teatro Tiberio, Civitavecchia" → take before first comma
      theatre = raw.split(',')[0].trim();
    }
  }

  // Strategy 2: standalone <strong> whose text looks like a theatre name
  if (!theatre) {
    const strongRe = /<strong[^>]*>([^<]{3,80})<\/strong>/gi;
    while ((m = strongRe.exec(html))) {
      const txt = stripTags(m[1]).trim();
      if (/^(teatro|spazio|auditorium|sala)\b/i.test(txt)) {
        theatre = txt;
        break;
      }
    }
  }

  // Strategy 3: scan full plain text for Italian date and time
  if (!date || !time) {
    const plain = stripTags(html);
    if (!date) date = parseItalianDate(plain);
    if (!time) {
      const tMatch = plain.match(/\bore\s+\d{1,2}[:.]\d{2}\b/i);
      if (tMatch) time = parseTime(tMatch[0]);
    }
  }

  return { date, time, theatre };
}

interface WpPost {
  id: number;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
}

async function fetchCategoryId(slug: string): Promise<number | null> {
  const url = `${WP_API}/categories?slug=${encodeURIComponent(slug)}&_fields=id,slug`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const cats = (await res.json()) as Array<{ id: number; slug: string }>;
    return cats.find((c) => c.slug === slug)?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchShowPosts(categoryId: number, modifiedAfter: string): Promise<WpPost[]> {
  const posts: WpPost[] = [];
  const fields = '_fields=id,slug,title,content,link';

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url =
      `${WP_API}/posts?categories=${categoryId}&per_page=${POSTS_PER_PAGE}&page=${page}` +
      `&modified_after=${encodeURIComponent(modifiedAfter)}&orderby=modified&order=desc&${fields}`;
    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch (err) {
      console.warn(
        `[import-atcl-lazio] fetchShowPosts network error on page ${page} (endpoint: ${WP_API}/posts):`,
        err,
      );
      break;
    }
    if (!res.ok) break;
    let batch: WpPost[];
    try {
      batch = (await res.json()) as WpPost[];
    } catch (err) {
      console.warn(
        `[import-atcl-lazio] fetchShowPosts invalid JSON on page ${page} (endpoint: ${WP_API}/posts):`,
        err,
      );
      break;
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    posts.push(...batch);
    if (batch.length < POSTS_PER_PAGE) break;
    if (page === MAX_PAGES) {
      // The last page was full — there may be additional posts beyond the cap.
      // Log so operators know results were truncated (closes #1416).
      console.warn(
        `[import-atcl-lazio] fetchShowPosts reached MAX_PAGES=${MAX_PAGES} with a full batch; ` +
        `posts beyond page ${MAX_PAGES} × ${POSTS_PER_PAGE} = ${MAX_PAGES * POSTS_PER_PAGE} were silently dropped.`,
      );
    }
  }
  return posts;
}

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Autenticazione richiesta' }, 401);
  }

  const callerToken = authHeader.slice('Bearer '.length);

  // Service-role key allows the control-plane to call this function without a user session.
  // The non-empty check prevents an empty-string SUPABASE_SERVICE_ROLE_KEY from
  // accidentally matching an empty Bearer token and bypassing auth (closes #1131).
  if (!serviceKey || callerToken !== serviceKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Sessione non valida' }, 401);
    }

    const userRole = (user.app_metadata as Record<string, unknown>)?.role as string | undefined;
    const userRoles = (user.app_metadata as Record<string, unknown>)?.roles as string[] | undefined;
    const isAdmin = userRole === 'admin' || (Array.isArray(userRoles) && userRoles.includes('admin'));
    if (!isAdmin) {
      return jsonResponse({ error: 'Accesso negato: ruolo admin richiesto' }, 403);
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const url = new URL(req.url);
    const rawDays = url.searchParams.get('lookback_days') ?? '';
    const parsedDays = parseInt(rawDays, 10);
    const lookbackDays = isNaN(parsedDays)
      ? DEFAULT_LOOKBACK
      : Math.min(Math.max(parsedDays, MIN_LOOKBACK), MAX_LOOKBACK);

    const modifiedAfter = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
    console.log(`[import-atcl-lazio] lookback=${lookbackDays}d modifiedAfter=${modifiedAfter}`);

    const categoryId = await fetchCategoryId(SHOW_CATEGORY_SLUG);
    if (categoryId == null) {
      return jsonResponse({ error: `Categoria "${SHOW_CATEGORY_SLUG}" non trovata su atcllazio.it` }, 502);
    }

    const posts = await fetchShowPosts(categoryId, modifiedAfter);
    console.log(`[import-atcl-lazio] fetched ${posts.length} show posts (category ${categoryId})`);

    type EventRow = {
      id: string;
      name: string;
      theatre: string;
      event_date: string;
      event_time: string | null;
      genre: string;
      base_rewards: typeof DEFAULT_REWARDS;
      focus_role: null;
    };

    const rows: EventRow[] = [];
    const skipped: string[] = [];

    for (const post of posts) {
      const name = stripTags(post.title.rendered).trim();
      const { date, time, theatre } = parseShowContent(post.content.rendered);

      if (!date) {
        console.warn(`[import-atcl-lazio] no date found for ${post.slug}`);
        skipped.push(post.slug);
        continue;
      }

      rows.push({
        id: `ATCL-${post.slug}`,
        name,
        theatre: theatre ?? DEFAULT_THEATRE,
        event_date: date,
        event_time: time,
        genre: 'Teatro',
        base_rewards: DEFAULT_REWARDS,
        focus_role: null,
      });
    }

    if (rows.length === 0) {
      return jsonResponse({
        message: 'Nessun evento con data trovato',
        fetched: posts.length,
        skipped: skipped.length,
        upserted: 0,
        skippedSlugs: skipped,
      });
    }

    const { error: upsertError } = await supabase
      .from('events')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) {
      console.error('[import-atcl-lazio] upsert error', upsertError);
      return jsonResponse({ error: 'Upsert fallito', detail: upsertError.message }, 500);
    }

    return jsonResponse({
      fetched: posts.length,
      upserted: rows.length,
      skipped: skipped.length,
      skippedSlugs: skipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[import-atcl-lazio] unexpected error', msg);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
