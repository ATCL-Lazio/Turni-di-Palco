// Narrative scenes registry.
//
// Add a new scene:
//   1. Drop a `.json` file under `./scenes/` matching the schema in
//      `../../gameplay/narrative.ts` (NarrativeScene).
//   2. Import it below and append to SCENES.
//   3. The registry validates every scene at module load: an invalid file
//      throws immediately in dev/build, so content errors cannot reach prod.
//
// See `./scenes/README.md` for the schema and writing tips.

import { assertValidScene, registerScenes, type NarrativeScene } from '../../gameplay/narrative';

import debugIntro from './scenes/debug_intro.json';

const SCENES: unknown[] = [debugIntro];

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
