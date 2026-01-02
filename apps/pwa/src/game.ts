import "../../../shared/styles/main.css";
import { registerServiceWorker } from "./pwa/register-sw";
import { formatRewards, getAvatarVisual, loadState, resolveRole, STORAGE_KEY } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page page-game layout-shell">
    <header class="hero layout-stack">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Hub di navigazione</h1>
      <p class="lede">Accedi a mappa, profilo, eventi e registro turni.</p>
      <div class="cta-row">
        <a class="button primary" href="/map.html">Apri mappa</a>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/profile.html">Profilo</a>
        <a class="button ghost" href="/events.html">Eventi</a>
        <a class="button ghost" href="/turns.html">Turni</a>
        <a class="button ghost" href="/">Landing</a>
      </div>
    </header>

    <section class="grid layout-grid">
      <article class="card">
        <h2>Profilo</h2>
        <div class="profile-pane">
          <div class="avatar-display large" data-avatar="profile">
            <img data-avatar-img alt="Avatar ReadyPlayerMe" />
            <span class="avatar-icon" data-avatar-label></span>
          </div>
          <div>
            <p class="eyebrow" data-player-name>Profilo non configurato</p>
            <p class="muted" data-player-role>Ruolo non impostato</p>
            <div class="pill-row" data-role-tags></div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Statistiche</h2>
        <ul class="stat-list">
          <li><span>XP</span><strong data-stat="xp">0</strong></li>
          <li><span>Cachet</span><strong data-stat="cachet">0</strong></li>
          <li><span>Reputazione ATCL</span><strong data-stat="rep">0</strong></li>
        </ul>
      </article>

      <article class="card layout-span-2">
        <h2>Ultimi turni</h2>
        <ul class="log-list dense" data-turn-log></ul>
      </article>
    </section>
    <div class="badges">
      <span class="badge" data-sync-badge style="display:none">Stato aggiornato</span>
    </div>
  </main>
`;

const avatarDisplay = root.querySelector<HTMLElement>('[data-avatar="profile"]');
const avatarImg = root.querySelector<HTMLImageElement>('[data-avatar-img]');
const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');
const nameNode = root.querySelector<HTMLElement>('[data-player-name]');
const roleNode = root.querySelector<HTMLElement>('[data-player-role]');
const roleTags = root.querySelector<HTMLElement>('[data-role-tags]');
const statXp = root.querySelector<HTMLElement>('[data-stat="xp"]');
const statCachet = root.querySelector<HTMLElement>('[data-stat="cachet"]');
const statRep = root.querySelector<HTMLElement>('[data-stat="rep"]');
const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');
const syncBadge = root.querySelector<HTMLElement>('[data-sync-badge]');
let state = loadState();
let syncBadgeTimeout: number | undefined;

function showSyncBadge(message = "Stato aggiornato") {
  if (!syncBadge) return;
  syncBadge.textContent = message;
  syncBadge.style.display = "inline-flex";
  if (syncBadgeTimeout) {
    window.clearTimeout(syncBadgeTimeout);
  }
  syncBadgeTimeout = window.setTimeout(() => {
    if (syncBadge) syncBadge.style.display = "none";
  }, 2500);
}

function renderProfile() {
  const avatarVisual = getAvatarVisual(state.profile.avatar);
  if (avatarDisplay) {
    avatarDisplay.style.setProperty("--avatar-color", avatarVisual.color);
    avatarDisplay.style.setProperty("--avatar-hue", `${state.profile.avatar.hue}deg`);
    avatarDisplay.classList.toggle("has-image", !!avatarVisual.image);
  }
  if (avatarImg) {
    if (avatarVisual.image) {
      avatarImg.src = avatarVisual.image;
      avatarImg.style.display = "block";
    } else {
      avatarImg.removeAttribute("src");
      avatarImg.style.display = "none";
    }
  }
  if (avatarLabel) avatarLabel.textContent = avatarVisual.icon;
  const role = resolveRole(state.profile.roleId);
  if (nameNode) nameNode.textContent = state.profile.name || "Profilo non configurato";
  if (roleNode) roleNode.textContent = `${role.name} | Focus: ${role.focus}`;
  if (roleTags) {
    roleTags.innerHTML = role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("");
  }
  if (statXp) statXp.textContent = state.profile.xp.toString();
  if (statCachet) statCachet.textContent = state.profile.cachet.toString();
  if (statRep) statRep.textContent = state.profile.repAtcl.toString();
}

function renderTurns() {
  if (!turnLog) return;
  if (!state.turns.length) {
    turnLog.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
  } else {
    turnLog.innerHTML = state.turns
      .slice(0, 6)
      .map(
        (turn) =>
          `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
      )
      .join("");
  }
}

renderProfile();
renderTurns();

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  state = loadState();
  renderProfile();
  renderTurns();
  showSyncBadge();
});

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
