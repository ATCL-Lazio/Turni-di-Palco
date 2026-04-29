import { afterEach, describe, expect, it } from 'vitest';
import {
  applyChoice,
  assertValidScene,
  clearSceneRegistry,
  createRunState,
  evaluateChoice,
  getAvailableChoices,
  isSceneAvailable,
  loadScene,
  registerScenes,
  validateScene,
  type NarrativeContext,
  type NarrativeScene,
} from '../gameplay/narrative';

const fixtureScene = (overrides: Partial<NarrativeScene> = {}): NarrativeScene => ({
  id: 'test_scene',
  title: 'Test',
  setting: 'Backstage',
  prompt: 'Cosa fai?',
  choices: [
    { id: 'safe', label: 'Sicuro', outcome: { text: 'ok', rewards: { xp: 10 }, next: null } },
    {
      id: 'risky',
      label: 'Rischioso',
      requires: { stat: 'precision', min: 80 },
      outcome: { text: 'wow', rewards: { xp: 30 }, next: null },
    },
  ],
  ...overrides,
});

const ctx = (over: Partial<NarrativeContext> = {}): NarrativeContext => ({
  roleId: 'attore',
  stats: { presence: 90, precision: 70, leadership: 60, creativity: 85 },
  flags: new Set(),
  ...over,
});

afterEach(() => clearSceneRegistry());

describe('narrative engine — registry', () => {
  it('registers and loads scenes by id', () => {
    const scene = fixtureScene();
    registerScenes([scene]);
    expect(loadScene('test_scene')).toEqual(scene);
    expect(loadScene('missing')).toBeNull();
  });

  it('overwrites scenes with the same id on re-register', () => {
    registerScenes([fixtureScene({ title: 'A' })]);
    registerScenes([fixtureScene({ title: 'B' })]);
    expect(loadScene('test_scene')?.title).toBe('B');
  });
});

describe('narrative engine — gating', () => {
  it('allows scene when no role/flag restriction is set', () => {
    expect(isSceneAvailable(fixtureScene(), ctx())).toBe(true);
  });

  it('blocks scene when role is not in allowedRoles', () => {
    const scene = fixtureScene({ allowedRoles: ['fonico'] });
    expect(isSceneAvailable(scene, ctx({ roleId: 'attore' }))).toBe(false);
    expect(isSceneAvailable(scene, ctx({ roleId: 'fonico' }))).toBe(true);
  });

  it('blocks scene when required flags are missing', () => {
    const scene = fixtureScene({ requiresFlags: ['met_director'] });
    expect(isSceneAvailable(scene, ctx())).toBe(false);
    expect(isSceneAvailable(scene, ctx({ flags: new Set(['met_director']) }))).toBe(true);
  });
});

describe('narrative engine — choice availability', () => {
  it('treats choices without requires as always available', () => {
    const scene = fixtureScene();
    expect(evaluateChoice(scene.choices[0], ctx())).toEqual({ available: true });
  });

  it('blocks a choice when stat is below min', () => {
    const scene = fixtureScene();
    const result = evaluateChoice(scene.choices[1], ctx({ stats: { presence: 90, precision: 70, leadership: 60, creativity: 85 } }));
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe('stat');
      expect(result.detail).toContain('precision');
    }
  });

  it('unblocks a stat-gated choice when stat meets the threshold', () => {
    const scene = fixtureScene();
    const high = ctx({ stats: { presence: 50, precision: 90, leadership: 60, creativity: 50 } });
    expect(evaluateChoice(scene.choices[1], high)).toEqual({ available: true });
  });

  it('blocks a flag-gated choice when flag is missing', () => {
    const scene = fixtureScene({
      choices: [
        { id: 'safe', label: 'A', outcome: { text: '', rewards: {}, next: null } },
        { id: 'gated', label: 'B', requires: { flag: 'has_key' }, outcome: { text: '', rewards: {}, next: null } },
      ],
    });
    const result = evaluateChoice(scene.choices[1], ctx());
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('flag');
  });

  it('getAvailableChoices filters out blocked ones', () => {
    const scene = fixtureScene();
    const choices = getAvailableChoices(scene, ctx());
    expect(choices.map(c => c.id)).toEqual(['safe']);
  });
});

describe('narrative engine — applyChoice', () => {
  const fixedNow = () => '2026-04-29T10:00:00.000Z';

  it('records choice in history with timestamp and returns outcome', () => {
    const scene = fixtureScene();
    const state = createRunState(scene.id);
    const result = applyChoice(state, scene, 'safe', ctx(), fixedNow);
    expect(result.outcome.rewards.xp).toBe(10);
    expect(result.finished).toBe(true);
    expect(result.state.history).toEqual([{ sceneId: 'test_scene', choiceId: 'safe', ts: fixedNow() }]);
  });

  it('does not mutate input state (immutability)', () => {
    const scene = fixtureScene();
    const state = createRunState(scene.id);
    applyChoice(state, scene, 'safe', ctx(), fixedNow);
    expect(state.history).toEqual([]);
    expect(state.flags.size).toBe(0);
  });

  it('sets flags from the chosen outcome', () => {
    const scene = fixtureScene({
      choices: [
        { id: 'pick', label: 'A', outcome: { text: '', rewards: {}, setFlags: ['met_director'], next: null } },
        { id: 'other', label: 'B', outcome: { text: '', rewards: {}, next: null } },
      ],
    });
    const result = applyChoice(createRunState(scene.id), scene, 'pick', ctx(), fixedNow);
    expect(result.state.flags.has('met_director')).toBe(true);
  });

  it('transitions to next scene when outcome.next is a string', () => {
    const scene = fixtureScene({
      id: 'first',
      choices: [
        { id: 'go', label: 'Avanti', outcome: { text: '', rewards: {}, next: 'second' } },
        { id: 'stay', label: 'Ferma', outcome: { text: '', rewards: {}, next: null } },
      ],
    });
    const result = applyChoice(createRunState('first'), scene, 'go', ctx(), fixedNow);
    expect(result.finished).toBe(false);
    expect(result.state.currentSceneId).toBe('second');
  });

  it('throws when choice id does not exist', () => {
    const scene = fixtureScene();
    expect(() => applyChoice(createRunState(scene.id), scene, 'bogus', ctx(), fixedNow)).toThrow(/not found/);
  });

  it('throws when choice is unavailable for the player context', () => {
    const scene = fixtureScene();
    expect(() => applyChoice(createRunState(scene.id), scene, 'risky', ctx(), fixedNow)).toThrow(/not available/);
  });

  it('throws when state is at a different scene than the one passed', () => {
    const scene = fixtureScene({ id: 'scene_b' });
    const state = createRunState('scene_a');
    expect(() => applyChoice(state, scene, 'safe', ctx(), fixedNow)).toThrow(/Scene mismatch/);
  });
});

describe('narrative engine — registry integration', () => {
  it('loads debug_intro scene from the data registry', async () => {
    clearSceneRegistry();
    const { initNarrativeRegistry } = await import('../data/narrative');
    initNarrativeRegistry();
    const scene = loadScene('debug_intro');
    expect(scene).not.toBeNull();
    expect(scene?.choices.length).toBeGreaterThanOrEqual(2);
    expect(scene?.choices.length).toBeLessThanOrEqual(4);
  });
});

describe('narrative engine — schema validation', () => {
  it('accepts a valid scene', () => {
    expect(validateScene(fixtureScene())).toEqual([]);
    expect(() => assertValidScene(fixtureScene())).not.toThrow();
  });

  it('rejects a scene with fewer than 2 choices', () => {
    const errors = validateScene({
      ...fixtureScene(),
      choices: [{ id: 'only', label: 'X', outcome: { text: 't', rewards: {}, next: null } }],
    });
    expect(errors.some(e => e.path === '$.choices')).toBe(true);
  });

  it('rejects a scene with duplicate choice ids', () => {
    const errors = validateScene({
      ...fixtureScene(),
      choices: [
        { id: 'dup', label: 'A', outcome: { text: 't', rewards: {}, next: null } },
        { id: 'dup', label: 'B', outcome: { text: 't', rewards: {}, next: null } },
      ],
    });
    expect(errors.some(e => e.message.includes('duplicate'))).toBe(true);
  });

  it('rejects a scene with missing outcome.text', () => {
    const errors = validateScene({
      ...fixtureScene(),
      choices: [
        { id: 'a', label: 'A', outcome: { rewards: {}, next: null } },
        { id: 'b', label: 'B', outcome: { text: 't', rewards: {}, next: null } },
      ],
    });
    expect(errors.some(e => e.path.includes('outcome.text'))).toBe(true);
  });

  it('assertValidScene throws on invalid input', () => {
    expect(() => assertValidScene({ id: '' })).toThrow(/Invalid narrative scene/);
  });
});
