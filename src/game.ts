import "./style.css";
import { registerServiceWorker } from "./pwa/register-sw";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
// Leaflet asset imports for proper bundling
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";

const STORAGE_KEY = "tdp-game-state";

type RoleId = "attore" | "luci" | "fonico" | "attrezzista" | "palco";
type Rewards = { xp: number; cachet: number; reputation: number };
type Role = { id: RoleId; name: string; focus: string; stats: string[] };
type GameEvent = { id: string; name: string; theatre: string; date: string; lat: number; lng: number; focusRole?: RoleId };
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
  <main class="page page-game app-shell">
    <header class="top-bar">
      <div class="app-brand">
        <span class="brand-mark">TdP</span>
        <div>
          <p class="eyebrow">Turni di Palco</p>
          <p class="muted tiny">Interfaccia base del gioco</p>
        </div>
      </div>
      <div class="top-actions">
        <div class="profile-chip" data-profile-chip>
          <div class="avatar-display mini" data-avatar="profile-chip">
            <span class="avatar-icon" data-avatar-label-chip></span>
          </div>
          <div class="profile-chip-text">
            <p class="chip-title" data-chip-name>Profilo</p>
            <p class="muted tiny" data-chip-role>Ruolo non impostato</p>
          </div>
        </div>
        <div class="top-stats">
          <div class="stat-pill"><span>XP</span><strong data-top-stat="xp">0</strong></div>
          <div class="stat-pill"><span>Cachet</span><strong data-top-stat="cachet">0</strong></div>
          <div class="stat-pill"><span>Rep</span><strong data-top-stat="rep">0</strong></div>
        </div>
        <a class="button ghost" href="/">Landing</a>
        <button class="button primary" type="button" data-action="sync-state">Sincronizza</button>
      </div>
    </header>

    <nav class="nav-tabs">
      <a class="chip" href="#map-panel">Mappa</a>
      <a class="chip" href="#profile">Profilo</a>
      <a class="chip" href="#events">Eventi</a>
      <a class="chip" href="#turns">Turni</a>
    </nav>

    <section class="app-stage">
      <div class="map-panel" id="map-panel">
        <div class="map-surface">
          <div class="map-overlay top">
            <div class="pill-row">
              <span class="pill ghost" data-profile-state>Carica i dati dal profilo principale.</span>
              <span class="pill" data-role-label>Ruolo non impostato</span>
            </div>
            <div class="map-controls">
              <button class="button ghost small" type="button" data-action="quick-train">Allenamento</button>
              <button class="button ghost small" type="button" data-action="quick-scene">Scena</button>
              <button class="button ghost small" type="button" data-action="quick-audio">Audio</button>
            </div>
          </div>
          <div class="map-placeholder">
            <div class="avatar-display large" data-avatar="profile">
              <span class="avatar-icon" data-avatar-label></span>
            </div>
            <p class="muted tiny">Mappa interattiva in arrivo - usa le azioni per simulare il loop</p>
          </div>
          <div id="map" class="map-canvas" aria-label="Mappa eventi"></div>
          <div class="map-overlay bottom">
            <div class="stat-board compact">
              <div class="stat-chip">
                <span>XP</span>
                <strong data-stat="xp">0</strong>
              </div>
              <div class="stat-chip">
                <span>Cachet</span>
                <strong data-stat="cachet">0</strong>
              </div>
              <div class="stat-chip">
                <span>Rep</span>
                <strong data-stat="rep">0</strong>
              </div>
            </div>
            <div class="result-box slim" data-quick-result>Mappa pronta.</div>
          </div>
        </div>
      </div>

      <div class="side-stack">
        <section class="panel profile-panel" id="profile">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Profilo</p>
              <h2 class="panel-title">Stato giocatore</h2>
            </div>
          </div>
          <div class="pill-row" data-role-tags></div>
        </section>

        <section class="panel" id="events">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Prossimi eventi</p>
              <h2 class="panel-title">Mock ATCL</h2>
              <p class="muted tiny">Usati per testare il flusso di turni.</p>
            </div>
          </div>
          <ul class="log-list dense" data-event-list></ul>
        </section>

        <section class="panel" id="turns">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Turni</p>
              <h2 class="panel-title">Registro recente</h2>
              <p class="muted tiny">Ultimi turni registrati dal prototipo principale.</p>
            </div>
          </div>
          <ul class="log-list dense" data-turn-log></ul>
        </section>
      </div>
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
const roleLabel = root.querySelector<HTMLElement>('[data-role-label]');
const mapContainer = root.querySelector<HTMLDivElement>("#map");
const mapSurface = root.querySelector<HTMLElement>(".map-surface");
const avatarChip = root.querySelector<HTMLElement>('[data-avatar="profile-chip"]');
const avatarLabelChip = root.querySelector<HTMLElement>('[data-avatar-label-chip]');
const chipName = root.querySelector<HTMLElement>('[data-chip-name]');
const chipRole = root.querySelector<HTMLElement>('[data-chip-role]');
const topStatXp = root.querySelector<HTMLElement>('[data-top-stat="xp"]');
const topStatCachet = root.querySelector<HTMLElement>('[data-top-stat="cachet"]');
const topStatRep = root.querySelector<HTMLElement>('[data-top-stat="rep"]');

let state: GameState = loadState();
let map: LeafletMap | null = null;
let markerLayer: LayerGroup | null = null;
const markerIcon = L.icon({
  iconUrl: markerIconPng,
  shadowUrl: markerShadowPng,
  iconAnchor: [12, 41],
  popupAnchor: [1, -28],
  tooltipAnchor: [12, -16],
});

function resolveRole(id: RoleId): Role {
  return roleMap[id] ?? roles[0];
}

function renderProfile() {
  const profile = state.profile;
  if (statXp) statXp.textContent = profile.xp.toString();
  if (statCachet) statCachet.textContent = profile.cachet.toString();
  if (statRep) statRep.textContent = profile.repAtcl.toString();
  if (topStatXp) topStatXp.textContent = profile.xp.toString();
  if (topStatCachet) topStatCachet.textContent = profile.cachet.toString();
  if (topStatRep) topStatRep.textContent = profile.repAtcl.toString();
  const color = `hsl(${profile.avatar.hue}deg 75% 55%)`;
  const iconDef = avatarIcons.find((item) => item.id === profile.avatar.icon) ?? avatarIcons[0];

  if (avatarProfile) {
    avatarProfile.style.setProperty("--avatar-color", color);
    avatarProfile.style.setProperty("--avatar-hue", `${profile.avatar.hue}deg`);
    if (avatarLabel) avatarLabel.textContent = iconDef.symbol;
  }
  if (avatarChip) {
    avatarChip.style.setProperty("--avatar-color", color);
    avatarChip.style.setProperty("--avatar-hue", `${profile.avatar.hue}deg`);
    if (avatarLabelChip) avatarLabelChip.textContent = iconDef.symbol;
  }
  if (roleTags) {
    const role = resolveRole(profile.roleId);
    roleTags.innerHTML = [
      `<span class="pill ghost">${role.name}</span>`,
      ...role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`),
      `<span class="pill">Focus: ${role.focus}</span>`,
    ].join("");
  }
  const roleText = resolveRole(profile.roleId).name;
  const profileText = profile.name ? `${profile.name} (${roleText})` : "Profilo non configurato";
  if (profileState) {
    profileState.textContent = profile.name
      ? `Profilo: ${profileText}`
      : "Profilo non configurato: torna alla landing e salva un nome/ruolo.";
  }
  if (roleLabel) {
    roleLabel.textContent = profileText;
  }
  if (chipName) {
    chipName.textContent = profile.name || "Profilo";
  }
  if (chipRole) {
    chipRole.textContent = roleText;
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
  renderMapMarkers();
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

function initMap() {
  if (!mapContainer || map) return;
  const defaultCenter = [41.9028, 12.4964] as const; // Roma
  map = L.map(mapContainer, { zoomControl: true }).setView(defaultCenter, 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "OpenStreetMap contributors",
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  renderMapMarkers();
  mapSurface?.classList.add("ready");
}

function renderMapMarkers() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  if (!mockEvents.length) return;
  const bounds: L.LatLngExpression[] = [];
  mockEvents.forEach((event) => {
    const marker = L.marker([event.lat, event.lng], { icon: markerIcon }).bindPopup(
      `<strong>${event.name}</strong><br/>${event.theatre}<br/>${event.date}<br/>Focus: ${event.focusRole ? resolveRole(event.focusRole).name : "Any"}`
    );
    markerLayer.addLayer(marker);
    bounds.push([event.lat, event.lng]);
  });
  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView(bounds[0] as L.LatLngExpression, 11);
  }
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
initMap();

root.querySelector<HTMLButtonElement>('[data-action="sync-state"]')?.addEventListener("click", () => {
  state = loadState();
  renderProfile();
  renderTurns();
  renderMapMarkers();
  if (quickResult) {
    quickResult.dataset.state = "info";
    quickResult.textContent = "Stato ricaricato dal profilo principale.";
  }
});

root.querySelector<HTMLButtonElement>('[data-action="quick-train"]')?.addEventListener("click", () => {
  handleQuick("train");
  renderMapMarkers();
});

root.querySelector<HTMLButtonElement>('[data-action="quick-scene"]')?.addEventListener("click", () => {
  handleQuick("scene");
  renderMapMarkers();
});

root.querySelector<HTMLButtonElement>('[data-action="quick-audio"]')?.addEventListener("click", () => {
  handleQuick("audio");
  renderMapMarkers();
});

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
