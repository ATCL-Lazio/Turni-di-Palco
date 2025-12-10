export type RoleId = "attore" | "luci" | "fonico" | "attrezzista" | "palco";
export type Rewards = { xp: number; cachet: number; reputation: number };
export type Role = { id: RoleId; name: string; focus: string; stats: string[] };
export type AvatarIcon = "mask" | "spot" | "gear" | "note";
export type AvatarSettings = { hue: number; icon: AvatarIcon };
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
export type GameState = { profile: PlayerProfile; turns: TurnRecord[] };

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

export function createDefaultState(): GameState {
  return {
    profile: { name: "", roleId: "attore", xp: 0, cachet: 0, repAtcl: 0, avatar: { hue: 210, icon: "mask" } },
    turns: [],
  };
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

export function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile || !parsed.profile.roleId) return createDefaultState();
    const base = createDefaultState();
    const safeRole = parsed.profile.roleId in roleMap ? parsed.profile.roleId : base.profile.roleId;
    const safeAvatar: AvatarSettings = {
      hue: typeof parsed.profile.avatar?.hue === "number" ? Math.max(0, Math.min(360, parsed.profile.avatar.hue)) : base.profile.avatar.hue,
      icon: avatarIcons.some((item) => item.id === parsed.profile.avatar?.icon) ? (parsed.profile.avatar?.icon as AvatarIcon) : base.profile.avatar.icon,
    };
    return {
      profile: { ...base.profile, ...parsed.profile, roleId: safeRole, avatar: safeAvatar },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}
