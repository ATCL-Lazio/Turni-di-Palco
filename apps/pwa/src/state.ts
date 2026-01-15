import {
  RoleId, Rewards, Role, AvatarIcon, AvatarSettings, GameEvent,
  TurnRecord, PlayerProfile, ActivityStats, TutorialState,
  LeaderboardEntry, LeaderboardStats, GameState, SaveStateResult
} from "./types";

export const roles: Role[] = [
  { id: "attore", name: "Attore / Attrice", focus: "Presenza scenica", stats: ["Presenza", "Memoria", "Versatilita"] },
  { id: "luci", name: "Tecnico luci", focus: "Precisione cue", stats: ["Precisione", "Tempismo", "Stress"] },
  { id: "fonico", name: "Fonico", focus: "Pulizia audio", stats: ["Ascolto", "Reattivita", "Problem solving"] },
  { id: "attrezzista", name: "Attrezzista / Scenografo", focus: "Allestimento rapido", stats: ["Creativita", "Manualita", "Organizzazione"] },
  { id: "palco", name: "Assistente di palco", focus: "Coordinamento", stats: ["Coordinazione", "Leadership", "Sangue freddo"] },
];

export const avatarIcons: { id: AvatarIcon; label: string; symbol: string }[] = [
  { id: "mask", label: "Maschera", symbol: "M" },
  { id: "spot", label: "Spot", symbol: "L" },
  { id: "gear", label: "Tecnica", symbol: "T" },
  { id: "note", label: "Musica", symbol: "N" },
];

export const mockEvents: GameEvent[] = [
  {
    id: "ATCL-001",
    name: "Prova aperta - Latina",
    theatre: "Teatro di Latina",
    date: "2025-12-15",
    lat: 41.4676,
    lng: 12.9037,
    baseRewards: { xp: 35, cachet: 25, reputation: 8 },
    focusRole: "attrezzista",
  },
  {
    id: "ATCL-002",
    name: "Festival Giovani Voci",
    theatre: "Teatro dell'Unione",
    date: "2026-01-10",
    lat: 42.419,
    lng: 12.1077,
    baseRewards: { xp: 45, cachet: 35, reputation: 12 },
    focusRole: "fonico",
  },
  {
    id: "ATCL-003",
    name: "Prima nazionale",
    theatre: "Teatro Palladium",
    date: "2026-02-02",
    lat: 41.8581,
    lng: 12.4816,
    baseRewards: { xp: 60, cachet: 50, reputation: 18 },
    focusRole: "luci",
  },
];

export const STORAGE_KEY = "tdp-game-state";
export const CURRENT_STATE_VERSION = 1;

const MAX_TURNS_PERSISTED = 50;

let memoryFallback: GameState | null = null;

export const roleMap = roles.reduce<Record<RoleId, Role>>((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {} as Record<RoleId, Role>);

function clampHue(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(360, Math.round(value)));
}

function createDefaultProfile(): PlayerProfile {
  return {
    name: "",
    roleId: "attore",
    xp: 0,
    cachet: 0,
    repAtcl: 0,
    avatar: { hue: 210, icon: "mask", rpmUrl: "", rpmThumbnail: "", rpmId: "", updatedAt: undefined },
  };
}

function baseState(): Omit<GameState, "checksum"> {
  return {
    version: CURRENT_STATE_VERSION,
    profile: createDefaultProfile(),
    turns: [],
    activityStats: {},
    tutorial: { firstChoiceComplete: false },
  };
}

function sanitizeNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, value);
}

function deriveRpmThumbnailInternal(url?: string) {
  if (!url) return "";
  try {
    const clean = url.split("?")[0];
    return clean.endsWith(".glb") ? `${clean.slice(0, -4)}.png` : `${clean}.png`;
  } catch { return ""; }
}

function sanitizeAvatar(raw: Partial<AvatarSettings> | undefined, base: AvatarSettings): AvatarSettings {
  const hue = clampHue(typeof raw?.hue === "number" ? raw.hue : base.hue, base.hue);
  const icon = avatarIcons.some((item) => item.id === raw?.icon) ? (raw?.icon as AvatarIcon) : base.icon;
  const rpmUrl = typeof raw?.rpmUrl === "string" ? raw.rpmUrl : "";
  const rpmThumbnail = typeof raw?.rpmThumbnail === "string" ? raw.rpmThumbnail : deriveRpmThumbnailInternal(rpmUrl) || base.rpmThumbnail;
  return { ...base, hue, icon, rpmUrl, rpmThumbnail, rpmId: typeof raw?.rpmId === "string" ? raw.rpmId : "", updatedAt: typeof raw?.updatedAt === "number" ? raw.updatedAt : undefined };
}

function sanitizeRewards(raw: Partial<Rewards> | undefined): Rewards {
  return {
    xp: sanitizeNumber(raw?.xp, 0),
    cachet: sanitizeNumber(raw?.cachet, 0),
    reputation: sanitizeNumber(raw?.reputation, 0),
  };
}

function computeChecksum(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function calculateStateChecksum(avatar: AvatarSettings, turns: TurnRecord[]) {
  return computeChecksum(JSON.stringify({ avatar, turns }));
}

function attachChecksum(state: Omit<GameState, "checksum"> & Partial<Pick<GameState, "checksum">>): GameState {
  return { ...state, checksum: calculateStateChecksum(state.profile.avatar, state.turns) };
}

function normalizeState(raw: Partial<GameState> | null | undefined): GameState {
  const base = baseState();
  const rawProfile = raw?.profile;
  const safeRole = rawProfile?.roleId && rawProfile.roleId in roleMap ? rawProfile.roleId : base.profile.roleId;

  const profile: PlayerProfile = {
    ...base.profile,
    name: typeof rawProfile?.name === "string" ? rawProfile.name : base.profile.name,
    roleId: safeRole as RoleId,
    xp: sanitizeNumber(rawProfile?.xp, base.profile.xp),
    cachet: sanitizeNumber(rawProfile?.cachet, base.profile.cachet),
    repAtcl: sanitizeNumber(rawProfile?.repAtcl, base.profile.repAtcl),
    avatar: sanitizeAvatar(rawProfile?.avatar, base.profile.avatar),
  };

  const turns = Array.isArray(raw?.turns) ? (raw.turns as any[]).map(t => {
    if (!t || typeof t !== "object") return null;
    const roleId = typeof t.roleId === "string" && t.roleId in roleMap ? t.roleId : profile.roleId;
    return { ...t, roleId, rewards: sanitizeRewards(t.rewards) } as TurnRecord;
  }).filter(Boolean).slice(0, MAX_TURNS_PERSISTED) : [];

  const activityStats = raw?.activityStats && typeof raw.activityStats === "object" ? Object.entries(raw.activityStats).reduce((acc, [k, v]) => {
    const r = v as any;
    acc[k] = { runs: sanitizeNumber(r?.runs, 0), lastPlayedAt: typeof r?.lastPlayedAt === "number" ? r.lastPlayedAt : undefined };
    return acc;
  }, {} as Record<string, ActivityStats>) : {};

  const tutorial: TutorialState = { firstChoiceComplete: !!(raw?.tutorial as any)?.firstChoiceComplete };
  const normalized = attachChecksum({ version: Math.max(raw?.version ?? 0, CURRENT_STATE_VERSION), profile, turns, activityStats, tutorial });

  if (raw?.checksum && raw.checksum !== normalized.checksum) {
    console.warn("State checksum mismatch. Sanitized version used.");
  }
  return normalized;
}

export function createDefaultState(): GameState {
  return normalizeState(baseState());
}

export function resolveRole(id: RoleId): Role {
  return roleMap[id] ?? roles[0];
}

export function formatRewards(rewards: Rewards) {
  return `+${rewards.xp} XP | +${rewards.cachet} cachet | +${rewards.reputation} rep`;
}

export function deriveRpmThumbnail(url?: string) { return deriveRpmThumbnailInternal(url); }

export function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = normalizeState(raw ? JSON.parse(raw) : null);
    memoryFallback = state;
    return state;
  } catch {
    return memoryFallback || (memoryFallback = createDefaultState());
  }
}

export function saveState(state: GameState): SaveStateResult {
  const prepared = attachChecksum(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
    memoryFallback = prepared;
    return { ok: true, state: prepared };
  } catch (error) {
    memoryFallback = prepared;
    return { ok: false, state: prepared, error: error instanceof Error ? error.message : "Storage error" };
  }
}

export function calculateLeaderboardStats(entries: LeaderboardEntry[]): LeaderboardStats {
  if (!entries.length) return { totalPlayers: 0, averageXp: 0, topXp: 0, averageReputation: 0, topReputation: 0 };
  const txp = entries.reduce((s, e) => s + e.xpTotal, 0);
  const trep = entries.reduce((s, e) => s + e.reputation, 0);
  return {
    totalPlayers: entries.length,
    averageXp: Math.round(txp / entries.length),
    topXp: Math.max(...entries.map(e => e.xpTotal)),
    averageReputation: Math.round(trep / entries.length),
    topReputation: Math.max(...entries.map(e => e.reputation))
  };
}
