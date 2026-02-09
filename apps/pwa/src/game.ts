import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { buildProgressCopy, getProgressState, repMilestones, xpMilestones } from "./progression";
import { registerServiceWorker } from "./pwa/register-sw";
import { promptServiceWorkerUpdate } from "./pwa/sw-update";
import { formatRewards, loadState, resolveRole, STORAGE_KEY } from "./state";
import { getAvatarVisual } from "./avatar-visual";
import { showSyncBadge } from "./utils/sync-badge";
import { requireDevAccess } from "./services/dev-gate";

const start = async () => {
  if (!(await requireDevAccess())) return;


  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const pageHero = renderPageHero({
    title: "Hub di navigazione",
    description: "Accedi a mappa, profilo, eventi e registro turni.",
    currentPage: "game",
    breadcrumbs: [
      { label: "Home", href: "/" },
      { label: "Hub" },
    ],
    backHref: "/",
    backLabel: "Torna alla landing",
    ctaRow: [
      { id: "map", label: "Apri mappa", href: "/map.html", variant: "primary" },
      { id: "avatar", label: "Avatar", href: "/avatar.html", variant: "ghost" },
      { id: "profile", label: "Profilo", href: "/profile.html", variant: "ghost" },
      { id: "turns", label: "Turni", href: "/turns.html", variant: "ghost" },
      { id: "leaderboard", label: "Classifica", href: "/leaderboard.html", variant: "ghost" },
    ],
    quickActions: [{ id: "dev", label: "Dev playground", href: "/dev.html", icon: "🛠️" }],
  });
  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${pageHero}

      <section class="grid layout-grid">
        <article class="card dashboard-card layout-span-2">
          <div class="dashboard-header">
            <div>
              <p class="eyebrow">Home dashboard</p>
              <h2>Profilo in scena</h2>
              <p class="muted">Riepilogo rapido con progressi circolari e statistiche chiave.</p>
            </div>
          </div>
          <div class="dashboard-body">
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
            <div class="dashboard-rings">
              <div class="dashboard-ring">
                <div
                  class="progress-ring"
                  data-ring="xp"
                  role="progressbar"
                  aria-label="Progresso XP"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="0"
                >
                  <span class="ring-value" data-progress-value="xp">0 XP</span>
                  <span class="ring-label">XP</span>
                </div>
                <div class="dashboard-ring__meta">
                  <p class="eyebrow">Crescita XP</p>
                  <p class="muted" data-progress-copy="xp">Traguardi XP</p>
                </div>
              </div>
              <div class="dashboard-ring">
                <div
                  class="progress-ring accent"
                  data-ring="rep"
                  role="progressbar"
                  aria-label="Progresso reputazione"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="0"
                >
                  <span class="ring-value" data-progress-value="rep">0 rep</span>
                  <span class="ring-label">Rep</span>
                </div>
                <div class="dashboard-ring__meta">
                  <p class="eyebrow">Reputazione</p>
                  <p class="muted" data-progress-copy="rep">Traguardi reputazione</p>
                </div>
              </div>
            </div>
            <ul class="stat-quick-list">
              <li><span>XP totali</span><strong data-stat="xp">0</strong></li>
              <li><span>Cachet</span><strong data-stat="cachet">0</strong></li>
              <li><span>Reputazione ATCL</span><strong data-stat="rep">0</strong></li>
            </ul>
          </div>
        </article>

        <article class="card layout-span-2">
          <h2>Ultimi turni</h2>
          <p class="muted">Registro rapido delle ultime sessioni salvate.</p>
          <ul class="log-list dense" data-turn-log></ul>
        </article>
      </section>
    </main>
  `;

  const progressCopyXp = root.querySelector<HTMLElement>('[data-progress-copy="xp"]');
  const progressCopyRep = root.querySelector<HTMLElement>('[data-progress-copy="rep"]');
  const progressValueXp = root.querySelector<HTMLElement>('[data-progress-value="xp"]');
  const progressValueRep = root.querySelector<HTMLElement>('[data-progress-value="rep"]');
  const progressRingXp = root.querySelector<HTMLElement>('[data-ring="xp"]');
  const progressRingRep = root.querySelector<HTMLElement>('[data-ring="rep"]');
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
  let state = loadState();

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

  function renderProgress() {
    const xpProgress = getProgressState(state.profile.xp, xpMilestones);
    const repProgress = getProgressState(state.profile.repAtcl, repMilestones);
    if (progressCopyXp) progressCopyXp.textContent = buildProgressCopy(xpProgress, "XP");
    if (progressCopyRep) progressCopyRep.textContent = buildProgressCopy(repProgress, "punti rep");
    if (progressValueXp) progressValueXp.textContent = `${state.profile.xp} XP`;
    if (progressValueRep) progressValueRep.textContent = `${state.profile.repAtcl} rep`;
    if (progressRingXp) {
      progressRingXp.style.setProperty("--ring-progress", xpProgress.percent.toString());
      progressRingXp.setAttribute("aria-valuenow", xpProgress.percent.toString());
    }
    if (progressRingRep) {
      progressRingRep.style.setProperty("--ring-progress", repProgress.percent.toString());
      progressRingRep.setAttribute("aria-valuenow", repProgress.percent.toString());
    }
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
  renderProgress();
  renderTurns();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderProfile();
    renderProgress();
    renderTurns();
    const syncBadge = root.querySelector<HTMLElement>('[data-sync-badge]');
    showSyncBadge(syncBadge);
  });

  registerServiceWorker({
    onReady: () => undefined,
    onUpdate: (registration) => {
      promptServiceWorkerUpdate(registration);
    },
    onError: (error) => {
      console.error("Service worker registration failed", error);
    },
  });
};

void start();
