import "./style.css";
import { registerServiceWorker } from "./pwa/register-sw";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Progressive Web App base</h1>
      <p class="lede">
        Shell installabile e offline-ready per costruire il loop di gioco: profilo, attivita simulate e registrazione turni.
      </p>
      <div class="cta-row">
        <button class="button primary" type="button" data-action="start">
          Vai alla demo
        </button>
        <button class="button ghost" type="button" data-action="refresh">
          Reload per update
        </button>
      </div>
      <div class="badges">
        <span class="badge">Installable</span>
        <span class="badge">Offline friendly</span>
        <span class="badge">Vite + TypeScript</span>
      </div>
    </section>

    <section class="grid">
      <article class="card">
        <h2>App shell</h2>
        <p>
          Skeleton single-page: aggiungi scene e HUD in <code>src/</code>, tieni asset statici in <code>public/</code>, aggiorna il service worker quando cambi il core.
        </p>
        <ul class="list">
          <li><strong>Routing:</strong> SPA via Vite dev server</li>
          <li><strong>Install:</strong> manifest + service worker</li>
          <li><strong>Assets:</strong> cached on first use</li>
        </ul>
      </article>

      <article class="card">
        <h2>Build + Dev</h2>
        <p>
          Usa <code>npm run dev</code> per lo sviluppo, <code>npm run build</code> per il bundle e <code>npm run preview</code> per la smoke sul build.
        </p>
        <div class="pill-row">
          <span class="pill">Hot reload</span>
          <span class="pill">ESM</span>
          <span class="pill">Typed</span>
        </div>
      </article>

      <article class="card status">
        <h2>Status</h2>
        <dl>
          <div class="status-line">
            <dt>Connection</dt>
            <dd data-connection>Detecting...</dd>
          </div>
          <div class="status-line">
            <dt>Service worker</dt>
            <dd data-sw-status>Waiting for registration...</dd>
          </div>
        </dl>
        <p class="muted">Toggle rete per test offline. Se c'e un update SW usa il pulsante reload.</p>
      </article>

      <article class="card">
        <h2>Permission check</h2>
        <p>Richiedi i permessi comuni (notifiche, geolocalizzazione, fotocamera) e controlla l'esito in tempo reale.</p>
        <p class="muted">Nota: su iOS/Safari le notifiche funzionano solo dopo l'installazione come PWA e su connessione sicura (HTTPS). Geolocalizzazione e fotocamera richiedono contesto sicuro.</p>
        <div class="cta-row">
          <button class="button primary" type="button" data-action="notify-permission">
            Richiedi notifiche
          </button>
          <button class="button ghost" type="button" data-action="geo-permission">
            Richiedi geolocalizzazione
          </button>
          <button class="button ghost" type="button" data-action="camera-permission">
            Richiedi fotocamera
          </button>
          <button class="button ghost" type="button" data-action="notify-test">
            Notifica di prova
          </button>
        </div>
        <div class="result-box" data-permission-result>Pronto per i test.</div>
      </article>
    </section>

    <section class="grid gameplay">
      <article class="card span-2">
        <h2>Profilo giocatore</h2>
        <div class="form-grid" data-form="profile">
          <label class="field">
            <span>Nome profilo</span>
            <input type="text" name="playerName" autocomplete="name" placeholder="Dai un nome al profilo" data-field="player-name" />
          </label>
          <label class="field">
            <span>Ruolo principale</span>
            <select name="playerRole" data-field="player-role"></select>
          </label>
          <div class="cta-row">
            <button class="button primary" type="button" data-action="save-profile">Salva profilo</button>
            <button class="button ghost" type="button" data-action="reset-state">Reset stato</button>
          </div>
          <div class="result-box" data-profile-summary>Profilo non configurato.</div>
          <p class="muted">I dati sono salvati in locale (localStorage) e serviranno da base per i prossimi moduli.</p>
        </div>
      </article>

      <article class="card">
        <h2>Carriera</h2>
        <ul class="stat-list">
          <li><span>XP</span><strong data-stat="xp">0</strong></li>
          <li><span>Cachet</span><strong data-stat="cachet">0</strong></li>
          <li><span>Reputazione ATCL</span><strong data-stat="rep">0</strong></li>
        </ul>
        <div class="pill-row" data-role-stats></div>
        <p class="muted" data-career-note>Seleziona un ruolo per vedere le competenze chiave.</p>
      </article>

      <article class="card">
        <h2>Attivita simulate</h2>
        <div class="form-grid">
          <label class="field">
            <span>Scenario</span>
            <select data-field="activity-select"></select>
          </label>
          <p class="muted" data-activity-description>Seleziona uno scenario per avviare una micro-attivita narrativa.</p>
          <div class="cta-row" data-activity-choices></div>
          <div class="result-box" data-activity-result>Ancora nessuna attivita eseguita.</div>
        </div>
      </article>

      <article class="card">
        <h2>Turno ATCL (mock QR)</h2>
        <div class="form-grid">
          <label class="field">
            <span>Evento</span>
            <select data-field="event-select"></select>
          </label>
          <label class="field">
            <span>Ruolo per il turno</span>
            <select data-field="turn-role"></select>
          </label>
          <button class="button primary" type="button" data-action="register-turn">Registra turno di test</button>
          <div class="result-box" data-turn-feedback>Nessun turno registrato.</div>
          <div>
            <p class="muted">Ultimi turni registrati:</p>
            <ul class="log-list" data-turn-log></ul>
          </div>
        </div>
      </article>
    </section>
  </main>
`;

const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
const reloadButton = root.querySelector<HTMLButtonElement>('[data-action="refresh"]');
const notifyButton = root.querySelector<HTMLButtonElement>('[data-action="notify-permission"]');
const geoButton = root.querySelector<HTMLButtonElement>('[data-action="geo-permission"]');
const cameraButton = root.querySelector<HTMLButtonElement>('[data-action="camera-permission"]');
const notifyTestButton = root.querySelector<HTMLButtonElement>('[data-action="notify-test"]');
const permissionOutput = root.querySelector<HTMLElement>("[data-permission-result]");
const isSecure = window.isSecureContext;
const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const supportsCamera = typeof navigator.mediaDevices?.getUserMedia === "function";
const profileNameInput = root.querySelector<HTMLInputElement>('[data-field="player-name"]');
const profileRoleSelect = root.querySelector<HTMLSelectElement>('[data-field="player-role"]');
const profileSummaryBox = root.querySelector<HTMLElement>('[data-profile-summary]');
const statXp = root.querySelector<HTMLElement>('[data-stat="xp"]');
const statCachet = root.querySelector<HTMLElement>('[data-stat="cachet"]');
const statRep = root.querySelector<HTMLElement>('[data-stat="rep"]');
const roleStatsContainer = root.querySelector<HTMLElement>('[data-role-stats]');
const careerNote = root.querySelector<HTMLElement>('[data-career-note]');
const activitySelect = root.querySelector<HTMLSelectElement>('[data-field="activity-select"]');
const activityDescription = root.querySelector<HTMLElement>('[data-activity-description]');
const activityChoices = root.querySelector<HTMLElement>('[data-activity-choices]');
const activityResultBox = root.querySelector<HTMLElement>('[data-activity-result]');
const eventSelect = root.querySelector<HTMLSelectElement>('[data-field="event-select"]');
const turnRoleSelect = root.querySelector<HTMLSelectElement>('[data-field="turn-role"]');
const turnFeedbackBox = root.querySelector<HTMLElement>('[data-turn-feedback]');
const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');

function setConnectionStatus() {
  if (!connectionNode) return;
  const online = navigator.onLine;
  connectionNode.textContent = online ? "Online" : "Offline";
  connectionNode.dataset.state = online ? "online" : "offline";
}

window.addEventListener("online", setConnectionStatus);
window.addEventListener("offline", setConnectionStatus);
setConnectionStatus();

registerServiceWorker({
  onReady: () => {
    if (swStatusNode) {
      swStatusNode.textContent = "Ready for offline use";
      swStatusNode.dataset.state = "ready";
    }
  },
  onUpdate: () => {
    if (swStatusNode) {
      swStatusNode.textContent = "Update available - reload to apply";
      swStatusNode.dataset.state = "update";
    }
    reloadButton?.classList.remove("ghost");
  },
  onError: (error) => {
    if (swStatusNode) {
      swStatusNode.textContent = "Service worker failed";
      swStatusNode.dataset.state = "error";
    }
    console.error("Service worker registration failed", error);
  },
});

reloadButton?.addEventListener("click", () => {
  window.location.reload();
});

root.querySelector<HTMLButtonElement>('[data-action="start"]')?.addEventListener("click", () => {
  window.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
});

function renderPermission(message: string, state: "info" | "ok" | "warn" | "error" = "info") {
  if (!permissionOutput) return;
  permissionOutput.textContent = message;
  permissionOutput.dataset.state = state;
}

function setNotifyButtonState(permission: NotificationPermission) {
  if (!notifyTestButton) return;
  notifyTestButton.disabled = permission !== "granted";
  notifyTestButton.textContent = permission === "granted" ? "Notifica di prova" : "Richiedi permesso per notifiche";
}

async function queryPermissionSafe(descriptor: PermissionDescriptor | { name: "camera" }) {
  if (!navigator.permissions) return null;
  try {
    return await navigator.permissions.query(descriptor as PermissionDescriptor);
  } catch {
    return null;
  }
}

async function checkPermissions() {
  if (!isSecure) {
    renderPermission("Permessi limitati: serve connessione sicura (HTTPS o localhost).", "warn");
  }

  if (typeof Notification !== "undefined") {
    setNotifyButtonState(Notification.permission);
    renderPermission(`Permesso notifiche attuale: ${Notification.permission}`, "info");

    if (isIOS && !isStandalone) {
      renderPermission("Su iOS chiedi notifiche solo dopo installazione come PWA.", "warn");
      notifyButton?.setAttribute("disabled", "true");
    }
  } else {
    notifyButton?.setAttribute("disabled", "true");
    notifyTestButton?.setAttribute("disabled", "true");
  }

  const geoStatus = await queryPermissionSafe({ name: "geolocation" });
  if (geoStatus) {
    renderPermission(`Geo stato: ${geoStatus.state}`, geoStatus.state === "granted" ? "ok" : "info");
    geoStatus.onchange = () => {
      renderPermission(`Geo stato: ${geoStatus.state}`, geoStatus.state === "granted" ? "ok" : "info");
    };
  }

  const cameraStatus = await queryPermissionSafe({ name: "camera" });
  if (cameraStatus) {
    renderPermission(`Stato fotocamera: ${cameraStatus.state}`, cameraStatus.state === "granted" ? "ok" : "info");
    cameraStatus.onchange = () => {
      renderPermission(`Stato fotocamera: ${cameraStatus.state}`, cameraStatus.state === "granted" ? "ok" : "info");
    };
  } else if (!supportsCamera) {
    renderPermission("Fotocamera non supportata in questo browser.", "warn");
    cameraButton?.setAttribute("disabled", "true");
  }
}

notifyButton?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    renderPermission("Notifiche non supportate in questo browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("Richiedi notifiche solo su HTTPS/localhost.", "warn");
    return;
  }
  if (isIOS && !isStandalone) {
    renderPermission("Installa come PWA su iOS per abilitare le notifiche.", "warn");
    return;
  }
  try {
    const result = await Notification.requestPermission();
    const state = result === "granted" ? "ok" : result === "denied" ? "warn" : "info";
    renderPermission(`Permesso notifiche: ${result}`, state);
    setNotifyButtonState(result);
  } catch (error) {
    renderPermission("Richiesta notifiche fallita.", "error");
    console.error(error);
  }
});

geoButton?.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    renderPermission("Geolocalizzazione non supportata.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("La geolocalizzazione richiede HTTPS o localhost.", "warn");
    return;
  }
  renderPermission("Richiesta posizione in corso...", "info");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      renderPermission(
        `Permesso geo: concesso (lat ${position.coords.latitude.toFixed(4)}, lon ${position.coords.longitude.toFixed(4)})`,
        "ok"
      );
    },
    (error) => {
      const reason =
        error.code === error.PERMISSION_DENIED
          ? "rifiutato"
          : error.code === error.POSITION_UNAVAILABLE
            ? "non disponibile"
            : "timeout";
      renderPermission(`Permesso geo: ${reason}`, reason === "rifiutato" ? "warn" : "error");
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
  );
});

cameraButton?.addEventListener("click", async () => {
  if (!supportsCamera) {
    renderPermission("Fotocamera non disponibile nel browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("La fotocamera richiede HTTPS o localhost.", "warn");
    return;
  }

  renderPermission("Richiesta fotocamera in corso...", "info");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((track) => track.stop());
    renderPermission("Permesso fotocamera: concesso.", "ok");
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      renderPermission("Permesso fotocamera: rifiutato.", "warn");
      return;
    }
    renderPermission("Richiesta fotocamera fallita.", "error");
    console.error(error);
  }
});

notifyTestButton?.addEventListener("click", () => {
  if (!("Notification" in window)) {
    renderPermission("Notifiche non supportate in questo browser.", "error");
    return;
  }
  if (!isSecure) {
    renderPermission("Le notifiche richiedono HTTPS o localhost.", "warn");
    return;
  }
  if (isIOS && !isStandalone) {
    renderPermission("Installa come PWA su iOS per inviare notifiche.", "warn");
    return;
  }
  if (Notification.permission !== "granted") {
    renderPermission(`Permesso notifiche: ${Notification.permission}. Concedi prima il permesso.`, "warn");
    return;
  }
  try {
    new Notification("Turni di Palco", {
      body: "Questa e una notifica di prova.",
      icon: "/icons/pwa-192.png",
    });
    renderPermission("Notifica di prova inviata.", "ok");
  } catch (error) {
    renderPermission("Invio notifica fallito.", "error");
    console.error(error);
  }
});

type RoleId = "attore" | "luci" | "fonico" | "attrezzista" | "palco";
type Rewards = { xp: number; cachet: number; reputation: number };
type Role = { id: RoleId; name: string; focus: string; stats: string[] };
type GameEvent = { id: string; name: string; theatre: string; date: string; baseRewards: Rewards; focusRole?: RoleId };
type TurnRecord = {
  id: string;
  eventId: string;
  eventName: string;
  theatre: string;
  date: string;
  roleId: RoleId;
  rewards: Rewards;
  createdAt: number;
};
type PlayerProfile = { name: string; roleId: RoleId; xp: number; cachet: number; repAtcl: number };
type GameState = { profile: PlayerProfile; turns: TurnRecord[] };
type ActivityChoice = { id: string; label: string; summary: string; rewards: Rewards };
type Activity = { id: string; title: string; description: string; choices: ActivityChoice[] };

const roles: Role[] = [
  { id: "attore", name: "Attore / Attrice", focus: "Presenza scenica", stats: ["Presenza", "Memoria", "Versatilita"] },
  { id: "luci", name: "Tecnico luci", focus: "Precisione cue", stats: ["Precisione", "Tempismo", "Stress"] },
  { id: "fonico", name: "Fonico", focus: "Pulizia audio", stats: ["Ascolto", "Reattivita", "Problem solving"] },
  { id: "attrezzista", name: "Attrezzista / Scenografo", focus: "Allestimento rapido", stats: ["Creativita", "Manualita", "Organizzazione"] },
  { id: "palco", name: "Assistente di palco", focus: "Coordinamento", stats: ["Coordinazione", "Leadership", "Sangue freddo"] },
];

const roleMap = roles.reduce<Record<RoleId, Role>>((acc, role) => {
  acc[role.id] = role;
  return acc;
}, {} as Record<RoleId, Role>);

function resolveRole(roleId: RoleId): Role {
  return roleMap[roleId] ?? roles[0];
}

const mockEvents: GameEvent[] = [
  {
    id: "ATCL-001",
    name: "Prova aperta - Teatro di Latina",
    theatre: "Teatro di Latina",
    date: "2025-12-15",
    baseRewards: { xp: 35, cachet: 25, reputation: 8 },
    focusRole: "attrezzista",
  },
  {
    id: "ATCL-002",
    name: "Festival Giovani Voci",
    theatre: "Teatro dell'Unione",
    date: "2026-01-10",
    baseRewards: { xp: 45, cachet: 35, reputation: 12 },
    focusRole: "fonico",
  },
  {
    id: "ATCL-003",
    name: "Prima nazionale - Circuito ATCL",
    theatre: "Teatro Palladium",
    date: "2026-02-02",
    baseRewards: { xp: 60, cachet: 50, reputation: 18 },
    focusRole: "luci",
  },
];

const activities: Activity[] = [
  {
    id: "ritardo",
    title: "Prova generale in ritardo",
    description: "La compagnia e in ritardo di 20 minuti. Devi gestire il clima e chiudere la prova.",
    choices: [
      {
        id: "calma",
        label: "Rassicurare e riallineare",
        summary: "Coordini regista e troupe, riporti calma e priorita.",
        rewards: { xp: 18, cachet: 10, reputation: 8 },
      },
      {
        id: "stringere",
        label: "Tagliare e correre",
        summary: "Accorci alcune scene per finire in tempo. Il ritmo regge ma qualcuno brontola.",
        rewards: { xp: 12, cachet: 12, reputation: 5 },
      },
    ],
  },
  {
    id: "audio",
    title: "Prova audio critica",
    description: "Un rientro micro crea Larsen. Il tempo stringe prima dell'apertura porte.",
    choices: [
      {
        id: "diagnosi",
        label: "Diagnosi rapida e fix",
        summary: "Individui la catena difettosa e sistemi il gain staging.",
        rewards: { xp: 22, cachet: 14, reputation: 10 },
      },
      {
        id: "workaround",
        label: "Workaround conservativo",
        summary: "Riduci i livelli, il suono e meno pieno ma sicuro.",
        rewards: { xp: 14, cachet: 16, reputation: 6 },
      },
    ],
  },
  {
    id: "palco",
    title: "Cambio scena rapido",
    description: "Il cambio scena tra due atti e piu lento del previsto. Serve velocizzare.",
    choices: [
      {
        id: "redistribuire",
        label: "Redistribuisci i compiti",
        summary: "Riassegni i movimenti di scena e guadagni tempo.",
        rewards: { xp: 16, cachet: 12, reputation: 9 },
      },
      {
        id: "semplificare",
        label: "Semplifica gli elementi",
        summary: "Rimuovi un paio di props superflui per restare nei tempi.",
        rewards: { xp: 12, cachet: 10, reputation: 7 },
      },
    ],
  },
];

const STORAGE_KEY = "tdp-game-state";
const MAX_TURNS_STORED = 8;

function createDefaultState(): GameState {
  return {
    profile: { name: "", roleId: "attore", xp: 0, cachet: 0, repAtcl: 0 },
    turns: [],
  };
}

function loadState(): GameState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.profile || !parsed.profile.roleId) return createDefaultState();
    const base = createDefaultState();
    const safeRole = parsed.profile.roleId in roleMap ? parsed.profile.roleId : base.profile.roleId;
    return {
      profile: {
        ...base.profile,
        ...parsed.profile,
        roleId: safeRole,
      },
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(next: GameState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function formatRewards(rewards: Rewards) {
  return `+${rewards.xp} XP | +${rewards.cachet} cachet | +${rewards.reputation} rep`;
}

let gameState = loadState();

function syncProfileForm() {
  if (profileNameInput) {
    profileNameInput.value = gameState.profile.name;
  }
  if (profileRoleSelect) {
    profileRoleSelect.value = gameState.profile.roleId;
  }
  if (turnRoleSelect) {
    turnRoleSelect.value = gameState.profile.roleId;
  }
}

function renderRoleOptions(select: HTMLSelectElement | null) {
  if (!select) return;
  select.innerHTML = roles
    .map((role) => `<option value="${role.id}">${role.name}</option>`)
    .join("");
}

function renderEvents() {
  if (!eventSelect) return;
  if (!mockEvents.length) {
    eventSelect.innerHTML = `<option value="">Nessun evento mock</option>`;
    return;
  }
  eventSelect.innerHTML = mockEvents
    .map((event) => `<option value="${event.id}">${event.name} (${event.theatre})</option>`)
    .join("");
}

function renderCareerCard() {
  if (profileSummaryBox) {
    const role = resolveRole(gameState.profile.roleId);
    const playerName = gameState.profile.name || "Giocatore";
    profileSummaryBox.textContent = `${playerName} - ${role.name} | XP ${gameState.profile.xp}, Cachet ${gameState.profile.cachet}, Rep ATCL ${gameState.profile.repAtcl}`;
  }
  if (statXp) statXp.textContent = gameState.profile.xp.toString();
  if (statCachet) statCachet.textContent = gameState.profile.cachet.toString();
  if (statRep) statRep.textContent = gameState.profile.repAtcl.toString();

  if (roleStatsContainer) {
    const role = resolveRole(gameState.profile.roleId);
    roleStatsContainer.innerHTML = role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("");
  }
  if (careerNote) {
    const role = resolveRole(gameState.profile.roleId);
    careerNote.textContent = `Focus ruolo: ${role.focus}. Potenzia queste competenze nelle attivita simulate.`;
  }
}

function applyRewards(rewards: Rewards) {
  gameState.profile.xp += rewards.xp;
  gameState.profile.cachet += rewards.cachet;
  gameState.profile.repAtcl += rewards.reputation;
}

function handleSaveProfile() {
  const chosenRole = (profileRoleSelect?.value as RoleId) || gameState.profile.roleId;
  const name = profileNameInput?.value.trim() ?? "";
  gameState = {
    ...gameState,
    profile: {
      ...gameState.profile,
      name,
      roleId: chosenRole in roleMap ? chosenRole : gameState.profile.roleId,
    },
  };
  saveState(gameState);
  syncProfileForm();
  renderCareerCard();
  renderTurnHistory();
  if (turnFeedbackBox) {
    turnFeedbackBox.textContent = "Profilo aggiornato.";
  }
}

function handleResetState() {
  const confirmReset = window.confirm("Reset dello stato locale? Tutti i progressi mock verranno azzerati.");
  if (!confirmReset) return;
  gameState = createDefaultState();
  saveState(gameState);
  syncProfileForm();
  renderCareerCard();
  renderActivityUI();
  renderTurnHistory();
  if (turnFeedbackBox) {
    turnFeedbackBox.textContent = "Stato locale resettato.";
  }
}

function renderActivityOptions(activity: Activity) {
  if (!activityChoices) return;
  activityChoices.innerHTML = activity.choices
    .map(
      (choice) =>
        `<button class="button ghost" type="button" data-choice-id="${choice.id}">${choice.label}</button>`
    )
    .join("");
  if (activityDescription) {
    activityDescription.textContent = `${activity.title} - ${activity.description}`;
  }
}

function renderActivityUI(activityId?: string) {
  if (!activities.length) {
    if (activityDescription) {
      activityDescription.textContent = "Nessuna attivita configurata.";
    }
    if (activityChoices) {
      activityChoices.innerHTML = "";
    }
    return;
  }

  const selectedId = activityId || activitySelect?.value || activities[0]?.id;
  const activity = activities.find((item) => item.id === selectedId) ?? activities[0];
  if (activitySelect) {
    activitySelect.innerHTML = activities.map((item) => `<option value="${item.id}">${item.title}</option>`).join("");
    activitySelect.value = activity.id;
  }
  if (activityResultBox) {
    activityResultBox.dataset.state = "info";
    activityResultBox.textContent = "Scegli una delle opzioni per applicare ricompense.";
  }
  renderActivityOptions(activity);
}

function handleActivityChoice(choiceId: string) {
  if (!activities.length) return;
  const fallback = activities[0];
  const currentActivityId = activitySelect?.value || fallback.id;
  const activity = activities.find((item) => item.id === currentActivityId);
  if (!activity) return;
  const choice = activity.choices.find((item) => item.id === choiceId);
  if (!choice) return;
  applyRewards(choice.rewards);
  saveState(gameState);
  renderCareerCard();
  if (activityResultBox) {
    activityResultBox.dataset.state = "ok";
    activityResultBox.textContent = `${choice.summary} (${formatRewards(choice.rewards)})`;
  }
}

function computeTurnRewards(event: GameEvent, roleId: RoleId): Rewards {
  const bonus = event.focusRole && event.focusRole === roleId ? 8 : 0;
  return {
    xp: event.baseRewards.xp + bonus,
    cachet: event.baseRewards.cachet + Math.round(bonus / 2),
    reputation: event.baseRewards.reputation + Math.round(bonus / 4),
  };
}

function renderTurnHistory() {
  if (!turnLog) return;
  if (!gameState.turns.length) {
    turnLog.innerHTML = "<li class=\"muted\">Nessun turno registrato.</li>";
    return;
  }
  turnLog.innerHTML = gameState.turns
    .slice(0, MAX_TURNS_STORED)
    .map(
      (turn) =>
        `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
    )
    .join("");
}

function handleRegisterTurn() {
  if (!mockEvents.length) {
    if (turnFeedbackBox) {
      turnFeedbackBox.dataset.state = "warn";
      turnFeedbackBox.textContent = "Nessun evento di test configurato.";
    }
    return;
  }
  const eventId = eventSelect?.value || mockEvents[0].id;
  const selectedEvent = mockEvents.find((item) => item.id === eventId) ?? mockEvents[0];
  const selectedRole = (turnRoleSelect?.value as RoleId) || gameState.profile.roleId;
  const rewards = computeTurnRewards(selectedEvent, selectedRole);

  const record: TurnRecord = {
    id: `turn-${Date.now()}`,
    eventId: selectedEvent.id,
    eventName: selectedEvent.name,
    theatre: selectedEvent.theatre,
    date: selectedEvent.date,
    roleId: selectedRole,
    rewards,
    createdAt: Date.now(),
  };

  applyRewards(rewards);
  gameState = { ...gameState, turns: [record, ...gameState.turns].slice(0, MAX_TURNS_STORED) };
  saveState(gameState);
  renderCareerCard();
  renderTurnHistory();
  if (turnFeedbackBox) {
    turnFeedbackBox.dataset.state = "ok";
    turnFeedbackBox.textContent = `Turno registrato: ${selectedEvent.name} (${formatRewards(rewards)})`;
  }
}

renderRoleOptions(profileRoleSelect);
renderRoleOptions(turnRoleSelect);
renderEvents();
renderActivityUI();
syncProfileForm();
renderCareerCard();
renderTurnHistory();

root.querySelector<HTMLButtonElement>('[data-action="save-profile"]')?.addEventListener("click", handleSaveProfile);
root.querySelector<HTMLButtonElement>('[data-action="reset-state"]')?.addEventListener("click", handleResetState);
root.querySelector<HTMLButtonElement>('[data-action="register-turn"]')?.addEventListener("click", handleRegisterTurn);

activitySelect?.addEventListener("change", (event) => {
  const nextId = (event.target as HTMLSelectElement).value;
  renderActivityUI(nextId);
});

activityChoices?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>("[data-choice-id]");
  if (!button) return;
  const choiceId = button.dataset.choiceId;
  if (choiceId) {
    handleActivityChoice(choiceId);
  }
});

checkPermissions().catch(() => undefined);
