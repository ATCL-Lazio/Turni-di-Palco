// Narrative scenes registry.
//
// Add a new scene:
//   1. Drop a `.json` file under `./scenes/` (generic scenes) or
//      `./theaters/` (theater-specific scenes, #478) matching the schema in
//      `../../gameplay/narrative.ts` (NarrativeScene).
//   2. Import it below and append to SCENES.
//   3. The registry validates every scene at module load: an invalid file
//      throws immediately in dev/build, so content errors cannot reach prod.
//
// See `./scenes/README.md` for the schema, `./theaters/README.md` for the
// theater-specific extension (#478).

import { assertValidScene, registerScenes, type NarrativeScene } from '../../gameplay/narrative';

import debugIntro from './scenes/debug_intro.json';

// Theater-specific scenes (#478). One placeholder per ATCL venue;
// content is meant to be enriched by the editorial team — keep the order
// alphabetic so future additions are easy to slot in.
import capranicaTeatroFrancigena from './theaters/capranica-teatro-francigena.json';
import carpinetoRomanoAuditoriumLeoneXiii from './theaters/carpineto-romano-auditorium-leone-xiii.json';
import cassinoCinemaTeatroManzoni from './theaters/cassino-cinema-teatro-manzoni.json';
import civitavecchiaTeatroTraiano from './theaters/civitavecchia-teatro-traiano.json';
import colleferroTeatroVittorioVeneto from './theaters/colleferro-teatro-vittorio-veneto.json';
import colonnaTeatroChiesaVecchia from './theaters/colonna-teatro-chiesa-vecchia.json';
import faraInSabinaTeatroPotlach from './theaters/fara-in-sabina-teatro-potlach.json';
import fiuggiTeatroComunale from './theaters/fiuggi-teatro-comunale.json';
import fondiTeatroNinoCanale from './theaters/fondi-teatro-nino-canale.json';
import formiaPiccoloTeatroIqbalMasih from './theaters/formia-piccolo-teatro-iqbal-masih.json';
import frascatiSpazioTeatroFaber from './theaters/frascati-spazio-teatro-faber.json';
import frosinoneTeatroComunaleVittoria from './theaters/frosinone-teatro-comunale-vittoria.json';
import gaetaTeatroAriston from './theaters/gaeta-teatro-ariston.json';
import latinaTeatroComunaleDannunzio from './theaters/latina-teatro-comunale-dannunzio.json';
import maglianoSabinaTeatroManlio from './theaters/magliano-sabina-teatro-manlio.json';
import montaltoDiCastroTeatroLeaPadovani from './theaters/montalto-di-castro-teatro-lea-padovani.json';
import monterotondoTeatroRamarini from './theaters/monterotondo-teatro-ramarini.json';
import privernoTeatroGigiProietti from './theaters/priverno-teatro-gigi-proietti.json';
import rietiTeatroFlavioVespasiano from './theaters/rieti-teatro-flavio-vespasiano.json';
import rignanoFlaminioTeatroPaladino from './theaters/rignano-flaminio-teatro-paladino.json';
import tarquiniaTeatroRossellaFalk from './theaters/tarquinia-teatro-rossella-falk.json';
import tivoliTeatroGiuseppetti from './theaters/tivoli-teatro-giuseppetti.json';
import tuscaniaTeatroIlRivellino from './theaters/tuscania-teatro-il-rivellino.json';
import velletriTeatroArtemisio from './theaters/velletri-teatro-artemisio.json';
import viterboTeatroDellunione from './theaters/viterbo-teatro-dellunione.json';

const SCENES: unknown[] = [
  debugIntro,
  // Theater-specific (#478)
  capranicaTeatroFrancigena,
  carpinetoRomanoAuditoriumLeoneXiii,
  cassinoCinemaTeatroManzoni,
  civitavecchiaTeatroTraiano,
  colleferroTeatroVittorioVeneto,
  colonnaTeatroChiesaVecchia,
  faraInSabinaTeatroPotlach,
  fiuggiTeatroComunale,
  fondiTeatroNinoCanale,
  formiaPiccoloTeatroIqbalMasih,
  frascatiSpazioTeatroFaber,
  frosinoneTeatroComunaleVittoria,
  gaetaTeatroAriston,
  latinaTeatroComunaleDannunzio,
  maglianoSabinaTeatroManlio,
  montaltoDiCastroTeatroLeaPadovani,
  monterotondoTeatroRamarini,
  privernoTeatroGigiProietti,
  rietiTeatroFlavioVespasiano,
  rignanoFlaminioTeatroPaladino,
  tarquiniaTeatroRossellaFalk,
  tivoliTeatroGiuseppetti,
  tuscaniaTeatroIlRivellino,
  velletriTeatroArtemisio,
  viterboTeatroDellunione,
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
