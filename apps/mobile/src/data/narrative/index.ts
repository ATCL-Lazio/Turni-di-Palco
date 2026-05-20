// Narrative scenes registry.
//
// Add a new scene:
//   1. Drop a `.json` file under `./scenes/` (generic scenes) or
//      `./theaters/` (theater-specific scenes, #478) matching the schema in
//      `../../gameplay/narrative.ts` (NarrativeScene).
//   2. Re-run dev/build: Vite's `import.meta.glob` picks up the new file
//      automatically — no manual import statement to add.
//   3. The registry validates every scene at module load: an invalid file
//      throws immediately in dev/build, so content errors cannot reach prod.
//
// Loading strategy:
// - **Generic scenes** (`./scenes/*.json`) load **eagerly**: they include
//   the FTUE / debug scene that the app needs available at first render.
// - **Theater scenes** (`./theaters/*.json`) load **lazily** in a separate
//   chunk: 25+ files only relevant after the player has registered ≥3 turns
//   at a venue, so we don't want them in the main bundle (TTI impact).
//   They are pre-fetched in background as soon as this module is imported,
//   and consumers that need a guaranteed-ready theater scene can
//   `await ensureTheaterScenesLoaded()` before lookup.
//
// See `./scenes/README.md` for the schema, `./theaters/README.md` for the
// theater-specific extension (#478).

import { assertValidScene, registerScenes, type NarrativeScene } from '../../gameplay/narrative';

// Generic scenes — eager: parsed and registered at module load.
const sceneModules = import.meta.glob('./scenes/*.json', {
  eager: true,
  import: 'default',
});

// Theater scenes — lazy: each entry is a `() => Promise<...>` factory.
const theaterLoaders = import.meta.glob<unknown>('./theaters/*.json', {
  import: 'default',
});

const GENERIC_SCENES: unknown[] = Object.values(sceneModules);

let genericInitialized = false;

export function initNarrativeRegistry(): void {
  if (genericInitialized) return;
  for (const raw of GENERIC_SCENES) {
    assertValidScene(raw);
  }
  registerScenes(GENERIC_SCENES as NarrativeScene[]);
  genericInitialized = true;
}

let theaterScenesPromise: Promise<void> | null = null;

/**
 * Ensures every `./theaters/*.json` scene is parsed, validated and
 * registered. Idempotent: subsequent calls return the same Promise so
 * multiple consumers can share the same load.
 *
 * Call this before showing UI that depends on a specific theater scene
 * being available (e.g. just before `loadScene(theaterId)` lookup).
 */
export function ensureTheaterScenesLoaded(): Promise<void> {
  if (theaterScenesPromise) return theaterScenesPromise;
  theaterScenesPromise = (async () => {
    const modules = await Promise.all(
      Object.values(theaterLoaders).map(loader => loader()),
    );
    for (const raw of modules) {
      assertValidScene(raw);
    }
    registerScenes(modules as NarrativeScene[]);
  })();
  return theaterScenesPromise;
}

// Auto-init: generic scenes synchronously, theater scenes in background.
// Tests that registered fixtures and then cleared the registry can also
// invoke `initNarrativeRegistry()` explicitly.
initNarrativeRegistry();
void ensureTheaterScenesLoaded();
