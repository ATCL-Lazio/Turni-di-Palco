import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_THUMB_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_EMBED_MAX_BYTES = 1024 * 1024;

const blockedHosts = new Set(['localhost', '127.0.0.1', '::1']);

function isPrivateHost(hostname: string) {
  if (blockedHosts.has(hostname)) return true;
  const ipv4Match = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
  if (!ipv4Match) return false;
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part > 255)) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function decodeDataUrl(dataUrl: string, maxBytes: number) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    throw new Error('Thumbnail non valida');
  }
  const mimeType = match[1];
  const base64 = match[2];
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (binary.byteLength > maxBytes) {
    throw new Error('Thumbnail troppo grande');
  }
  return { binary, mimeType };
}

function findGlbInJson(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.toLowerCase().includes('.glb') ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findGlbInJson(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findGlbInJson(item);
      if (found) return found;
    }
  }
  return null;
}

function extractGlbCandidates(text: string) {
  const candidates = new Set<string>();
  const absoluteMatches =
    text.match(/https?:\/\/[^\s"'<>]+?\.glb(?:\?[^\s"'<>]*)?/gi) ?? [];
  absoluteMatches.forEach((match) => candidates.add(match));

  const quoted = /["']([^"']+?\.glb(?:\?[^"']*)?)["']/gi;
  let match;
  while ((match = quoted.exec(text))) {
    candidates.add(match[1]);
  }
  return [...candidates];
}

async function resolveGlbSource(sourceUrl: string, maxEmbedBytes: number) {
  if (sourceUrl.toLowerCase().endsWith('.glb')) {
    return { glbUrl: sourceUrl };
  }

  const response = await fetch(sourceUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error('Download sorgente fallito');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (
    contentType.includes('model/gltf-binary') ||
    contentType.includes('application/octet-stream')
  ) {
    const buffer = await response.arrayBuffer();
    return { glbUrl: response.url, glbBuffer: buffer };
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength && contentLength > maxEmbedBytes) {
    throw new Error('Risposta embed troppo grande');
  }

  const text = await response.text();
  if (!contentLength && text.length > maxEmbedBytes) {
    throw new Error('Risposta embed troppo grande');
  }
  let jsonCandidate: string | null = null;
  if (
    contentType.includes('application/json') ||
    text.trim().startsWith('{') ||
    text.trim().startsWith('[')
  ) {
    try {
      jsonCandidate = findGlbInJson(JSON.parse(text));
    } catch {
      jsonCandidate = null;
    }
  }

  const candidates = jsonCandidate ? [jsonCandidate] : extractGlbCandidates(text);
  if (!candidates.length) {
    throw new Error('Nessun link .glb trovato');
  }

  const resolved = new URL(candidates[0], response.url).toString();
  return { glbUrl: resolved };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Metodo non consentito', 405);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader) {
    return errorResponse('Token mancante', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse('Supabase non configurato', 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return errorResponse('Non autorizzato', 401);
  }

  let payload: {
    glbUrl?: string;
    sourceUrl?: string;
    thumbnailDataUrl?: string;
    resolveOnly?: boolean;
  } = {};
  try {
    payload = await req.json();
  } catch {
    return errorResponse('Payload non valido');
  }

  const sourceUrl = (payload.sourceUrl ?? payload.glbUrl ?? '').trim();
  if (!sourceUrl) {
    return errorResponse('URL richiesto');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return errorResponse('URL non valido');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return errorResponse('Protocollo non supportato');
  }

  if (isPrivateHost(parsedUrl.hostname)) {
    return errorResponse('Host non consentito');
  }

  const maxBytes = Number(Deno.env.get('AVATAR_MAX_BYTES') ?? DEFAULT_MAX_BYTES);
  const thumbMaxBytes = Number(
    Deno.env.get('AVATAR_THUMB_MAX_BYTES') ?? DEFAULT_THUMB_MAX_BYTES
  );
  const maxEmbedBytes = Number(
    Deno.env.get('AVATAR_EMBED_MAX_BYTES') ?? DEFAULT_EMBED_MAX_BYTES
  );

  let resolved: { glbUrl: string; glbBuffer?: ArrayBuffer };
  try {
    resolved = await resolveGlbSource(sourceUrl, maxEmbedBytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossibile risolvere il link';
    return errorResponse(message);
  }

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(resolved.glbUrl);
  } catch {
    return errorResponse('Link .glb non valido');
  }

  if (isPrivateHost(resolvedUrl.hostname)) {
    return errorResponse('Host non consentito');
  }

  if (payload.resolveOnly) {
    return jsonResponse({ resolvedGlbUrl: resolved.glbUrl });
  }

  let glbBuffer = resolved.glbBuffer;
  if (!glbBuffer) {
    const remoteResponse = await fetch(resolved.glbUrl, { redirect: 'follow' });
    if (!remoteResponse.ok) {
      return errorResponse('Download .glb fallito');
    }
    const contentLength = Number(remoteResponse.headers.get('content-length') ?? 0);
    if (contentLength && contentLength > maxBytes) {
      return errorResponse('Il file .glb supera il limite di dimensione');
    }
    glbBuffer = await remoteResponse.arrayBuffer();
  }

  if (glbBuffer.byteLength > maxBytes) {
    return errorResponse('Il file .glb supera il limite di dimensione');
  }

  const userId = authData.user.id;
  const glbPath = `profiles/${userId}/avatar.glb`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(glbPath, glbBuffer, {
    contentType: 'model/gltf-binary',
    upsert: true,
    cacheControl: '3600',
  });

  if (uploadError) {
    return errorResponse('Upload avatar fallito', 500);
  }

  let avatarThumbUrl: string | null = null;
  if (payload.thumbnailDataUrl) {
    try {
      const { binary, mimeType } = decodeDataUrl(payload.thumbnailDataUrl, thumbMaxBytes);
      const thumbPath = `profiles/${userId}/avatar.png`;
      const { error: thumbError } = await supabase.storage
        .from('avatars')
        .upload(thumbPath, binary, {
          contentType: mimeType,
          upsert: true,
          cacheControl: '3600',
        });
      if (thumbError) {
        return errorResponse('Upload thumbnail fallito', 500);
      }
      avatarThumbUrl = supabase.storage.from('avatars').getPublicUrl(thumbPath).data.publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thumbnail non valida';
      return errorResponse(message);
    }
  }

  const avatarGlbUrl = supabase.storage.from('avatars').getPublicUrl(glbPath).data.publicUrl;
  const avatarUpdatedAt = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    avatar_glb_url: avatarGlbUrl,
    avatar_updated_at: avatarUpdatedAt,
  };
  if (avatarThumbUrl) {
    updatePayload.avatar_thumb_url = avatarThumbUrl;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (profileError) {
    return errorResponse('Aggiornamento profilo fallito', 500);
  }

  return jsonResponse({ avatarGlbUrl, avatarThumbUrl, avatarUpdatedAt });
});
