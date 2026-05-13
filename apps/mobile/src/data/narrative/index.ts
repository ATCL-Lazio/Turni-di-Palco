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
import attoreSostituzione from './scenes/attore_sostituzione.json';
import attoreConflitto from './scenes/attore_conflitto.json';
import attoreCritico from './scenes/attore_critico.json';
import luciGuasto from './scenes/luci_guasto.json';
import luciBudget from './scenes/luci_budget.json';
import fonicoRitardo from './scenes/fonico_ritardo.json';
import fonicoMicrofono from './scenes/fonico_microfono.json';
import attrezzistaPropMancante from './scenes/attrezzista_prop_mancante.json';
import attrezzistaDanno from './scenes/attrezzista_danno.json';
import palcoMontaggio from './scenes/palco_montaggio.json';
import palcoSicurezza from './scenes/palco_sicurezza.json';
import rsppEvacuazione from './scenes/rspp_evacuazione.json';
import rsppFormazione from './scenes/rspp_formazione.json';
import dramaturgTesto from './scenes/dramaturg_testo.json';
import dramaturgRicerca from './scenes/dramaturg_ricerca.json';

const SCENES: unknown[] = [
  debugIntro,
  attoreSostituzione,
  attoreConflitto,
  attoreCritico,
  luciGuasto,
  luciBudget,
  fonicoRitardo,
  fonicoMicrofono,
  attrezzistaPropMancante,
  attrezzistaDanno,
  palcoMontaggio,
  palcoSicurezza,
  rsppEvacuazione,
  rsppFormazione,
  dramaturgTesto,
  dramaturgRicerca,
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
