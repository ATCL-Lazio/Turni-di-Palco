import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { buildProgressCopy, getProgressState, repMilestones, xpMilestones } from "./progression";
import { registerServiceWorker } from "./pwa/register-sw";
import { promptServiceWorkerUpdate } from "./pwa/sw-update";
import { formatRewards, loadState, resolveRole, STORAGE_KEY } from "./state";
import { getAvatarVisual } from "./avatar-visual";
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
          <div class="progress-grid compact">
            <div class="progress-track slim" data-track="xp">
              <div class="progress-head">
                <p class="muted" data-progress-copy="xp">Traguardi XP</p>      
                <strong data-progress-value="xp">0 XP</strong>
              </div>
              <div class="progress-bar" role="progressbar" aria-label="Progresso XP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="progress-fill" data-progress-bar="xp" style="width: 0%"></span>
              </div>
            </div>
            <div class="progress-track slim" data-track="rep">
              <div class="progress-head">
                <p class="muted" data-progress-copy="rep">Traguardi reputazione</p>
                <strong data-progress-value="rep">0 rep</strong>
              </div>
              <div class="progress-bar" role="progressbar" aria-label="Progresso reputazione" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="progress-fill accent" data-progress-bar="rep" style="width: 0%"></span>
              </div>
            </div>
          </div>
        </article>

        <article class="card layout-span-2">
          <h2>Ultimi turni</h2>
          <ul class="log-list dense" data-turn-log></ul>
        </article>
      </section>
    </main>
  `;

  const progressCopyXp = root.querySelector<HTMLElement>('[data-progress-copy="xp"]');
  const progressCopyRep = root.querySelector<HTMLElement>('[data-progress-copy="rep"]');
  const progressValueXp = root.querySelector<HTMLElement>('[data-progress-value="xp"]');
  const progressValueRep = root.querySelector<HTMLElement>('[data-progress-value="rep"]');
  const progressBarXp = root.querySelector<HTMLElement>('[data-progress-bar="xp"]');
  const progressBarRep = root.querySelector<HTMLElement>('[data-progress-bar="rep"]');
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

  function renderProgress() {
    const xpProgress = getProgressState(state.profile.xp, xpMilestones);
    const repProgress = getProgressState(state.profile.repAtcl, repMilestones);
    if (progressCopyXp) progressCopyXp.textContent = buildProgressCopy(xpProgress, "XP");
    if (progressCopyRep) progressCopyRep.textContent = buildProgressCopy(repProgress, "punti rep");
    if (progressValueXp) progressValueXp.textContent = `${state.profile.xp} XP`;
    if (progressValueRep) progressValueRep.textContent = `${state.profile.repAtcl} rep`;
    if (progressBarXp) {
      progressBarXp.style.width = `${xpProgress.percent}%`;
      progressBarXp.parentElement?.setAttribute("aria-valuenow", xpProgress.percent.toString());
    }
    if (progressBarRep) {
      progressBarRep.style.width = `${repProgress.percent}%`;
      progressBarRep.parentElement?.setAttribute("aria-valuenow", repProgress.percent.toString());
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
    showSyncBadge();
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
