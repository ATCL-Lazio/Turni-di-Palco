/// <reference path="../@types/deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

// ---------------------------------------------------------------------------
// Types (mirror of apps/mobile/src/gameplay/narrative.ts — kept in sync manually)
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = ['attore', 'luci', 'fonico', 'attrezzista', 'palco', 'rspp', 'dramaturg'] as const;
type RoleId = typeof ALLOWED_ROLES[number];

type RoleStats = {
  presence: number;
  precision: number;
  leadership: number;
  creativity: number;
};

type NarrativeOutcome = {
  text: string;
  rewards: Record<string, number>;
  setFlags?: string[];
  next: string | null;
};

type NarrativeChoice = {
  id: string;
  label: string;
  requires?: { stat?: keyof RoleStats; min?: number };
  outcome: NarrativeOutcome;
};

type NarrativeScene = {
  id: string;
  title: string;
  setting: string;
  prompt: string;
  allowedRoles?: RoleId[];
  requiresFlags?: string[];
  choices: NarrativeChoice[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_NAMES: Record<RoleId, string> = {
  attore:      'Attore',
  luci:        'Operatore luci',
  fonico:      'Fonico',
  attrezzista: 'Attrezzista',
  palco:       'Capo macchinista',
  rspp:        'RSPP',
  dramaturg:   'Dramaturg',
};

const allowedOrigin = Deno.env.get('SITE_URL') ?? 'https://turnidipalco.it';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Reward computation
//
// Mirrors ACTIVITY_REWARDS.narrative_scene in shared/config/balancing.ts:
//   xp: { min: 15, max: 30 }, cachet: { min: 5, max: 15 }
//
// Tiers:
//   elite    (stat req >= 70)  → xp 30, cachet 14, reputation 2
//   high     (stat req 50-69)  → xp 25, cachet 10, reputation 1
//   standard (no req, solo)    → xp 20, cachet  8, reputation 0
//   low      (no req, scene has harder options) → xp 15, cachet 5, reputation 0
//
// +1 reputation bonus for choices that set narrative flags.
// ---------------------------------------------------------------------------

type ComputedRewards = { xp: number; cachet: number; reputation?: number };

function computeRewards(choice: NarrativeChoice, allChoices: NarrativeChoice[]): ComputedRewards {
  const reqMin = choice.requires?.min ?? 0;
  const setsFlags = (choice.outcome.setFlags?.length ?? 0) > 0;
  const sceneHasRequirements = allChoices.some(c => (c.requires?.min ?? 0) > 0);

  let xp: number;
  let cachet: number;
  let reputation = 0;

  if (reqMin >= 70) {
    xp = 30; cachet = 14; reputation = 2;
  } else if (reqMin >= 50) {
    xp = 25; cachet = 10; reputation = 1;
  } else if (sceneHasRequirements) {
    // "safe" choice in a scene that has harder locked options
    xp = 15; cachet = 5;
  } else {
    // standard scene — average reward for all choices
    xp = 20; cachet = 8;
  }

  if (setsFlags) reputation += 1;

  const result: ComputedRewards = { xp, cachet };
  if (reputation > 0) result.reputation = reputation;
  return result;
}

// ---------------------------------------------------------------------------
// Validation (must match validateScene in gameplay/narrative.ts)
// ---------------------------------------------------------------------------

function validateScene(raw: unknown): raw is NarrativeScene {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;

  for (const field of ['id', 'title', 'setting', 'prompt'] as const) {
    if (typeof s[field] !== 'string' || !(s[field] as string).length) return false;
  }

  if (!Array.isArray(s.choices) || s.choices.length < 2 || s.choices.length > 4) return false;

  const ids = new Set<string>();
  for (const choice of s.choices) {
    if (!choice || typeof choice !== 'object') return false;
    const c = choice as Record<string, unknown>;
    if (typeof c.id !== 'string' || !c.id.length) return false;
    if (ids.has(c.id)) return false;
    ids.add(c.id);
    if (typeof c.label !== 'string' || !c.label.length) return false;
    if (!c.outcome || typeof c.outcome !== 'object') return false;
    const o = c.outcome as Record<string, unknown>;
    if (typeof o.text !== 'string' || !o.text.length) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Scene ID
// ---------------------------------------------------------------------------

function generateSceneId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `maxwell_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// AI prompt
// ---------------------------------------------------------------------------

function buildPrompt(roleId: RoleId, stats: RoleStats, flags: string[], eventContext?: string): string {
  const roleName = ROLE_NAMES[roleId];
  const flagsList = flags.length ? flags.join(', ') : 'nessuno';
  const eventLine = eventContext ? `\n- Contesto evento: ${eventContext}` : '';

  return `Sei Maxwell, narratore del gioco teatrale "Turni di Palco".

Genera UN scenario narrativo in italiano per un giocatore con queste caratteristiche:
- Ruolo: ${roleId} (${roleName})
- Statistiche: presenza=${stats.presence}, precisione=${stats.precision}, leadership=${stats.leadership}, creatività=${stats.creativity}
- Flag attivi: ${flagsList}${eventLine}

Lo scenario deve:
1. Essere ambientato in un teatro durante una serata di spettacolo
2. Presentare una situazione concreta e specifica per il ruolo "${roleId}"
3. Avere 2-4 scelte che riflettono diversi approcci professionali
4. Includere almeno una scelta con requisito di statistica (usa la statistica più rilevante per il ruolo)

Rispondi SOLO con un JSON valido seguendo esattamente questo schema (nessun testo aggiuntivo):
{
  "id": "PLACEHOLDER",
  "title": "Titolo breve (max 40 caratteri)",
  "setting": "Luogo e momento preciso",
  "prompt": "Situazione e decisione da prendere (1-2 frasi)",
  "choices": [
    {
      "id": "scelta_1",
      "label": "Testo breve della scelta (max 50 caratteri)",
      "requires": { "stat": "NOME_STAT", "min": NUMERO },
      "outcome": {
        "text": "Conseguenza narrativa (1-2 frasi)",
        "rewards": {},
        "setFlags": ["flag_opzionale"],
        "next": null
      }
    }
  ]
}

Regole:
- "rewards" deve essere sempre {} — i premi vengono calcolati dal sistema, non da te
- "requires" è opzionale: includilo solo per scelte che richiedono vera competenza (min: 60-80)
- "setFlags" è opzionale: usalo per scelte con impatto narrativo duraturo, snake_case
- Statistiche valide: "presence", "precision", "leadership", "creativity"
- Non usare flag già attivi: ${flagsList}
- Rispondi SOLO con il JSON, nessun testo prima o dopo`;
}

// ---------------------------------------------------------------------------
// Anthropic API call
// ---------------------------------------------------------------------------

async function callAnthropic(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as { content?: Array<{ type: string; text: string }> };
  const text = data.content?.find(c => c.type === 'text')?.text;
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

function extractJson(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(stripped);
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return jsonResponse({ error: 'Missing environment variables' }, 500);
  }

  // Authenticate the caller
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // Parse and validate request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const roleId = body.role_id as string;
  if (!ALLOWED_ROLES.includes(roleId as RoleId)) {
    return jsonResponse({ error: `Invalid role_id: ${roleId}` }, 400);
  }

  const rawStats = (body.stats ?? {}) as Record<string, unknown>;
  const stats: RoleStats = {
    presence:   Math.min(100, Math.max(0, Number(rawStats.presence   ?? 50))),
    precision:  Math.min(100, Math.max(0, Number(rawStats.precision  ?? 50))),
    leadership: Math.min(100, Math.max(0, Number(rawStats.leadership ?? 50))),
    creativity: Math.min(100, Math.max(0, Number(rawStats.creativity ?? 50))),
  };
  const flags: string[] = Array.isArray(body.flags)
    ? (body.flags as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  const eventContext = typeof body.event_context === 'string'
    ? body.event_context.slice(0, 200)
    : undefined;

  // Generate scene via Anthropic
  const prompt = buildPrompt(roleId as RoleId, stats, flags, eventContext);
  let rawScene: unknown;
  try {
    const aiText = await callAnthropic(prompt, anthropicKey);
    rawScene = extractJson(aiText);
  } catch (err) {
    console.error('[generate-narrative-scene] AI generation failed:', err);
    return jsonResponse({ error: 'Scene generation failed', detail: (err as Error).message }, 502);
  }

  // Structural validation
  if (!validateScene(rawScene)) {
    console.error('[generate-narrative-scene] Invalid scene from AI:', JSON.stringify(rawScene).slice(0, 500));
    return jsonResponse({ error: 'Generated scene failed validation' }, 502);
  }

  const scene = rawScene as NarrativeScene;

  // Assign permanent scene ID and restrict to the requesting role
  scene.id = generateSceneId();
  scene.allowedRoles = [roleId as RoleId];

  // Overwrite AI-supplied rewards with server-computed, balancing-correct values
  for (const choice of scene.choices) {
    choice.outcome.rewards = computeRewards(choice, scene.choices);
    // Ensure next is explicitly null when absent (schema requirement)
    if (choice.outcome.next === undefined) choice.outcome.next = null;
  }

  // Persist using service role key (bypasses RLS; authenticated role has no INSERT policy)
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { error: insertError } = await serviceClient
    .from('generated_narrative_scenes')
    .insert({
      id:           scene.id,
      user_id:      user.id,
      role_id:      roleId,
      scene:        scene,
      source:       'maxwell',
    });

  if (insertError) {
    console.error('[generate-narrative-scene] DB insert failed:', insertError);
    return jsonResponse({ error: 'Failed to persist generated scene' }, 500);
  }

  return jsonResponse({ scene });
});
