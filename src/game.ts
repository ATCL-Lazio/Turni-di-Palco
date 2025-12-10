import "./style.css";
import { registerServiceWorker } from "./pwa/register-sw";

const STORAGE_KEY = "tdp-game-state";

type RoleId = "attore" | "luci" | "fonico" | "attrezzista" | "palco";
type Rewards = { xp: number; cachet: number; reputation: number };
type Role = { id: RoleId; name: string; focus: string; stats: string[] };
type GameEvent = { id: string; name: string; theatre: string; date: string; focusRole?: RoleId };
type AvatarIcon = "mask" | "spot" | "gear" | "note";
type AvatarSettings = { hue: number; icon: AvatarIcon };
type TurnRecord = {
  id: string;
  eventId: string;
  eventName: string;
  theatre: string;
  date: string;
  roleId: RoleId;
  rewards: Rewards;
};
type PlayerProfile = { name: string; roleId: RoleId; xp: number; cachet: number; repAtcl: number; avatar: AvatarSettings };
type GameState = { profile: PlayerProfile; turns: TurnRecord[] };

const roles: Role[] = [
  { id: "attore", name: "Attore / Attrice", focus: "Presenza scenica", stats: ["Presenza", "Memoria", "Versatilita"] },
  { id: "luci", name: "Tecnico luci", focus: "Precisione cue", stats: ["Precisione", "Tempismo", "Stress"] },
  { id: "fonico", name: "Fonico", focus: "Pulizia audio", stats: ["Ascolto", "Reattivita", "Problem solving"] },
  { id: "attrezzista", name: "Attrezzista / Scenografo", focus: "Allestimento rapido", stats: ["Creativita", "Manualita", "Organizzazione"] },
  { id: "palco", name: "Assistente di palco", focus: "Coordinamento", stats: ["Coordinazione", "Leadership", "Sangue freddo"] },
];

const avatarIcons: { id: AvatarIcon; label: string; symbol: string }[] = [
  { id: "mask", label: "Maschera", symbol: "M" },
  { id: "spot", label: "Spot", symbol: "L" },
  { id: "gear", label: "Tecnica", symbol: "T" },
  { id: "note", label: "Musica", symbol: "N" },
];

const roleMap = roles.reduce<Record<RoleId, Role>>((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {} as Record<RoleId, Role>);

const mockEvents: GameEvent[] = [
  { id: "ATCL-001", name: "Prova aperta - Latina", theatre: "Teatro di Latina", date: "2025-12-15", focusRole: "attrezzista" },
  { id: "ATCL-002", name: "Festival Giovani Voci", theatre: "Teatro dell'Unione", date: "2026-01-10", focusRole: "fonico" },
  { id: "ATCL-003", name: "Prima nazionale", theatre: "Teatro Palladium", date: "2026-02-02", focusRole: "luci" },
];

const defaultState: GameState = {
  profile: { name: "", roleId: "attore", xp: 0, cachet: 0, repAtcl: 0, avatar: { hue: 210, icon: "mask" } },
  turns: [],
};

function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile || !parsed.profile.roleId) return defaultState;
    const safeRole = parsed.profile.roleId in roleMap ? parsed.profile.roleId : defaultState.profile.roleId;
    const safeAvatar: AvatarSettings = {
      hue: typeof parsed.profile.avatar?.hue === "number" ? Math.max(0, Math.min(360, parsed.profile.avatar.hue)) : defaultState.profile.avatar.hue,
      icon: avatarIcons.some((item) => item.id === parsed.profile.avatar?.icon) ? (parsed.profile.avatar?.icon as AvatarIcon) : defaultState.profile.avatar.icon,
    };
    return {
      profile: { ...defaultState.profile, ...parsed.profile, roleId: safeRole, avatar: safeAvatar },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    };
  } catch {
    return defaultState;
  }
}

function saveState(state: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function formatRewards(rewards: Rewards) {
  return `+${rewards.xp} XP | +${rewards.cachet} cachet | +${rewards.reputation} rep`;
}

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page page-game">
    <header class="hero">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Interfaccia base del gioco</h1>
      <p class="lede">Panoramica del profilo, azioni rapide e eventi mock. Torna alla landing per configurare il profilo.</p>
      <div class="cta-row">
        <a class="button ghost" href="/">Torna alla landing</a>
        <button class="button primary" type="button" data-action="sync-state">Aggiorna dati locali</button>
      </div>
    </header>

    <section class="grid">
      <article class="card">
        <h2>Profilo</h2>
        <p class="muted" data-profile-state>Carica i dati dal profilo principale.</p>
        <div class="avatar-display" data-avatar="profile">
          <span class="avatar-icon" data-avatar-label></span>
        </div>
        <ul class="stat-list">
          <li><span>XP</span><strong data-stat="xp">0</strong></li>
          <li><span>Cachet</span><strong data-stat="cachet">0</strong></li>
          <li><span>Reputazione ATCL</span><strong data-stat="rep">0</strong></li>
        </ul>
        <div class="pill-row" data-role-tags></div>
      </article>

      <article class="card">
        <h2>Attivita rapida</h2>
        <p class="muted">Simula un'azione veloce per testare il loop di ricompense.</p>
        <div class="cta-row">
          <button class="button primary" type="button" data-action="quick-train">Allenamento breve</button>
          <button class="button ghost" type="button" data-action="quick-scene">Gestione scena</button>
          <button class="button ghost" type="button" data-action="quick-audio">Check audio</button>
        </div>
        <div class="result-box" data-quick-result>Nessuna attivita eseguita.</div>
      </article>

      <article class="card">
        <h2>Prossimi eventi (mock)</h2>
        <ul class="log-list" data-event-list></ul>
      </article>

      <article class="card">
        <h2>Registro turni</h2>
        <p class="muted">Mostra gli ultimi turni registrati dal prototipo principale.</p>
        <ul class="log-list" data-turn-log></ul>
      </article>
    </section>
  </main>
`;

const statXp = root.querySelector<HTMLElement>('[data-stat="xp"]');
const statCachet = root.querySelector<HTMLElement>('[data-stat="cachet"]');
const statRep = root.querySelector<HTMLElement>('[data-stat="rep"]');
const roleTags = root.querySelector<HTMLElement>('[data-role-tags]');
const profileState = root.querySelector<HTMLElement>('[data-profile-state]');
const quickResult = root.querySelector<HTMLElement>('[data-quick-result]');
const eventList = root.querySelector<HTMLElement>('[data-event-list]');
const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');
const avatarProfile = root.querySelector<HTMLElement>('[data-avatar="profile"]');
const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');

let state: GameState = loadState();

function resolveRole(id: RoleId): Role {
  return roleMap[id] ?? roles[0];
}

function renderProfile() {
  const profile = state.profile;
  if (statXp) statXp.textContent = profile.xp.toString();
  if (statCachet) statCachet.textContent = profile.cachet.toString();
  if (statRep) statRep.textContent = profile.repAtcl.toString();
  if (avatarProfile) {
    const color = `hsl(${profile.avatar.hue}deg 75% 55%)`;
    avatarProfile.style.setProperty("--avatar-color", color);
    avatarProfile.style.setProperty("--avatar-hue", `${profile.avatar.hue}deg`);
    const iconDef = avatarIcons.find((item) => item.id === profile.avatar.icon) ?? avatarIcons[0];
    if (avatarLabel) avatarLabel.textContent = iconDef.symbol;
  }
  if (roleTags) {
    const role = resolveRole(profile.roleId);
    roleTags.innerHTML = [
      `<span class="pill ghost">${role.name}</span>`,
      ...role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`),
      `<span class="pill">Focus: ${role.focus}</span>`,
    ].join("");
  }
  if (profileState) {
    profileState.textContent = profile.name
      ? `Profilo: ${profile.name} (${resolveRole(profile.roleId).name})`
      : "Profilo non configurato: torna alla landing e salva un nome/ruolo.";
  }
}

function renderEvents() {
  if (!eventList) return;
  if (!mockEvents.length) {
    eventList.innerHTML = `<li class="muted">Nessun evento mock.</li>`;
    return;
  }
  eventList.innerHTML = mockEvents
    .map(
      (item) =>
        `<li><div><strong>${item.name}</strong> - ${item.theatre}</div><div class="muted">${item.date} | Focus: ${item.focusRole ? resolveRole(item.focusRole).name : "Any"}</div></li>`
    )
    .join("");
}

function renderTurns() {
  if (!turnLog) return;
  if (!state.turns.length) {
    turnLog.innerHTML = `<li class="muted">Nessun turno registrato ancora.</li>`;
    return;
  }
  turnLog.innerHTML = state.turns
    .slice(0, 6)
    .map(
      (turn) =>
        `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
    )
    .join("");
}

function applyQuick(rewards: Rewards, label: string) {
  state = {
    ...state,
    profile: {
      ...state.profile,
      xp: state.profile.xp + rewards.xp,
      cachet: state.profile.cachet + rewards.cachet,
      repAtcl: state.profile.repAtcl + rewards.reputation,
    },
  };
  saveState(state);
  renderProfile();
  if (quickResult) {
    quickResult.dataset.state = "ok";
    quickResult.textContent = `${label}: ${formatRewards(rewards)}`;
  }
}

function handleQuick(action: "train" | "scene" | "audio") {
  const role = resolveRole(state.profile.roleId);
  if (action === "train") {
    applyQuick({ xp: 12, cachet: 6, reputation: 4 }, "Allenamento completato");
  } else if (action === "scene") {
    const bonus = role.id === "attrezzista" || role.id === "palco" ? 4 : 0;
    applyQuick({ xp: 10 + bonus, cachet: 8, reputation: 6 }, "Gestione scena");
  } else {
    const bonus = role.id === "fonico" ? 5 : 0;
    applyQuick({ xp: 9 + bonus, cachet: 7, reputation: 5 }, "Check audio");
  }
}

renderProfile();
renderEvents();
renderTurns();

root.querySelector<HTMLButtonElement>('[data-action="sync-state"]')?.addEventListener("click", () => {
  state = loadState();
  renderProfile();
  renderTurns();
  if (quickResult) {
    quickResult.dataset.state = "info";
    quickResult.textContent = "Stato ricaricato dal profilo principale.";
  }
});

root.querySelector<HTMLButtonElement>('[data-action="quick-train"]')?.addEventListener("click", () => {
  handleQuick("train");
});

root.querySelector<HTMLButtonElement>('[data-action="quick-scene"]')?.addEventListener("click", () => {
  handleQuick("scene");
});

root.querySelector<HTMLButtonElement>('[data-action="quick-audio"]')?.addEventListener("click", () => {
  handleQuick("audio");
});

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
