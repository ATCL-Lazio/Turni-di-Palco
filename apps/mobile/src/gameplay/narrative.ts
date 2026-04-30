import type { RoleId } from '../state/store';
import type { RoleStats } from './minigames';

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
