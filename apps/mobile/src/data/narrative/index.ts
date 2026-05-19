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
// See `./scenes/README.md` for the schema, `./theaters/README.md` for the
// theater-specific extension (#478).

import { assertValidScene, registerScenes, type NarrativeScene } from '../../gameplay/narrative';

// Vite's eager glob: returns the parsed JSON of every file matching the
// pattern at build time. `import: 'default'` unwraps the default export so
// `scene` is the JSON object, not `{ default: ... }`.
const sceneModules = import.meta.glob('./scenes/*.json', {
  eager: true,
  import: 'default',
});
const theaterModules = import.meta.glob('./theaters/*.json', {
  eager: true,
  import: 'default',
});

const SCENES: unknown[] = [
  ...Object.values(sceneModules),
  ...Object.values(theaterModules),
];

let initialized = false;

export function initNarrativeRegistry(): void {
  if (initialized) return;
  for (const raw of SCENES) {
    assertValidScene(raw);
  }
  registerScenes(SCENES as NarrativeScene[]);
  initialized = true;
}

// Auto-init on import. Call sites can also invoke explicitly (e.g. tests
// that registered fixtures and then cleared the registry).
initNarrativeRegistry();
