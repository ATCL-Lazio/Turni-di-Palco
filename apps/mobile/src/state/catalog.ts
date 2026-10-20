import type { RoleProfile, Role, GameEvent, Activity, ShopCatalogItem } from './types';

// TODO: spostare i profili ruolo nel catalogo remoto per evitare duplicazione tra client e seed SQL.
// Moltiplicatori derivati dalla formula: xpMultiplier = 1 + (statRelevante / 100) * 0.25
// Stat rilevante per attività: ritardo→leadership, audio→precision, palco→leadership,
//   recitazione→presence, copione→creativity, sequenza_luci→precision, equalizzazione→precision
// Closes #471

const ATTORE_PROFILE: RoleProfile = {
  activityOverrides: {
    recitazione:   { xpMultiplier: 1.23, cachetMultiplier: 1.23, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    copione:       { xpMultiplier: 1.21, cachetMultiplier: 1.21, reputationBonus: 2 },
    audio:         { xpMultiplier: 1.18, cachetMultiplier: 1.18 },
    ritardo:       { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
    palco:         { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
  },
};

const LUCI_PROFILE: RoleProfile = {
  activityOverrides: {
    audio:         { xpMultiplier: 1.24, cachetMultiplier: 1.24, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    sequenza_luci: { xpMultiplier: 1.24, cachetMultiplier: 1.24, reputationBonus: 4, highlightLabel: 'Specialità ruolo' },
    copione:       { xpMultiplier: 1.19, cachetMultiplier: 1.19 },
    ritardo:       { xpMultiplier: 1.16, cachetMultiplier: 1.16 },
    palco:         { xpMultiplier: 1.16, cachetMultiplier: 1.16 },
    recitazione:   { xpMultiplier: 1.13, cachetMultiplier: 1.13 },
  },
};

const FONICO_PROFILE: RoleProfile = {
  activityOverrides: {
    audio:          { xpMultiplier: 1.23, cachetMultiplier: 1.23, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    equalizzazione: { xpMultiplier: 1.23, cachetMultiplier: 1.23, reputationBonus: 4, highlightLabel: 'Specialità ruolo' },
    copione:        { xpMultiplier: 1.18, cachetMultiplier: 1.18 },
    ritardo:        { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
    palco:          { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
    recitazione:    { xpMultiplier: 1.11, cachetMultiplier: 1.11 },
  },
};

const ATTREZZISTA_PROFILE: RoleProfile = {
  activityOverrides: {
    copione:    { xpMultiplier: 1.23, cachetMultiplier: 1.23, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    audio:      { xpMultiplier: 1.21, cachetMultiplier: 1.21 },
    ritardo:    { xpMultiplier: 1.18, cachetMultiplier: 1.18 },
    palco:      { xpMultiplier: 1.18, cachetMultiplier: 1.18 },
    recitazione: { xpMultiplier: 1.14, cachetMultiplier: 1.14 },
  },
};

const PALCO_PROFILE: RoleProfile = {
  activityOverrides: {
    ritardo:    { xpMultiplier: 1.21, cachetMultiplier: 1.21, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    palco:      { xpMultiplier: 1.21, cachetMultiplier: 1.21, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    audio:      { xpMultiplier: 1.22, cachetMultiplier: 1.22 },
    recitazione: { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
    copione:    { xpMultiplier: 1.16, cachetMultiplier: 1.16 },
  },
};

const RSPP_PROFILE: RoleProfile = {
  activityOverrides: {
    ritardo:    { xpMultiplier: 1.22, cachetMultiplier: 1.22, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    palco:      { xpMultiplier: 1.22, cachetMultiplier: 1.22, reputationBonus: 3, highlightLabel: 'Punto di forza' },
    audio:      { xpMultiplier: 1.23, cachetMultiplier: 1.23 },
    recitazione: { xpMultiplier: 1.16, cachetMultiplier: 1.16 },
    copione:    { xpMultiplier: 1.15, cachetMultiplier: 1.15 },
  },
};

const DRAMATURG_PROFILE: RoleProfile = {
  allowedActivityIds: ['copione', 'recitazione', 'ritardo'],
  activityOrder: ['copione', 'recitazione', 'ritardo'],
  homeMessage: 'Oggi il focus è rifinire ritmo, sottotesto e continuità di scena.',
  journey: {
    eyebrow: 'Percorso ruolo',
    headline: 'Costruisci il battito della scena prima dell\'ingresso in palco.',
    summary: 'Parti da Revisione copione, consolida il sottotesto e sblocca i primi badge di ruolo.',
    recommendedActivityId: 'copione',
    starterBadgeLabels: ['Primo briefing drammaturgico', 'Occhio sul testo'],
    objectives: [
      'Avvia Revisione copione e completa il primo briefing',
      'Mantieni almeno 80/100 in tre sessioni sul testo',
      'Usa Recitazione per validare ritmo e ingressi',
    ],
    homeCtaLabel: 'Apri percorso dramaturg',
  },
  activityOverrides: {
    copione:    { xpMultiplier: 1.23, cachetMultiplier: 1.23, reputationBonus: 4, highlightLabel: 'Missione dramaturg', homeNote: 'Perfetta per sbloccare i badge dedicati al testo.' },
    recitazione: { xpMultiplier: 1.18, cachetMultiplier: 1.18, reputationBonus: 2, highlightLabel: 'Analisi sottotesto' },
    ritardo:    { xpMultiplier: 1.20, cachetMultiplier: 1.20 },
    audio:      { xpMultiplier: 1.21, cachetMultiplier: 1.21 },
    palco:      { xpMultiplier: 1.20, cachetMultiplier: 1.20 },
  },
};

export const roles: Role[] = [
  { id: 'attore',      name: 'Attore / Attrice',         focus: 'Presenza scenica',     stats: { presence: 90, precision: 70, leadership: 60, creativity: 85 }, profile: ATTORE_PROFILE },
  { id: 'luci',        name: 'Tecnico Luci',             focus: 'Precisione cue',        stats: { presence: 50, precision: 95, leadership: 65, creativity: 75 }, profile: LUCI_PROFILE },
  { id: 'fonico',      name: 'Fonico',                   focus: 'Pulizia audio',         stats: { presence: 45, precision: 90, leadership: 60, creativity: 70 }, profile: FONICO_PROFILE },
  { id: 'attrezzista', name: 'Attrezzista / Scenografo', focus: 'Allestimento rapido',   stats: { presence: 55, precision: 85, leadership: 70, creativity: 90 }, profile: ATTREZZISTA_PROFILE },
  { id: 'palco',       name: 'Assistente di Palco',      focus: 'Coordinamento',         stats: { presence: 60, precision: 88, leadership: 85, creativity: 65 }, profile: PALCO_PROFILE },
  { id: 'rspp',        name: 'RSPP',                     focus: 'Sicurezza e prevenzione', stats: { presence: 65, precision: 92, leadership: 88, creativity: 58 }, profile: RSPP_PROFILE },
  {
    id: 'dramaturg',
    name: 'Dramaturg',
    focus: 'Analisi del testo e ritmo di scena',
    stats: { presence: 70, precision: 82, leadership: 78, creativity: 92 },
    profile: DRAMATURG_PROFILE,
  },
];

// Catalogo eventi locale di fallback (solo DEV, quando Supabase non è
// configurato). Gli eventi reali del circuito ATCL vengono importati dal vivo
// (`tools/import-events.js`) nella tabella Supabase `events`. Intenzionalmente
// vuoto: nessun evento mock/fittizio viene distribuito nel client.
export const events: GameEvent[] = [];

export const activities: Activity[] = [
  {
    id: 'ritardo',
    title: 'Prova generale in ritardo',
    description: 'La compagnia è in ritardo di 20 minuti. Devi gestire la situazione e chiudere la prova.',
    duration: '5 min',
    xpReward: 50,
    cachetReward: 20,
    difficulty: 'Medio',
  },
  {
    id: 'audio',
    title: 'Prova audio critica',
    description: 'Un rientro micro crea Larsen. Il tempo stringe prima dell’apertura porte.',
    duration: '6 min',
    xpReward: 60,
    cachetReward: 25,
    difficulty: 'Difficile',
  },
  {
    id: 'palco',
    title: 'Cambio scena rapido',
    description: 'Il cambio scena tra due atti è più lento del previsto. Serve velocizzare.',
    duration: '4 min',
    xpReward: 55,
    cachetReward: 22,
    difficulty: 'Medio',
  },
  {
    id: 'recitazione',
    title: 'Prova di recitazione',
    description: 'Esercita le tue abilità di interpretazione con un monologo classico.',
    duration: '5 min',
    xpReward: 45,
    cachetReward: 18,
    difficulty: 'Facile',
  },
  {
    id: 'copione',
    title: 'Revisione copione',
    description: 'Analizza le transizioni del testo e blocca i passaggi critici nel punto giusto.',
    duration: '5 min',
    xpReward: 58,
    cachetReward: 24,
    difficulty: 'Medio',
  },
  // Issue #469: Espansione minigiochi per ruoli specifici
  {
    id: 'sequenza_luci',
    title: 'Sequenza cue luci',
    description: 'Esegui una sequenza di cue luci in rapida successione. Precisione estrema richiesta per tecnici luci.',
    duration: '6 min',
    xpReward: 75,
    cachetReward: 35,
    difficulty: 'Difficile',
  },
  {
    id: 'equalizzazione',
    title: 'Equalizzazione frequenze',
    description: 'Bilancia le frequenze basse, medie e alte per un mix audio perfetto. Solo per fonici esperti.',
    duration: '5 min',
    xpReward: 70,
    cachetReward: 32,
    difficulty: 'Difficile',
  },
];

export const DEFAULT_SHOP_CATALOG: ShopCatalogItem[] = [
  {
    code: 'extra_slot_permanent',
    title: 'Slot attività extra (permanente)',
    description: 'Aumenta il numero massimo di attività giornaliere.',
    category: 'slot',
    costCachet: 4000,
    effectValue: 1,
    maxPurchasesPerUser: 2,
    active: true,
  },
  {
    code: 'rep_pack_atcl',
    title: 'Pack reputazione ATCL',
    description: 'Aumenta la reputazione ATCL globale.',
    category: 'rep_atcl',
    costCachet: 1200,
    effectValue: 10,
    maxPurchasesPerUser: null,
    active: true,
  },
  {
    code: 'rep_pack_theatre',
    title: 'Pack reputazione Teatro',
    description: 'Aumenta la reputazione in un teatro già giocato.',
    category: 'rep_theatre',
    costCachet: 1800,
    effectValue: 15,
    maxPurchasesPerUser: null,
    active: true,
  },
];
