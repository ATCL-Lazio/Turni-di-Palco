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
    baseRewards: Rewards;
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
export type ActivityStats = { runs: number; lastPlayedAt?: number };
export type TutorialState = { firstChoiceComplete: boolean };
export type LeaderboardEntry = {
    id: string;
    name: string;
    roleId: RoleId;
    xpTotal: number;
    cachet: number;
    reputation: number;
    turnsCount: number;
    lastActivityAt?: number;
    profileImage?: string;
};
export type LeaderboardStats = {
    totalPlayers: number;
    averageXp: number;
    topXp: number;
    averageReputation: number;
    topReputation: number;
};
export type GameState = {
    version: number;
    profile: PlayerProfile;
    turns: TurnRecord[];
    activityStats: Record<string, ActivityStats>;
    tutorial: TutorialState;
    checksum: string;
};
export type SaveStateResult = { ok: boolean; state: GameState; error?: string };
