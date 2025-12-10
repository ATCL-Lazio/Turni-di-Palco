import "./style.css";
import { registerServiceWorker } from "./pwa/register-sw";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";
import {
  AvatarIcon,
  avatarIcons,
  formatRewards,
  GameState,
  loadState,
  mockEvents,
  resolveRole,
  Rewards,
  RoleId,
  saveState,
} from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="map-app">
    <div id="map" class="map-canvas" aria-label="Mappa eventi"></div>

    <header class="map-topbar">
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

    <div class="map-actions">
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

    <section class="map-drawer">
      <div class="drawer-header">
        <div class="drawer-tabs">
          <button class="chip" data-drawer-tab="events">Eventi</button>
          <button class="chip" data-drawer-tab="turns">Turni</button>
          <button class="chip" data-drawer-tab="profile">Profilo</button>
        </div>
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
      </div>
      <div class="drawer-body">
        <div class="drawer-section" data-section="profile">
          <div class="pill-row" data-role-tags></div>
          <div class="result-box slim" data-quick-result>Mappa pronta.</div>
        </div>
        <div class="drawer-section" data-section="events">
          <p class="muted tiny">Prossimi eventi mock</p>
          <ul class="log-list dense" data-event-list></ul>
        </div>
        <div class="drawer-section" data-section="turns">
          <p class="muted tiny">Registro recente</p>
          <ul class="log-list dense" data-turn-log></ul>
        </div>
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
const avatarChip = root.querySelector<HTMLElement>('[data-avatar="profile-chip"]');
const avatarLabelChip = root.querySelector<HTMLElement>('[data-avatar-label-chip]');
const chipName = root.querySelector<HTMLElement>('[data-chip-name]');
const chipRole = root.querySelector<HTMLElement>('[data-chip-role]');
const topStatXp = root.querySelector<HTMLElement>('[data-top-stat="xp"]');
const topStatCachet = root.querySelector<HTMLElement>('[data-top-stat="cachet"]');
const topStatRep = root.querySelector<HTMLElement>('[data-top-stat="rep"]');
const drawerTabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-drawer-tab]"));
const drawerSections = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));

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

function setDrawer(sectionId: "events" | "turns" | "profile") {
  drawerTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.drawerTab === sectionId);
  });
  drawerSections.forEach((section) => {
    section.classList.toggle("active", section.dataset.section === sectionId);
  });
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
window.setTimeout(() => {
  map?.invalidateSize();
}, 200);
window.addEventListener("resize", () => {
  map?.invalidateSize();
});
setDrawer("events");

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

drawerTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.drawerTab as "events" | "turns" | "profile" | undefined;
    if (target) {
      setDrawer(target);
    }
  });
});

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
