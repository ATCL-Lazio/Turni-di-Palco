export type RoleId = "attore" | "luci" | "fonico" | "attrezzista" | "palco";
export type Rewards = { xp: number; cachet: number; reputation: number };
export type Role = { id: RoleId; name: string; focus: string; stats: string[] };
export type AvatarIcon = "mask" | "spot" | "gear" | "note";
export type AvatarSettings = {
  hue: number;
  icon: AvatarIcon;
  rpmUrl?: string;
  rpmThumbnail?: string;
  rpmId?: string;
  updatedAt?: number;
};
export type GameEvent = {
  id: string;
  name: string;
  theatre: string;
  date: string;
  lat: number;
  lng: number;
  focusRole?: RoleId;
};
export type TurnRecord = {
  id: string;
  eventId: string;
  eventName: string;
  theatre: string;
  date: string;
  roleId: RoleId;
  rewards: Rewards;
};
export type PlayerProfile = { name: string; roleId: RoleId; xp: number; cachet: number; repAtcl: number; avatar: AvatarSettings };
export type GameState = { version: number; profile: PlayerProfile; turns: TurnRecord[]; checksum: string };
export type SaveStateResult = { ok: boolean; state: GameState; error?: string };

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
    focusRole: "attrezzista",
  },
  {
    id: "ATCL-002",
    name: "Festival Giovani Voci",
    theatre: "Teatro dell'Unione",
    date: "2026-01-10",
    lat: 42.419,
    lng: 12.1077,
    focusRole: "fonico",
  },
  {
    id: "ATCL-003",
    name: "Prima nazionale",
    theatre: "Teatro Palladium",
    date: "2026-02-02",
    lat: 41.8581,
    lng: 12.4816,
    focusRole: "luci",
  },
];

export const STORAGE_KEY = "tdp-game-state";
export const CURRENT_STATE_VERSION = 1;

const MAX_TURNS_PERSISTED = 50;

let memoryFallback: GameState | null = null;

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
  };
}

function sanitizeNumber(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, value);
}

function sanitizeAvatar(raw: Partial<AvatarSettings> | undefined, base: AvatarSettings): AvatarSettings {
  const hue = clampHue(typeof raw?.hue === "number" ? raw.hue : base.hue, base.hue);
  const icon = avatarIcons.some((item) => item.id === raw?.icon) ? (raw?.icon as AvatarIcon) : base.icon;
  const rpmUrl = typeof raw?.rpmUrl === "string" ? raw.rpmUrl : "";
  const rpmThumbnailCandidate = typeof raw?.rpmThumbnail === "string" ? raw.rpmThumbnail : "";
  const rpmThumbnail = rpmThumbnailCandidate || deriveRpmThumbnail(rpmUrl) || base.rpmThumbnail;
  const rpmId = typeof raw?.rpmId === "string" ? raw.rpmId : "";
  const updatedAt = typeof raw?.updatedAt === "number" ? raw.updatedAt : undefined;
  return { ...base, hue, icon, rpmUrl, rpmThumbnail, rpmId, updatedAt };
}

function sanitizeRewards(raw: Partial<Rewards> | undefined): Rewards {
  return {
    xp: sanitizeNumber(raw?.xp, 0),
    cachet: sanitizeNumber(raw?.cachet, 0),
    reputation: sanitizeNumber(raw?.reputation, 0),
  };
}

function sanitizeTurn(raw: unknown, fallbackRole: RoleId): TurnRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const turn = raw as Partial<TurnRecord>;
  const id = typeof turn.id === "string" ? turn.id : "";
  const eventId = typeof turn.eventId === "string" ? turn.eventId : "";
  const eventName = typeof turn.eventName === "string" ? turn.eventName : "";
  const theatre = typeof turn.theatre === "string" ? turn.theatre : "";
  const date = typeof turn.date === "string" ? turn.date : "";
  if (!id || !eventId || !eventName || !theatre || !date) return null;
  const roleId = typeof turn.roleId === "string" && turn.roleId in roleMap ? (turn.roleId as RoleId) : fallbackRole;
  const rewards = sanitizeRewards(turn.rewards);
  return { id, eventId, eventName, theatre, date, roleId, rewards };
}

function sanitizeTurns(rawTurns: unknown[], fallbackRole: RoleId): TurnRecord[] {
  const clean = rawTurns
    .map((turn) => sanitizeTurn(turn, fallbackRole))
    .filter(Boolean) as TurnRecord[];
  return clean.slice(0, MAX_TURNS_PERSISTED);
}

function normalizeProfile(rawProfile: Partial<PlayerProfile> | undefined, base: PlayerProfile): PlayerProfile {
  const safeRole = rawProfile?.roleId && rawProfile.roleId in roleMap ? rawProfile.roleId : base.roleId;
  return {
    ...base,
    ...rawProfile,
    name: typeof rawProfile?.name === "string" ? rawProfile.name : base.name,
    roleId: safeRole as RoleId,
    xp: sanitizeNumber(rawProfile?.xp, base.xp),
    cachet: sanitizeNumber(rawProfile?.cachet, base.cachet),
    repAtcl: sanitizeNumber(rawProfile?.repAtcl, base.repAtcl),
    avatar: sanitizeAvatar(rawProfile?.avatar, base.avatar),
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
  const payload = JSON.stringify({ avatar, turns });
  return computeChecksum(payload);
}

function attachChecksum(state: Omit<GameState, "checksum"> & Partial<Pick<GameState, "checksum">>): GameState {
  const checksum = calculateStateChecksum(state.profile.avatar, state.turns);
  return { ...state, checksum };
}

function normalizeState(raw: Partial<GameState> | null | undefined): GameState {
  const base = baseState();
  const profile = normalizeProfile(raw?.profile, base.profile);
  const turns = Array.isArray(raw?.turns) ? sanitizeTurns(raw.turns, profile.roleId) : [];
  const version = typeof raw?.version === "number" ? raw.version : 0;
  const nextVersion = version < CURRENT_STATE_VERSION ? CURRENT_STATE_VERSION : version;
  const candidate: Omit<GameState, "checksum"> = { version: nextVersion, profile, turns };
  const normalized = attachChecksum(candidate);
  if (raw?.checksum && raw.checksum !== normalized.checksum) {
    console.warn("Game state checksum mismatch. A sanitized copy will be used instead.");
  }
  return normalized;
}

export function createDefaultState(): GameState {
  return normalizeState(baseState());
}

const migrations: ((state: GameState) => GameState)[] = [
  (state) => (state.version < CURRENT_STATE_VERSION ? { ...state, version: CURRENT_STATE_VERSION } : state),
  (state) => attachChecksum(state),
];

function migrateState(raw: Partial<GameState> | null): GameState {
  const normalized = normalizeState(raw);
  const migrated = migrations.reduce((acc, step) => step(acc), normalized);
  if ((raw?.version ?? 0) < CURRENT_STATE_VERSION) {
    console.info(`Game state migrated to version ${CURRENT_STATE_VERSION}`);
  }
  return migrated;
}

export const roleMap = roles.reduce<Record<RoleId, Role>>((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {} as Record<RoleId, Role>);

export function resolveRole(id: RoleId): Role {
  return roleMap[id] ?? roles[0];
}

export function formatRewards(rewards: Rewards) {
  return `+${rewards.xp} XP | +${rewards.cachet} cachet | +${rewards.reputation} rep`;
}

export function deriveRpmThumbnail(url?: string) {
  if (!url) return "";
  try {
    const clean = url.split("?")[0];
    if (clean.endsWith(".glb")) {
      return `${clean.slice(0, -4)}.png`;
    }
    return `${clean}.png`;
  } catch {
    return "";
  }
}

export function getAvatarVisual(avatar: AvatarSettings) {
  const color = `hsl(${avatar.hue}deg 75% 55%)`;
  const iconDef = avatarIcons.find((item) => item.id === avatar.icon) ?? avatarIcons[0];
  const thumb = avatar.rpmThumbnail || deriveRpmThumbnail(avatar.rpmUrl);
  return {
    color,
    icon: iconDef.symbol,
    image: thumb || "",
  };
}

export function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<GameState>) : null;
    const migrated = migrateState(parsed);
    memoryFallback = migrated;
    return migrated;
  } catch {
    console.error("Failed to load game state from storage, using fallback.");
    if (memoryFallback) return memoryFallback;
    const fallback = createDefaultState();
    memoryFallback = fallback;
    return fallback;
  }
}

export function saveState(state: GameState): SaveStateResult {
  const prepared = attachChecksum({ ...state, version: CURRENT_STATE_VERSION });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
    memoryFallback = prepared;
    return { ok: true, state: prepared };
  } catch (error) {
    console.error("Failed to persist game state, using in-memory fallback.", error);
    memoryFallback = prepared;
    return { ok: false, state: prepared, error: error instanceof Error ? error.message : "Unknown storage error" };
  }
}
