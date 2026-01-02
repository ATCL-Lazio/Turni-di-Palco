import "../../../shared/styles/main.css";
import { registerServiceWorker } from "./pwa/register-sw";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIconPng from "leaflet/dist/images/marker-icon.png";
import markerShadowPng from "leaflet/dist/images/marker-shadow.png";
import { renderChip } from "./components/chip";
import { renderStatPill } from "./components/stat-pill";
import {
  formatRewards,
  getAvatarVisual,
  loadState,
  mockEvents,
  resolveRole,
  Rewards,
  RoleId,
  roles,
  TurnRecord,
  saveState,
} from "./state";

type DecoratedEvent = (typeof mockEvents)[number] & { distanceKm: number };
type DrawerSection = "events" | "turns" | "profile";

const defaultCenter = [41.9028, 12.4964] as const; // Roma
const DEFAULT_DISTANCE_KM = 220;
const MAX_STORED_TURNS = 10;

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

const topStatsMarkup = [
  renderStatPill({ label: "XP", value: 0, size: "sm", icon: "⭐", valueAttributes: { "data-top-stat": "xp" } }),
  renderStatPill({ label: "Cachet", value: 0, size: "sm", icon: "💰", valueAttributes: { "data-top-stat": "cachet" } }),
  renderStatPill({ label: "Rep", value: 0, size: "sm", icon: "📣", valueAttributes: { "data-top-stat": "rep" } }),
].join("");

const drawerTabsMarkup = [
  renderChip({
    label: "Eventi",
    size: "sm",
    variant: "ghost",
    state: "active",
    dataAttributes: { "drawer-tab": "events", "tab-id": "tab-events" },
  }),
  renderChip({ label: "Turni", size: "sm", variant: "ghost", dataAttributes: { "drawer-tab": "turns", "tab-id": "tab-turns" } }),
  renderChip({
    label: "Profilo",
    size: "sm",
    variant: "ghost",
    dataAttributes: { "drawer-tab": "profile", "tab-id": "tab-profile" },
  }),
].join("");

root.innerHTML = `
  <main class="map-app">
    <div id="map" class="map-canvas" aria-label="Mappa eventi"></div>

    <header class="map-topbar">
      <div class="app-brand">
        <span class="brand-mark">TdP</span>
        <div>
          <p class="eyebrow">Turni di Palco</p>
          <p class="muted tiny">Mappa eventi</p>
        </div>
      </div>
      <div class="top-actions">
        <div class="profile-chip" data-profile-chip>
          <div class="avatar-display mini" data-avatar="profile-chip">
            <img data-avatar-img-chip alt="Avatar ReadyPlayerMe" />
            <span class="avatar-icon" data-avatar-label-chip></span>
          </div>
          <div class="profile-chip-text">
            <p class="chip-title" data-chip-name>Profilo</p>
            <p class="muted tiny" data-chip-role>Ruolo non impostato</p>
          </div>
        </div>
        <div class="top-stats">${topStatsMarkup}</div>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/">Landing</a>
        <a class="button ghost" href="/profile.html">Profilo</a>
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
        <div class="drawer-tabs" role="tablist" aria-label="Sezioni mappa" data-tablist="drawer">${drawerTabsMarkup}</div>
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
        <div class="drawer-section" data-section="profile" id="panel-profile" role="tabpanel" aria-labelledby="tab-profile">
          <div class="pill-row" data-role-tags></div>
          <div class="result-box slim" data-quick-result>Mappa pronta.</div>
        </div>
        <div class="drawer-section" data-section="events" id="panel-events" role="tabpanel" aria-labelledby="tab-events">
          <div class="drawer-filters" role="group" aria-label="Filtri eventi">
            <label class="field inline">
              <span>Ruolo focus</span>
              <select data-filter-role aria-label="Filtra eventi per ruolo">
                <option value="all">Tutti i ruoli</option>
                ${roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}
              </select>
            </label>
            <label class="field inline">
              <span>Data massima</span>
              <input type="date" data-filter-date aria-label="Filtra per data" />
            </label>
            <label class="field inline">
              <span>Distanza max: <strong data-distance-value>${DEFAULT_DISTANCE_KM}</strong> km</span>
              <input type="range" min="30" max="420" step="10" value="${DEFAULT_DISTANCE_KM}" data-filter-distance aria-label="Filtra per distanza" />
            </label>
          </div>
          <div class="pill-row focus-row" data-focus-hints></div>
          <div class="inline-feedback" data-loading-indicator hidden aria-live="polite">Caricamento eventi...</div>
          <div class="compact-note" data-compact-note role="status" aria-live="polite" hidden>Layout compatto: usa i tab o apri la mappa a tutto schermo per leggere i dettagli.</div>
          <div class="event-detail" data-event-detail>
            <div data-event-content>
              <p class="muted">Seleziona un evento per vedere i dettagli.</p>
            </div>
            <div class="detail-actions">
              <button class="button primary" type="button" data-action="register-turn" disabled>Registra turno</button>
              <div class="result-box slim" data-event-feedback>In attesa di selezione.</div>
            </div>
          </div>
          <p class="muted tiny" data-filter-summary>Prossimi eventi mock</p>
          <ul class="log-list dense" data-event-list></ul>
        </div>
        <div class="drawer-section" data-section="turns" id="panel-turns" role="tabpanel" aria-labelledby="tab-turns">
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
const roleLabel = root.querySelector<HTMLElement>('[data-role-label]');
const mapContainer = root.querySelector<HTMLDivElement>("#map");
const avatarChip = root.querySelector<HTMLElement>('[data-avatar="profile-chip"]');
const avatarLabelChip = root.querySelector<HTMLElement>('[data-avatar-label-chip]');
const avatarChipImg = root.querySelector<HTMLImageElement>('[data-avatar-img-chip]');
const chipName = root.querySelector<HTMLElement>('[data-chip-name]');
const chipRole = root.querySelector<HTMLElement>('[data-chip-role]');
const topStatXp = root.querySelector<HTMLElement>('[data-top-stat="xp"]');
const topStatCachet = root.querySelector<HTMLElement>('[data-top-stat="cachet"]');
const topStatRep = root.querySelector<HTMLElement>('[data-top-stat="rep"]');
const drawerTabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-drawer-tab]"));
const drawerSections = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));
const drawerTablist = root.querySelector<HTMLElement>('[data-tablist="drawer"]');
const filterRoleSelect = root.querySelector<HTMLSelectElement>('[data-filter-role]');
const filterDateInput = root.querySelector<HTMLInputElement>('[data-filter-date]');
const filterDistanceInput = root.querySelector<HTMLInputElement>('[data-filter-distance]');
const distanceValue = root.querySelector<HTMLElement>('[data-distance-value]');
const filterSummary = root.querySelector<HTMLElement>('[data-filter-summary]');
const focusHints = root.querySelector<HTMLElement>('[data-focus-hints]');
const eventContent = root.querySelector<HTMLElement>('[data-event-content]');
const eventFeedback = root.querySelector<HTMLElement>('[data-event-feedback]');
const loadingIndicator = root.querySelector<HTMLElement>('[data-loading-indicator]');
const compactNote = root.querySelector<HTMLElement>('[data-compact-note]');
const registerTurnButton = root.querySelector<HTMLButtonElement>('[data-action="register-turn"]');

let state = loadState();
let map: LeafletMap | null = null;
let markerLayer: LayerGroup | null = null;
const markerMap = new Map<string, L.Marker>();
let filteredEvents: DecoratedEvent[] = [];
let selectedEventId: string | null = null;
const eventFilters: { role: RoleId | "all"; date: string; distance: number } = {
  role: "all",
  date: "",
  distance: DEFAULT_DISTANCE_KM,
};
const markerIcon = L.icon({
  iconUrl: markerIconPng,
  shadowUrl: markerShadowPng,
  iconAnchor: [12, 41],
  popupAnchor: [1, -28],
  tooltipAnchor: [12, -16],
});

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function computeDistanceKm(lat: number, lng: number) {
  const [centerLat, centerLng] = defaultCenter;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - centerLat);
  const dLng = toRadians(lng - centerLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(centerLat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0, Math.round(earthRadiusKm * c));
}

function setEventLoading(isLoading: boolean) {
  if (eventList) eventList.setAttribute("aria-busy", String(isLoading));
  if (loadingIndicator) loadingIndicator.hidden = !isLoading;
}

function updateDistanceLabel(value: number) {
  if (distanceValue) distanceValue.textContent = value.toString();
}

function updateViewportNote() {
  if (compactNote) {
    compactNote.hidden = window.innerWidth >= 720;
  }
}

function renderProfile() {
  const profile = state.profile;
  const avatarVisual = getAvatarVisual(profile.avatar);
  if (statXp) statXp.textContent = profile.xp.toString();
  if (statCachet) statCachet.textContent = profile.cachet.toString();
  if (statRep) statRep.textContent = profile.repAtcl.toString();
  if (topStatXp) topStatXp.textContent = profile.xp.toString();
  if (topStatCachet) topStatCachet.textContent = profile.cachet.toString();
  if (topStatRep) topStatRep.textContent = profile.repAtcl.toString();
  if (avatarChip) {
    avatarChip.style.setProperty("--avatar-color", avatarVisual.color);
    avatarChip.style.setProperty("--avatar-hue", `${profile.avatar.hue}deg`);
    avatarChip.classList.toggle("has-image", !!avatarVisual.image);
    if (avatarLabelChip) avatarLabelChip.textContent = avatarVisual.icon;
    if (avatarChipImg) {
      if (avatarVisual.image) {
        avatarChipImg.src = avatarVisual.image;
        avatarChipImg.style.display = "block";
      } else {
        avatarChipImg.removeAttribute("src");
        avatarChipImg.style.display = "none";
      }
    }
  }
  const role = resolveRole(profile.roleId);
  const roleText = profile.name ? `${profile.name} (${role.name})` : "Profilo non configurato";
  if (profileState) {
    profileState.textContent = profile.name
      ? `Profilo: ${roleText}`
      : "Profilo non configurato: torna alla landing e salva un nome/ruolo.";
  }
  if (roleLabel) {
    roleLabel.textContent = roleText;
  }
  if (chipName) {
    chipName.textContent = profile.name || "Profilo";
  }
  if (chipRole) {
    chipRole.textContent = role.name;
  }
  if (roleTags) {
    roleTags.innerHTML = role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("");
  }
}

function computeTurnRewards(event: DecoratedEvent, roleId: RoleId): Rewards {
  const bonus = event.focusRole && event.focusRole === roleId ? 8 : 0;
  return {
    xp: event.baseRewards.xp + bonus,
    cachet: event.baseRewards.cachet + Math.round(bonus / 2),
    reputation: event.baseRewards.reputation + Math.round(bonus / 4),
  };
}

function renderFocusIndicators(targetEvent?: DecoratedEvent) {
  if (!focusHints) return;
  const activeRole = resolveRole(state.profile.roleId);
  const focusRole = targetEvent?.focusRole ? resolveRole(targetEvent.focusRole) : null;
  const match = focusRole?.id === activeRole.id;
  const focusLabel = focusRole ? focusRole.name : "Multi-ruolo";
  focusHints.innerHTML = `
    <span class="focus-pill active">Ruolo attivo: ${activeRole.name}</span>
    <span class="focus-pill ${match ? "match" : "ghost"}">Focus evento: ${focusLabel}${match ? " (match)" : ""}</span>
  `;
}

function renderEventDetail(event?: DecoratedEvent) {
  if (!eventContent || !eventFeedback || !registerTurnButton) return;
  if (!event) {
    eventContent.innerHTML = `<p class="muted">Seleziona un evento per vedere i dettagli.</p>`;
    registerTurnButton.disabled = true;
    registerTurnButton.removeAttribute("data-event-id");
    eventFeedback.dataset.state = "info";
    eventFeedback.textContent = "In attesa di selezione.";
    renderFocusIndicators();
    return;
  }
  const focusRole = event.focusRole ? resolveRole(event.focusRole) : null;
  const match = focusRole?.id === state.profile.roleId;
  const rewards = computeTurnRewards(event, state.profile.roleId);
  eventContent.innerHTML = `
    <div class="detail-head">
      <div>
        <p class="eyebrow">${event.id}</p>
        <h3>${event.name}</h3>
        <p class="muted tiny">${event.theatre} • ${event.date}</p>
      </div>
      <span class="focus-pill ${match ? "match" : "ghost"}">${focusRole ? focusRole.name : "Multi-ruolo"}</span>
    </div>
    <div class="detail-meta">
      <span class="pill ghost">~${event.distanceKm} km</span>
      <span class="pill ghost">${formatRewards(rewards)}</span>
    </div>
  `;
  registerTurnButton.disabled = false;
  registerTurnButton.dataset.eventId = event.id;
  registerTurnButton.textContent = "Registra turno";
  eventFeedback.dataset.state = "info";
  eventFeedback.textContent = "Pronto a registrare questo evento.";
  renderFocusIndicators(event);
}

function setEventFeedback(state: "info" | "ok" | "warn" | "error", message: string) {
  if (!eventFeedback) return;
  eventFeedback.dataset.state = state;
  eventFeedback.textContent = message;
}

function updateFilterSummary(list: DecoratedEvent[]) {
  if (!filterSummary) return;
  const count = list.length;
  const label = count === 1 ? "evento" : "eventi";
  filterSummary.textContent = `${count} ${label} filtrati • scorciatoie: Alt+1 Eventi, Alt+2 Turni, Alt+3 Profilo`;
}

function getFilteredEvents(): DecoratedEvent[] {
  const decorated = mockEvents.map((event) => ({
    ...event,
    distanceKm: computeDistanceKm(event.lat, event.lng),
  })) as DecoratedEvent[];
  return decorated
    .filter((event) => (eventFilters.role === "all" ? true : event.focusRole === eventFilters.role))
    .filter((event) => {
      if (!eventFilters.date) return true;
      const eventDate = new Date(event.date).getTime();
      const filterDate = new Date(eventFilters.date).getTime();
      return Number.isFinite(eventDate) && Number.isFinite(filterDate) ? eventDate <= filterDate : true;
    })
    .filter((event) => event.distanceKm <= eventFilters.distance)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderEventList(events: DecoratedEvent[]) {
  if (!eventList) return;
  if (!events.length) {
    eventList.innerHTML = `<li class="muted">Nessun evento trovato con questi filtri.</li>`;
    return;
  }
  eventList.innerHTML = events
    .map((item) => {
      const isSelected = item.id === selectedEventId;
      const focusRole = item.focusRole ? resolveRole(item.focusRole) : null;
      const isMatch = focusRole?.id === state.profile.roleId;
      const rewards = computeTurnRewards(item, state.profile.roleId);
      return `<li>
        <button class="event-card${isSelected ? " active" : ""}" type="button" data-event-id="${item.id}" aria-pressed="${isSelected}">
          <div class="event-card__header">
            <div>
              <strong>${item.name}</strong>
              <p class="muted tiny">${item.theatre} • ${item.date}</p>
            </div>
            <span class="focus-pill ${isMatch ? "match" : "ghost"}">${focusRole ? focusRole.name : "Multi-ruolo"}</span>
          </div>
          <div class="event-card__meta">
            <span class="pill ghost">~${item.distanceKm} km</span>
            <span class="pill ghost">${formatRewards(rewards)}</span>
          </div>
        </button>
      </li>`;
    })
    .join("");
}

function updateSelectedListItem() {
  if (!eventList) return;
  const items = Array.from(eventList.querySelectorAll<HTMLElement>("[data-event-id]"));
  items.forEach((item) => {
    const isActive = item.dataset.eventId === selectedEventId;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
}

function focusEventOnMap(event: DecoratedEvent, openPopup = true) {
  const marker = markerMap.get(event.id);
  if (map && marker) {
    map.flyTo([event.lat, event.lng], Math.max(map.getZoom(), 10));
    if (openPopup) {
      marker.openPopup();
    }
  }
}

function selectEvent(eventId: string, focusMap = true) {
  const target = filteredEvents.find((event) => event.id === eventId);
  if (!target) return;
  selectedEventId = target.id;
  updateSelectedListItem();
  renderEventDetail(target);
  if (focusMap) {
    focusEventOnMap(target);
  }
}

function renderMapMarkers(events: DecoratedEvent[]) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  markerMap.clear();
  if (!events.length) return;
  const bounds: L.LatLngExpression[] = [];
  events.forEach((event) => {
    const marker = L.marker([event.lat, event.lng], { icon: markerIcon }).bindPopup(
      `<strong>${event.name}</strong><br/>${event.theatre}<br/>${event.date}<br/>Focus: ${event.focusRole ? resolveRole(event.focusRole).name : "Any"
      }`
    );
    marker.on("click", () => selectEvent(event.id, false));
    markerLayer.addLayer(marker);
    markerMap.set(event.id, marker);
    bounds.push([event.lat, event.lng]);
  });
  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView(bounds[0] as L.LatLngExpression, 11);
  }
  if (selectedEventId && markerMap.has(selectedEventId)) {
    markerMap.get(selectedEventId)?.openPopup();
  }
}

function applyFilters(options?: { forceSelection?: boolean }) {
  setEventLoading(true);
  window.setTimeout(() => {
    filteredEvents = getFilteredEvents();
    if (!filteredEvents.length) {
      renderEventList(filteredEvents);
      renderEventDetail(undefined);
      renderFocusIndicators();
      renderMapMarkers(filteredEvents);
      updateFilterSummary(filteredEvents);
      setEventLoading(false);
      return;
    }
    if (options?.forceSelection || !selectedEventId || !filteredEvents.some((event) => event.id === selectedEventId)) {
      selectedEventId = filteredEvents[0].id;
    }
    renderEventList(filteredEvents);
    updateSelectedListItem();
    renderMapMarkers(filteredEvents);
    const target = filteredEvents.find((event) => event.id === selectedEventId);
    renderEventDetail(target);
    if (target) {
      focusEventOnMap(target, false);
    }
    updateFilterSummary(filteredEvents);
    setEventLoading(false);
  }, 120);
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

function handleRegisterTurn() {
  const target = filteredEvents.find((event) => event.id === selectedEventId);
  if (!target) {
    setEventFeedback("warn", "Seleziona un evento prima di registrare.");
    return;
  }
  const rewards = computeTurnRewards(target, state.profile.roleId);
  const record: TurnRecord = {
    id: `turn-${Date.now()}`,
    eventId: target.id,
    eventName: target.name,
    theatre: target.theatre,
    date: target.date,
    roleId: state.profile.roleId,
    rewards,
  };
  state = {
    ...state,
    profile: {
      ...state.profile,
      xp: state.profile.xp + rewards.xp,
      cachet: state.profile.cachet + rewards.cachet,
      repAtcl: state.profile.repAtcl + rewards.reputation,
    },
    turns: [record, ...state.turns].slice(0, MAX_STORED_TURNS),
  };
  saveState(state);
  renderProfile();
  renderTurns();
  renderEventDetail(target);
  setEventFeedback("ok", `Turno registrato: ${target.name} (${formatRewards(rewards)})`);
}

function initMap() {
  if (!mapContainer || map) return;
  map = L.map(mapContainer, { zoomControl: true }).setView(defaultCenter, 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "OpenStreetMap contributors",
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function setDrawer(sectionId: DrawerSection) {
  drawerTabs.forEach((tab) => {
    const isActive = tab.dataset.drawerTab === sectionId;
    tab.classList.toggle("active", isActive);
    tab.dataset.state = isActive ? "active" : "default";
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });
  drawerSections.forEach((section) => {
    const isActive = section.dataset.section === sectionId;
    section.classList.toggle("active", isActive);
    section.toggleAttribute("hidden", !isActive);
    section.setAttribute("aria-hidden", String(!isActive));
  });
}

function setupTabsAccessibility() {
  drawerTabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    const tabId = tab.dataset.tabId;
    if (tabId) {
      tab.id = tabId;
    }
    const section = drawerSections.find((panel) => panel.dataset.section === tab.dataset.drawerTab);
    if (section) {
      const sectionId = section.id || `panel-${tab.dataset.drawerTab}`;
      section.id = sectionId;
      tab.setAttribute("aria-controls", sectionId);
      section.setAttribute("aria-labelledby", tab.id);
    }
  });
  drawerSections.forEach((section) => {
    section.setAttribute("role", "tabpanel");
  });
  if (drawerTablist) {
    drawerTablist.setAttribute("role", "tablist");
    drawerTablist.setAttribute("aria-orientation", "horizontal");
  }
}

function focusTab(direction: 1 | -1) {
  const currentIndex = drawerTabs.findIndex((tab) => tab.dataset.state === "active");
  const nextIndex = (currentIndex + direction + drawerTabs.length) % drawerTabs.length;
  const nextTab = drawerTabs[nextIndex];
  const target = nextTab?.dataset.drawerTab as DrawerSection | undefined;
  if (target) {
    setDrawer(target);
    nextTab.focus();
  }
}

function handleTabKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusTab(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusTab(-1);
  }
  if (event.key === "Home") {
    event.preventDefault();
    const first = drawerTabs[0];
    const target = first?.dataset.drawerTab as DrawerSection | undefined;
    if (target) {
      setDrawer(target);
      first.focus();
    }
  }
  if (event.key === "End") {
    event.preventDefault();
    const last = drawerTabs[drawerTabs.length - 1];
    const target = last?.dataset.drawerTab as DrawerSection | undefined;
    if (target) {
      setDrawer(target);
      last.focus();
    }
  }
}

function handleTabShortcut(section: DrawerSection) {
  setDrawer(section);
  const targetTab = drawerTabs.find((tab) => tab.dataset.drawerTab === section);
  targetTab?.focus();
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
renderTurns();
initMap();
setupTabsAccessibility();
updateDistanceLabel(eventFilters.distance);
applyFilters({ forceSelection: true });
setDrawer("events");
updateViewportNote();

root.querySelector<HTMLButtonElement>('[data-action="sync-state"]')?.addEventListener("click", () => {
  state = loadState();
  renderProfile();
  renderTurns();
  applyFilters({ forceSelection: true });
  setEventFeedback("info", "Stato ricaricato dal profilo principale.");
  if (quickResult) {
    quickResult.dataset.state = "info";
    quickResult.textContent = "Stato ricaricato dal profilo principale.";
  }
});

root.querySelector<HTMLButtonElement>('[data-action="quick-train"]')?.addEventListener("click", () => {
  handleQuick("train");
  renderMapMarkers(filteredEvents);
});

root.querySelector<HTMLButtonElement>('[data-action="quick-scene"]')?.addEventListener("click", () => {
  handleQuick("scene");
  renderMapMarkers(filteredEvents);
});

root.querySelector<HTMLButtonElement>('[data-action="quick-audio"]')?.addEventListener("click", () => {
  handleQuick("audio");
  renderMapMarkers(filteredEvents);
});

drawerTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.drawerTab as DrawerSection | undefined;
    if (target) handleTabShortcut(target);
  });
});

drawerTablist?.addEventListener("keydown", handleTabKeydown);

filterRoleSelect?.addEventListener("change", () => {
  const value = filterRoleSelect.value as RoleId | "all";
  eventFilters.role = value;
  applyFilters({ forceSelection: true });
});

filterDateInput?.addEventListener("change", () => {
  eventFilters.date = filterDateInput.value;
  applyFilters();
});

filterDistanceInput?.addEventListener("input", () => {
  const nextValue = Number(filterDistanceInput.value) || DEFAULT_DISTANCE_KM;
  eventFilters.distance = nextValue;
  updateDistanceLabel(nextValue);
  applyFilters();
});

eventList?.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-event-id]");
  if (!target) return;
  const eventId = target.dataset.eventId;
  if (eventId) {
    selectEvent(eventId);
  }
});

registerTurnButton?.addEventListener("click", handleRegisterTurn);

window.addEventListener("keydown", (event) => {
  const targetTag = (event.target as HTMLElement | null)?.tagName;
  if (targetTag && ["INPUT", "TEXTAREA", "SELECT"].includes(targetTag)) return;
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === "1") {
      event.preventDefault();
      handleTabShortcut("events");
    }
    if (event.key === "2") {
      event.preventDefault();
      handleTabShortcut("turns");
    }
    if (event.key === "3") {
      event.preventDefault();
      handleTabShortcut("profile");
    }
  }
});

window.setTimeout(() => {
  map?.invalidateSize();
}, 200);
window.addEventListener("resize", () => {
  map?.invalidateSize();
  updateViewportNote();
});

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
