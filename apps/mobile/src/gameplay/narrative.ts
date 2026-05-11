import type { RoleId } from '../state/store';
import type { RoleStats } from './minigames';
import { resolveAiChatEndpoint } from '../services/ai';

// Pure narrative engine (no React, no DOM). See issue #328.
// Loads scenes registered in `../data/narrative` and applies player choices.

export type NarrativeRewards = {
  xp?: number;
  cachet?: number;
  reputation?: number;
};

export type NarrativeRequirement = {
  stat?: keyof RoleStats;
  min?: number;
  flag?: string;
};

export type NarrativeOutcome = {
  text: string;
  rewards: NarrativeRewards;
  setFlags?: string[];
  next?: string | null;
};

export type NarrativeChoice = {
  id: string;
  label: string;
  requires?: NarrativeRequirement;
  outcome: NarrativeOutcome;
};

export type NarrativeScene = {
  id: string;
  title: string;
  setting: string;
  prompt: string;
  allowedRoles?: RoleId[];
  requiresFlags?: string[];
  choices: NarrativeChoice[];
};

export type NarrativeContext = {
  roleId: RoleId | null;
  stats: RoleStats | null;
  flags: ReadonlySet<string>;
};

export type NarrativeRunState = {
  currentSceneId: string;
  history: Array<{ sceneId: string; choiceId: string; ts: string }>;
  flags: Set<string>;
};

export type ChoiceAvailability =
  | { available: true }
  | { available: false; reason: 'role' | 'flag' | 'stat'; detail?: string };

// ---------------------------------------------------------------------------
// Registry indirection
//
// The engine is decoupled from the data layer. `data/narrative/index.ts`
// registers scenes via `registerScenes`. Tests can register fixtures the same
// way without touching JSON files on disk.
// ---------------------------------------------------------------------------

const SCENE_REGISTRY = new Map<string, NarrativeScene>();

export function registerScenes(scenes: NarrativeScene[]): void {
  for (const scene of scenes) {
    SCENE_REGISTRY.set(scene.id, scene);
  }
}

export function clearSceneRegistry(): void {
  SCENE_REGISTRY.clear();
}

export function loadScene(id: string): NarrativeScene | null {
  return SCENE_REGISTRY.get(id) ?? null;
}

export function listRegisteredScenes(): NarrativeScene[] {
  return Array.from(SCENE_REGISTRY.values());
}

// ---------------------------------------------------------------------------
// Availability & gating
// ---------------------------------------------------------------------------

export function isSceneAvailable(scene: NarrativeScene, ctx: NarrativeContext): boolean {
  if (scene.allowedRoles?.length && (!ctx.roleId || !scene.allowedRoles.includes(ctx.roleId))) {
    return false;
  }
  if (scene.requiresFlags?.length) {
    for (const flag of scene.requiresFlags) {
      if (!ctx.flags.has(flag)) return false;
    }
  }
  return true;
}

export function evaluateChoice(choice: NarrativeChoice, ctx: NarrativeContext): ChoiceAvailability {
  const req = choice.requires;
  if (!req) return { available: true };

  if (req.flag && !ctx.flags.has(req.flag)) {
    return { available: false, reason: 'flag', detail: req.flag };
  }
  if (req.stat && req.min != null) {
    const value = ctx.stats?.[req.stat];
    if (value == null || value < req.min) {
      return {
        available: false,
        reason: 'stat',
        detail: `Serve ${req.stat} ≥ ${req.min}`,
      };
    }
  }
  return { available: true };
}

export function getAvailableChoices(scene: NarrativeScene, ctx: NarrativeContext): NarrativeChoice[] {
  return scene.choices.filter(choice => evaluateChoice(choice, ctx).available);
}

// ---------------------------------------------------------------------------
// Run state mutations
// ---------------------------------------------------------------------------

export function createRunState(startSceneId: string): NarrativeRunState {
  return { currentSceneId: startSceneId, history: [], flags: new Set() };
}

export type ApplyChoiceResult = {
  state: NarrativeRunState;
  outcome: NarrativeOutcome;
  finished: boolean;
};

export function applyChoice(
  state: NarrativeRunState,
  scene: NarrativeScene,
  choiceId: string,
  ctx: NarrativeContext,
  now: () => string = () => new Date().toISOString(),
): ApplyChoiceResult {
  if (scene.id !== state.currentSceneId) {
    throw new Error(`Scene mismatch: state at ${state.currentSceneId}, got scene ${scene.id}`);
  }
  const choice = scene.choices.find(c => c.id === choiceId);
  if (!choice) {
    throw new Error(`Choice "${choiceId}" not found in scene "${scene.id}"`);
  }
  const availability = evaluateChoice(choice, ctx);
  if (!availability.available) {
    throw new Error(`Choice "${choiceId}" not available: ${availability.reason}${availability.detail ? ` (${availability.detail})` : ''}`);
  }

  const nextFlags = new Set(state.flags);
  for (const flag of choice.outcome.setFlags ?? []) nextFlags.add(flag);

  const next = choice.outcome.next ?? null;
  const finished = next === null;

  const nextState: NarrativeRunState = {
    currentSceneId: finished ? state.currentSceneId : next,
    history: [...state.history, { sceneId: scene.id, choiceId, ts: now() }],
    flags: nextFlags,
  };

  return { state: nextState, outcome: choice.outcome, finished };
}

// ---------------------------------------------------------------------------
// Validation (lightweight, runtime-only — no zod dependency)
// ---------------------------------------------------------------------------

export type ValidationError = { path: string; message: string };

export function validateScene(scene: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!scene || typeof scene !== 'object') {
    return [{ path: '$', message: 'scene must be an object' }];
  }
  const s = scene as Record<string, unknown>;

  for (const field of ['id', 'title', 'setting', 'prompt'] as const) {
    if (typeof s[field] !== 'string' || !(s[field] as string).length) {
      errors.push({ path: `$.${field}`, message: `${field} must be a non-empty string` });
    }
  }

  if (!Array.isArray(s.choices) || s.choices.length < 2 || s.choices.length > 4) {
    errors.push({ path: '$.choices', message: 'choices must be an array of 2-4 elements' });
  } else {
    const ids = new Set<string>();
    s.choices.forEach((choice, idx) => {
      const c = choice as Record<string, unknown>;
      if (typeof c.id !== 'string' || !c.id.length) {
        errors.push({ path: `$.choices[${idx}].id`, message: 'id required' });
      } else if (ids.has(c.id)) {
        errors.push({ path: `$.choices[${idx}].id`, message: `duplicate choice id "${c.id}"` });
      } else {
        ids.add(c.id);
      }
      if (typeof c.label !== 'string' || !c.label.length) {
        errors.push({ path: `$.choices[${idx}].label`, message: 'label required' });
      }
      if (!c.outcome || typeof c.outcome !== 'object') {
        errors.push({ path: `$.choices[${idx}].outcome`, message: 'outcome required' });
      } else {
        const o = c.outcome as Record<string, unknown>;
        if (typeof o.text !== 'string' || !o.text.length) {
          errors.push({ path: `$.choices[${idx}].outcome.text`, message: 'outcome.text required' });
        }
        if (!o.rewards || typeof o.rewards !== 'object') {
          errors.push({ path: `$.choices[${idx}].outcome.rewards`, message: 'outcome.rewards required' });
        }
        if (o.next !== undefined && o.next !== null && typeof o.next !== 'string') {
          errors.push({ path: `$.choices[${idx}].outcome.next`, message: 'next must be string|null' });
        }
      }
    });
  }

  return errors;
}

export function assertValidScene(scene: unknown): asserts scene is NarrativeScene {
  const errors = validateScene(scene);
  if (errors.length) {
    throw new Error(
      `Invalid narrative scene:\n` + errors.map(e => `  ${e.path}: ${e.message}`).join('\n'),
    );
  }
}

// ---------------------------------------------------------------------------
// Dynamic scene fetching via Maxwell (issue #924)
//
// `fetchScene` is the async counterpart of `loadScene`. It checks the in-memory
// registry first (static scenes + scenes already fetched this session), then
// sessionStorage, and finally calls the Maxwell /api/ai/chat endpoint with a
// scene-generation prompt. On any failure it returns null so callers can fall
// back to a static scene.
//
// The scene ID passed by the caller acts as a lookup key for static scenes; if
// it starts with MAXWELL_ID_PREFIX the function attempts dynamic generation.
// The generated scene receives a stable hash-derived ID so that its choice can
// be logged to `narrative_history` consistently.
// ---------------------------------------------------------------------------

export const MAXWELL_ID_PREFIX = 'maxwell_';
const SESSION_CACHE_PREFIX = 'tdp-narrative-scene:';
const MAXWELL_FETCH_TIMEOUT_MS = 12000;

// Reward bounds from shared/config/balancing.ts ACTIVITY_REWARDS.narrative_scene
const REWARD_XP_MIN = 15;
const REWARD_XP_MAX = 30;
const REWARD_CACHET_MIN = 5;
const REWARD_CACHET_MAX = 15;

const SCENE_GENERATION_SYSTEM_PROMPT =
  'Sei Maxwell, narratore del gioco teatrale "Turni di Palco". ' +
  'Genera scenari narrativi realistici e coinvolgenti per professionisti del teatro. ' +
  'Rispondi SEMPRE e SOLO con un singolo JSON valido, nessun testo aggiuntivo.';

function buildSceneGenerationPrompt(ctx: NarrativeContext): string {
  const role = ctx.roleId ?? 'sconosciuto';
  const stats = ctx.stats
    ? `presenza=${ctx.stats.presence}, precisione=${ctx.stats.precision}, leadership=${ctx.stats.leadership}, creatività=${ctx.stats.creativity}`
    : 'statistiche non disponibili';
  const flags = ctx.flags.size ? Array.from(ctx.flags).join(', ') : 'nessuno';

  return (
    `Genera UNO scenario narrativo in italiano per un giocatore con queste caratteristiche:\n` +
    `- Ruolo: ${role}\n` +
    `- Statistiche: ${stats}\n` +
    `- Flag attivi: ${flags}\n\n` +
    `Lo scenario deve:\n` +
    `1. Essere ambientato in un teatro durante una serata di spettacolo\n` +
    `2. Presentare una situazione concreta e specifica per il ruolo "${role}"\n` +
    `3. Avere 2-4 scelte con approcci professionali diversi\n` +
    `4. Includere almeno una scelta con requisito di statistica (usa quella più rilevante per il ruolo)\n\n` +
    `Schema JSON da restituire (nessun testo prima o dopo):\n` +
    `{\n` +
    `  "id": "PLACEHOLDER",\n` +
    `  "title": "Titolo breve (max 40 caratteri)",\n` +
    `  "setting": "Luogo e momento preciso",\n` +
    `  "prompt": "Situazione e decisione (1-2 frasi)",\n` +
    `  "choices": [\n` +
    `    {\n` +
    `      "id": "scelta_1",\n` +
    `      "label": "Testo breve (max 50 caratteri)",\n` +
    `      "requires": { "stat": "NOME_STAT", "min": NUMERO },\n` +
    `      "outcome": {\n` +
    `        "text": "Conseguenza narrativa (1-2 frasi)",\n` +
    `        "rewards": { "xp": NUMERO_${REWARD_XP_MIN}_${REWARD_XP_MAX}, "cachet": NUMERO_${REWARD_CACHET_MIN}_${REWARD_CACHET_MAX} },\n` +
    `        "next": null\n` +
    `      }\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Regole:\n` +
    `- "requires" è opzionale: includilo per scelte che richiedono competenza (min: 60-80)\n` +
    `- Statistiche valide: "presence", "precision", "leadership", "creativity"\n` +
    `- Rewards: scelte con stat alta → xp più alto; xp in [${REWARD_XP_MIN}-${REWARD_XP_MAX}], cachet in [${REWARD_CACHET_MIN}-${REWARD_CACHET_MAX}]\n` +
    `- "setFlags" opzionale per scelte con impatto narrativo duraturo (snake_case)\n` +
    `- Non usare flag già attivi: ${flags}\n` +
    `- id e flag in snake_case`
  );
}

function sceneHashId(content: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return `${MAXWELL_ID_PREFIX}${h.toString(16).padStart(8, '0')}`;
}

function safeInt(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

function clampRewards(scene: NarrativeScene): NarrativeScene {
  return {
    ...scene,
    choices: scene.choices.map(choice => ({
      ...choice,
      outcome: {
        ...choice.outcome,
        rewards: {
          xp: Math.min(REWARD_XP_MAX, Math.max(REWARD_XP_MIN, safeInt(choice.outcome.rewards?.xp, REWARD_XP_MIN))),
          cachet: Math.min(REWARD_CACHET_MAX, Math.max(REWARD_CACHET_MIN, safeInt(choice.outcome.rewards?.cachet, REWARD_CACHET_MIN))),
          ...(choice.outcome.rewards?.reputation != null
            ? { reputation: Math.min(3, Math.max(0, safeInt(choice.outcome.rewards.reputation, 0))) }
            : {}),
        },
      },
    })),
  };
}

function sessionCacheKey(ctx: NarrativeContext): string {
  const statsStr = ctx.stats
    ? `${ctx.stats.presence}:${ctx.stats.precision}:${ctx.stats.leadership}:${ctx.stats.creativity}`
    : 'null';
  return `${SESSION_CACHE_PREFIX}${ctx.roleId ?? 'none'}:${statsStr}`;
}

function readSessionCache(ctx: NarrativeContext): NarrativeScene | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(sessionCacheKey(ctx));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (validateScene(parsed).length > 0) return null;
    return parsed as NarrativeScene;
  } catch { return null; }
}

function writeSessionCache(scene: NarrativeScene, ctx: NarrativeContext): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(sessionCacheKey(ctx), JSON.stringify(scene));
  } catch { /* quota exceeded — ignore */ }
}

async function callMaxwellForScene(
  ctx: NarrativeContext,
  signal: AbortSignal,
): Promise<NarrativeScene | null> {
  const endpoint = resolveAiChatEndpoint();
  if (!endpoint) return null;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        prompt: SCENE_GENERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildSceneGenerationPrompt(ctx) }],
        context: { roleId: ctx.roleId },
      }),
    });
  } catch { return null; }

  if (!response.ok) return null;

  let data: unknown;
  try {
    data = await response.json();
  } catch { return null; }

  // Accept any of the reply field names Maxwell / OpenAI-compatible servers may use.
  const d = data as Record<string, unknown>;
  const reply =
    typeof d.reply === 'string' ? d.reply :
    typeof d.message === 'string' ? d.message :
    typeof d.content === 'string' ? d.content :
    typeof d.text === 'string' ? d.text :
    typeof (d.choices as Array<{ message?: { content?: unknown } }>)?.[0]?.message?.content === 'string'
      ? String((d.choices as Array<{ message?: { content?: unknown } }>)[0].message!.content)
      : null;
  if (!reply) return null;

  // Strip markdown fences that some models emit
  const jsonText = reply.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch { return null; }

  if (validateScene(raw).length > 0) return null;

  const scene = clampRewards(raw as NarrativeScene);
  // Assign stable hash-based ID and restrict to the requesting role
  scene.id = sceneHashId(jsonText);
  if (ctx.roleId) scene.allowedRoles = [ctx.roleId];

  return scene;
}

/**
 * Async variant of `loadScene` for dynamic Maxwell-generated scenes (issue #924).
 *
 * Lookup order:
 *   1. In-memory registry (static scenes + scenes already fetched this session)
 *   2. sessionStorage cache (survives component unmount within the same tab)
 *   3. Maxwell /api/ai/chat — only attempted when `id` starts with MAXWELL_ID_PREFIX
 *
 * Falls back to null on any error or timeout so callers can use a static scene.
 */
export async function fetchScene(
  id: string,
  ctx: NarrativeContext,
  options?: { signal?: AbortSignal },
): Promise<NarrativeScene | null> {
  // 1. Registry hit (static scenes or scenes already registered this session)
  const registryScene = SCENE_REGISTRY.get(id);
  if (registryScene) return registryScene;

  // 2. Only attempt Maxwell for sentinel IDs
  if (!id.startsWith(MAXWELL_ID_PREFIX)) return null;

  // 3. sessionStorage cache
  const cached = readSessionCache(ctx);
  if (cached) {
    registerScenes([cached]);
    return cached;
  }

  // 4. Call Maxwell with a hard timeout
  const controller = new AbortController();
  const timeoutId = typeof window !== 'undefined'
    ? window.setTimeout(() => controller.abort(), MAXWELL_FETCH_TIMEOUT_MS)
    : null;

  const combinedSignal = options?.signal
    ? (() => {
        const merged = new AbortController();
        if (controller.signal.aborted || options.signal!.aborted) {
          merged.abort();
        } else {
          const abort = () => merged.abort();
          controller.signal.addEventListener('abort', abort, { once: true });
          options.signal!.addEventListener('abort', abort, { once: true });
        }
        return merged.signal;
      })()
    : controller.signal;

  try {
    const scene = await callMaxwellForScene(ctx, combinedSignal);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    if (!scene) return null;
    writeSessionCache(scene, ctx);
    registerScenes([scene]);
    return scene;
  } catch {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    return null;
  }
}
