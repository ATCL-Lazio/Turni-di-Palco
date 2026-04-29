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

function sanitizeLogDetails(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return null;

  try {
    const authClient = createClient(supabaseUrl, serviceKey);
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) return null;
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
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
  const requesterUserIdFromAuth = await resolveRequesterUserId(req);
  if (!requesterUserIdFromAuth) {
    return jsonResponse({ error: 'Sessione non valida o scaduta' }, 401);
  }

  try {
    const body = await req.json();
    if (!isRecord(body)) {
      return jsonResponse({ error: 'Payload non valido' }, 400);
    }

    const action = typeof body.action === 'string' ? body.action.trim() : 'ingest_logs';
    if (action !== 'ingest_logs') {
      return jsonResponse({ error: `Azione non supportata: ${action}` }, 400);
    }

    const source = typeof body.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 120)
      : 'unknown-source';
    const duplicatePolicy = typeof body.duplicatePolicy === 'string' && body.duplicatePolicy.trim()
      ? body.duplicatePolicy.trim().slice(0, 80)
      : 'include';
    const clientUserId = typeof body.clientUserId === 'string' && body.clientUserId.trim()
      ? body.clientUserId.trim().slice(0, 200)
      : null;

    const rawLogs = Array.isArray(body.logs) ? body.logs.slice(0, 100) : [];
    const normalizedLogs = rawLogs
      .map((entry, index) => normalizeLogEntry(entry, index))
      .filter((entry): entry is NormalizedLogEntry => !!entry);

    const requesterUserId = requesterUserIdFromAuth;
    const duplicateCount = countDuplicateLogIds(normalizedLogs);

    console.info('[mobile-logs] ingest request', {
      source,
      duplicatePolicy,
      rawCount: rawLogs.length,
      acceptedCount: normalizedLogs.length,
      duplicateCount,
      requesterUserId,
      clientUserId,
    });

    normalizedLogs.forEach((entry, index) => {
      const payload = {
        source,
        duplicatePolicy,
        index,
        total: normalizedLogs.length,
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
      received: normalizedLogs.length,
      duplicateCount,
      acceptedLogIds: normalizedLogs.map((entry) => entry.id),
    });
  } catch (error) {
    console.error('[mobile-logs] unexpected error', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
