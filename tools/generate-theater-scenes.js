#!/usr/bin/env node
// Genera gli scenari placeholder per gli eventi narrativi esclusivi dei
// teatri ATCL (closes #478).
//
// Output: apps/mobile/src/data/narrative/theaters/<slug>.json
//
// Idempotenza: lo script NON sovrascrive file esistenti. Quando un redattore
// arricchisce uno scenario placeholder e committa la versione "vera", la
// successiva invocazione dello script lo lascia intatto.
//
// Per rigenerare ex-novo un singolo scenario: cancella il suo file e rilancia.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_DIR = path.join(
  __dirname,
  '..',
  'apps',
  'mobile',
  'src',
  'data',
  'narrative',
  'theaters',
);

// Seed: 25 venue ATCL (verifica del 2026-03-23, vedi docs/2026-03-23-atcl-teatri-ticketing.md).
// `hook`: aggancio reale alla storia/identità del teatro. Va arricchito a mano,
// ma il placeholder iniziale contiene già un riferimento documentato per
// evitare scenari completamente generici.
const VENUES = [
  { slug: 'capranica-teatro-francigena',           city: 'Capranica',        theatre: 'Teatro Francigena',                       hook: "sorto lungo l'antica Via Francigena, custodisce la memoria del pellegrinaggio medievale fino a Roma" },
  { slug: 'carpineto-romano-auditorium-leone-xiii', city: 'Carpineto Romano', theatre: 'Auditorium Leone XIII',                   hook: "intitolato a Papa Leone XIII, nato proprio a Carpineto nel 1810" },
  { slug: 'cassino-cinema-teatro-manzoni',          city: 'Cassino',          theatre: 'Cinema Teatro Manzoni',                  hook: 'sopravvissuto alla ricostruzione del dopoguerra, è uno degli spazi culturali simbolo della Cassino moderna' },
  { slug: 'civitavecchia-teatro-traiano',           city: 'Civitavecchia',    theatre: 'Teatro Traiano',                          hook: "intitolato all'imperatore che volle il porto di Centumcellae, oggi cuore civile della città" },
  { slug: 'colleferro-teatro-vittorio-veneto',      city: 'Colleferro',       theatre: 'Teatro Vittorio Veneto',                  hook: 'fondato nella città-fabbrica del Novecento, riconvertito in motore culturale del territorio' },
  { slug: 'colonna-teatro-chiesa-vecchia',          city: 'Colonna',          theatre: 'Teatro Chiesa Vecchia',                   hook: "ricavato da un edificio sacro sconsacrato, le navate sono diventate platea e palcoscenico" },
  { slug: 'fara-in-sabina-teatro-potlach',          city: 'Fara in Sabina',   theatre: 'Teatro Potlach',                          hook: "casa del Centro Internazionale di Ricerca sul Teatro fondato da Pino Di Buduo nel 1976" },
  { slug: 'fiuggi-teatro-comunale',                 city: 'Fiuggi',           theatre: 'Teatro Comunale di Fiuggi',                hook: 'parte del rinascimento culturale di Fiuggi Terme, città di acque e congressi internazionali' },
  { slug: 'fondi-teatro-nino-canale',               city: 'Fondi',            theatre: "Teatro Città di Fondi \"Nino Canale\"",   hook: "intitolato a Nino Canale, autore e regista fondiano, custode della tradizione teatrale locale" },
  { slug: 'formia-piccolo-teatro-iqbal-masih',      city: 'Formia',           theatre: 'Piccolo Teatro Iqbal Masih',              hook: "dedicato a Iqbal Masih, bambino-attivista pakistano simbolo della lotta al lavoro minorile" },
  { slug: 'frascati-spazio-teatro-faber',           city: 'Frascati',         theatre: 'Spazio Teatro Faber',                     hook: "nato come fucina di laboratori, oggi punto di riferimento per la scena indipendente dei Castelli Romani" },
  { slug: 'frosinone-teatro-comunale-vittoria',     city: 'Frosinone',        theatre: 'Teatro Comunale Vittoria',                hook: 'edificato negli anni Trenta, restituito alla città dopo un lungo restauro' },
  { slug: 'gaeta-teatro-ariston',                   city: 'Gaeta',            theatre: 'Teatro Ariston',                          hook: "affacciato sul golfo di Gaeta, mescola tradizione marinara e cartellone contemporaneo" },
  { slug: 'latina-teatro-comunale-dannunzio',       city: 'Latina',           theatre: "Teatro Comunale D'Annunzio",              hook: 'cuore civico della città di fondazione, intitolato al Vate che cantò le bonifiche pontine' },
  { slug: 'magliano-sabina-teatro-manlio',          city: 'Magliano Sabina',  theatre: 'Teatro Manlio',                           hook: "è un teatro all'italiana ottocentesco, gioiello in miniatura della Sabina" },
  { slug: 'montalto-di-castro-teatro-lea-padovani', city: 'Montalto di Castro', theatre: 'Teatro Lea Padovani',                  hook: "intitolato a Lea Padovani, attrice nata a Montalto e icona del neorealismo italiano" },
  { slug: 'monterotondo-teatro-ramarini',           city: 'Monterotondo',     theatre: 'Teatro Comunale F. Ramarini',             hook: 'sala storica della Sabina romana, riferimento per la programmazione provinciale' },
  { slug: 'priverno-teatro-gigi-proietti',          city: 'Priverno',         theatre: 'Teatro Comunale Gigi Proietti',           hook: 'tra i primi teatri italiani a essere intitolati a Gigi Proietti dopo la sua scomparsa' },
  { slug: 'rieti-teatro-flavio-vespasiano',         city: 'Rieti',            theatre: 'Teatro Flavio Vespasiano',                hook: "ottocentesco, intitolato all'imperatore romano di origini reatine, considerato uno dei teatri all'italiana più armonici del Lazio" },
  { slug: 'rignano-flaminio-teatro-paladino',       city: 'Rignano Flaminio', theatre: 'Teatro Paladino',                         hook: 'piccola sala lungo la Via Flaminia, cuore della stagione decentrata ATCL' },
  { slug: 'tarquinia-teatro-rossella-falk',         city: 'Tarquinia',        theatre: 'Teatro Comunale Rossella Falk',           hook: "intitolato a Rossella Falk, fra le voci più alte del teatro italiano del Novecento" },
  { slug: 'tivoli-teatro-giuseppetti',              city: 'Tivoli',           theatre: 'Teatro Giuseppetti',                      hook: "nel centro storico tiburtino, a pochi passi da Villa d'Este e Villa Gregoriana" },
  { slug: 'tuscania-teatro-il-rivellino',           city: 'Tuscania',         theatre: 'Teatro Il Rivellino',                     hook: "ricavato all'interno di un antico bastione medievale della cinta muraria di Tuscania" },
  { slug: 'velletri-teatro-artemisio',              city: 'Velletri',         theatre: "Teatro Artemisio Gian Maria Volonté",    hook: "intitolato a Gian Maria Volonté, eredità simbolica del cinema d'autore italiano" },
  { slug: 'viterbo-teatro-dellunione',              city: 'Viterbo',          theatre: "Teatro dell'Unione",                      hook: "ottocentesco, gioiello neoclassico della Tuscia, ricostruito dopo le ferite della Seconda guerra mondiale" },
];

function sceneIdFor(slug) {
  return `theater_${slug.replace(/-/g, '_')}`;
}

function buildScene({ slug, city, theatre, hook }) {
  const id = sceneIdFor(slug);
  return {
    id,
    theatre,
    city,
    season: '2025-2026',
    requires: { theatreVisits: { min: 3 } },
    title: `Storia segreta del ${theatre}`,
    setting: `${theatre} — ${city}`,
    prompt:
      `Dopo tre serate registrate qui, un membro storico della compagnia ti prende da parte ` +
      `e ti racconta che questo teatro ${hook}. Adesso ti chiede se vuoi raccogliere il testimone.`,
    choices: [
      {
        id: 'accolgo_eredita',
        label: 'Accogli il racconto',
        outcome: {
          text: `Resti ad ascoltare. Quando esci, guardi ${theatre} con occhi diversi: ` +
                'sai di farne parte adesso, non di passaggio.',
          rewards: { xp: 25, reputation: 3, cachet: 5 },
          setFlags: [`${id}_storia_appresa`],
          next: null,
        },
      },
      {
        id: 'mi_concentro_sul_lavoro',
        label: 'Ringrazi ma resti sul lavoro',
        outcome: {
          text: 'Annuisci e torni alle tue cose. Niente di sbagliato, ma quella storia non te la racconterà più nessuno.',
          rewards: { xp: 10, cachet: 5 },
          next: null,
        },
      },
      {
        id: 'cerco_di_capire_di_piu',
        label: 'Fai una domanda specifica',
        requires: { stat: 'creativity', min: 65 },
        outcome: {
          text: 'La domanda giusta apre una porta: il custode tira fuori un quaderno con appunti che nessuno aveva mai chiesto di vedere.',
          rewards: { xp: 35, reputation: 5, cachet: 10 },
          setFlags: [`${id}_quaderno_trovato`],
          next: null,
        },
      },
    ],
  };
}

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  for (const venue of VENUES) {
    const filename = `${venue.slug}.json`;
    const target = path.join(OUTPUT_DIR, filename);
    if (fs.existsSync(target)) {
      skipped += 1;
      continue;
    }
    const scene = buildScene(venue);
    fs.writeFileSync(target, JSON.stringify(scene, null, 2) + '\n', 'utf8');
    created += 1;
  }

  process.stdout.write(
    `[generate-theater-scenes] created=${created} skipped=${skipped} total=${VENUES.length}\n`,
  );
}

main();
