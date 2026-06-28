/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type LogLevel = 'info' | 'warn' | 'error';
type NormalizedLogEntry = {
  id: string;
  sequence: number;
  createdAt: number;
  level: LogLevel;
  message: string;
  details?: unknown;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLogLevel(value: unknown): LogLevel {
  if (value === 'warn' || value === 'error' || value === 'info') return value;
  return 'info';
}

function normalizeLogMessage(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 2000);
}

// Maximum byte budget for sanitized log details — prevents memory exhaustion
// from unbounded string payloads (closes #1358).
const MAX_DETAILS_STRING_LENGTH = 2000;
const MAX_DETAILS_JSON_LENGTH = 5000;

function sanitizeLogDetails(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    // Cap string length to prevent memory exhaustion via large details payloads.
    return value.slice(0, MAX_DETAILS_STRING_LENGTH);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  try {
    const serialized = JSON.stringify(value);
    // Slicing JSON at an arbitrary byte offset produces malformed JSON that
    // JSON.parse() always rejects — the catch block then returns "[object Object]",
    // silently discarding all structure (closes #1381). Return a structured
    // wrapper object instead so the details field remains inspectable.
    if (serialized.length > MAX_DETAILS_JSON_LENGTH) {
      return { _truncated: true, _originalBytes: serialized.length, preview: serialized.slice(0, MAX_DETAILS_JSON_LENGTH) };
    }
    return JSON.parse(serialized);
  } catch {
    return String(value).slice(0, MAX_DETAILS_STRING_LENGTH);
  }
}

function normalizeLogEntry(rawEntry: unknown, index: number): NormalizedLogEntry | null {
  if (!isRecord(rawEntry)) return null;
  const message = normalizeLogMessage(rawEntry.message);
  if (!message) return null;

  const id =
    typeof rawEntry.id === 'string' && rawEntry.id.trim()
      ? rawEntry.id.trim()
      : `client-log-${Date.now()}-${index}`;
  const createdAt =
    typeof rawEntry.createdAt === 'number' && Number.isFinite(rawEntry.createdAt)
      ? rawEntry.createdAt
      : Date.now();
  const sequence =
    typeof rawEntry.sequence === 'number' && Number.isFinite(rawEntry.sequence)
      ? rawEntry.sequence
      : index + 1;

  return {
    id,
    sequence,
    createdAt,
    level: normalizeLogLevel(rawEntry.level),
    message,
    details: sanitizeLogDetails(rawEntry.details),
  };
}

async function resolveRequesterUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) return null;

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

function countDuplicateLogIds(entries: NormalizedLogEntry[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(entry.id);
  }
  return duplicates;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo non consentito' }, 405);
  }

  // Require a valid JWT before processing any log entries
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Autenticazione richiesta' }, 401);
  }

  // Parse the body before passing req to resolveRequesterUserId so that
  // req.body is consumed exactly once — resolveRequesterUserId only reads
  // headers, but structuring the code this way prevents a double-consume
  // bug if the function is ever modified to read the body later.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Payload non valido' }, 400);
  }
  if (!isRecord(body)) {
    return jsonResponse({ error: 'Payload non valido' }, 400);
  }

  const requesterUserIdFromAuth = await resolveRequesterUserId(req);
  if (!requesterUserIdFromAuth) {
    return jsonResponse({ error: 'Sessione non valida o scaduta' }, 401);
  }

  try {
    const action = typeof body.action === 'string' ? body.action.trim().slice(0, 100) : 'ingest_logs';
    if (action !== 'ingest_logs') {
      return jsonResponse({ error: `Azione non supportata: ${action}` }, 400);
    }

    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 120)
      : 'unknown-source';
    const duplicatePolicy = typeof body.duplicatePolicy === 'string' && body.duplicatePolicy.trim()
      ? body.duplicatePolicy.trim().slice(0, 80)
      : 'include';
    // Always use the verified JWT identity; ignore any caller-supplied value to
    // prevent false log attribution (IDOR — closes #1301).
    const clientUserId = requesterUserIdFromAuth;

    const rawLogs = Array.isArray(body.logs) ? body.logs.slice(0, 100) : [];
    const normalizedLogs = rawLogs
      .map((entry, index) => normalizeLogEntry(entry, index))
      .filter((entry): entry is NormalizedLogEntry => !!entry);

    const requesterUserId = requesterUserIdFromAuth;
    const duplicateCount = countDuplicateLogIds(normalizedLogs);

    // Enforce duplicatePolicy — closes #1360.
    // Previously duplicatePolicy was parsed but never acted upon, making the
    // API contract a no-op. Now it controls whether duplicate IDs are filtered
    // out or rejected.
    if (duplicatePolicy === 'error' && duplicateCount > 0) {
      return jsonResponse({
        error: `Duplicate log IDs detected (${duplicateCount}). Set duplicatePolicy to "include" or "skip" to proceed.`,
        duplicateCount,
      }, 400);
    }

    const dedupedLogs = duplicatePolicy === 'skip'
      ? (() => {
          const seen = new Set<string>();
          return normalizedLogs.filter((entry) => {
            if (seen.has(entry.id)) return false;
            seen.add(entry.id);
            return true;
          });
        })()
      : normalizedLogs;

    console.info('[mobile-logs] ingest request', {
      source,
      duplicatePolicy,
      rawCount: rawLogs.length,
      acceptedCount: dedupedLogs.length,
      duplicateCount,
      requesterUserId,
      clientUserId,
    });

    dedupedLogs.forEach((entry, index) => {
      const payload = {
        source,
        duplicatePolicy,
        index,
        total: dedupedLogs.length,
        duplicateCount,
        requesterUserId,
        clientUserId,
        ...entry,
      };
      if (entry.level === 'error') {
        console.error('[mobile-logs] client', payload);
        return;
      }
      if (entry.level === 'warn') {
        console.warn('[mobile-logs] client', payload);
        return;
      }
      console.info('[mobile-logs] client', payload);
    });

    return jsonResponse({
      ok: true,
      received: dedupedLogs.length,
      duplicateCount,
      acceptedLogIds: dedupedLogs.map((entry) => entry.id),
    });
  } catch (error) {
    console.error('[mobile-logs] unexpected error', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
