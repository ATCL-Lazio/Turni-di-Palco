import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { buildProgressCopy, getEarnedMilestones, getProgressState, repMilestones, xpMilestones } from "./progression";
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
    title: "Profilo",
    description: "Stato giocatore, avatar e riepilogo recente.",
    currentPage: "profile",
    breadcrumbs: [
      { label: "Hub", href: "/game.html" },
      { label: "Profilo" },
    ],
    backHref: "/game.html",
    backLabel: "Torna all'hub",
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${pageHero}

      <section class="grid layout-grid">
        <article class="card layout-span-2">
          <h2>Stato giocatore</h2>
          <div class="profile-pane">
            <div class="avatar-display large" data-avatar="profile">
              <img data-avatar-img alt="Avatar ReadyPlayerMe" />
              <span class="avatar-icon" data-avatar-label></span>
            </div>
            <div>
              <p class="eyebrow">Profilo</p>
              <h3 data-player-name>Profilo non configurato</h3>
              <p class="muted" data-player-role>Ruolo non impostato</p>
              <div class="pill-row" data-role-tags></div>
            </div>
          </div>
          <div class="stat-board">
            <div class="stat-chip"><span>XP</span><strong data-stat="xp">0</strong></div>
            <div class="stat-chip"><span>Cachet</span><strong data-stat="cachet">0</strong></div>
            <div class="stat-chip"><span>Rep</span><strong data-stat="rep">0</strong></div>
          </div>
          <div class="progress-grid">
            <div class="progress-track" data-track="xp">
              <div class="progress-head">
                <div>
                  <p class="eyebrow">Percorso XP</p>
                  <p class="muted" data-progress-copy="xp">Accumula esperienza nei turni registrati.</p>
                </div>
                <strong data-progress-value="xp">0 XP</strong>
              </div>
              <div class="progress-bar" role="progressbar" aria-label="Progresso XP" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="progress-fill" data-progress-bar="xp" style="width: 0%"></span>
              </div>
            </div>
            <div class="progress-track" data-track="rep">
              <div class="progress-head">
                <div>
                  <p class="eyebrow">Reputazione</p>
                  <p class="muted" data-progress-copy="rep">Fa crescere la reputazione ATCL per sbloccare badge.</p>
                </div>
                <strong data-progress-value="rep">0 rep</strong>
              </div>
              <div class="progress-bar" role="progressbar" aria-label="Progresso reputazione" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="progress-fill accent" data-progress-bar="rep" style="width: 0%"></span>
              </div>
            </div>
          </div>
          <div class="badge-panel">
            <p class="eyebrow">Badge sbloccati</p>
            <div class="badge-grid" data-badge-list></div>
            <p class="muted" data-badge-note>Completa milestone XP o reputazione per guadagnare badge.</p>
          </div>
        </article>

        <article class="card">
          <h2>Ultimi turni</h2>
          <ul class="log-list" data-turn-log></ul>
        </article>
      </section>
    </main>
  `;

  const avatarDisplay = root.querySelector<HTMLElement>('[data-avatar="profile"]');
  const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');
  const avatarImg = root.querySelector<HTMLImageElement>('[data-avatar-img]');
  const nameNode = root.querySelector<HTMLElement>("[data-player-name]");
  const roleNode = root.querySelector<HTMLElement>("[data-player-role]");
  const roleTags = root.querySelector<HTMLElement>("[data-role-tags]");
  const statXp = root.querySelector<HTMLElement>('[data-stat="xp"]');
  const statCachet = root.querySelector<HTMLElement>('[data-stat="cachet"]');
  const statRep = root.querySelector<HTMLElement>('[data-stat="rep"]');
  const progressCopyXp = root.querySelector<HTMLElement>('[data-progress-copy="xp"]');
  const progressCopyRep = root.querySelector<HTMLElement>('[data-progress-copy="rep"]');
  const progressValueXp = root.querySelector<HTMLElement>('[data-progress-value="xp"]');
  const progressValueRep = root.querySelector<HTMLElement>('[data-progress-value="rep"]');
  const progressBarXp = root.querySelector<HTMLElement>('[data-progress-bar="xp"]');
  const progressBarRep = root.querySelector<HTMLElement>('[data-progress-bar="rep"]');
  const badgeList = root.querySelector<HTMLElement>('[data-badge-list]');
  const badgeNote = root.querySelector<HTMLElement>('[data-badge-note]');
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
    if (avatarLabel) {
      avatarLabel.textContent = avatarVisual.icon;
    }

    if (nameNode) {
      nameNode.textContent = state.profile.name || "Profilo non configurato";
    }
    const role = resolveRole(state.profile.roleId);
    if (roleNode) {
      roleNode.textContent = `${role.name} - Focus: ${role.focus}`;
    }
    if (roleTags) {
      roleTags.innerHTML = role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("");
    }
    if (statXp) statXp.textContent = state.profile.xp.toString();
    if (statCachet) statCachet.textContent = state.profile.cachet.toString();
    if (statRep) statRep.textContent = state.profile.repAtcl.toString();

    if (turnLog) {
      if (!state.turns.length) {
        turnLog.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
      } else {
        turnLog.innerHTML = state.turns
          .slice(0, 8)
          .map(
            (turn) =>
              `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
          )
          .join("");
      }
    }
  }

  renderProfile();

  function renderProgressAndBadges() {
    const xpProgress = getProgressState(state.profile.xp, xpMilestones);
    const repProgress = getProgressState(state.profile.repAtcl, repMilestones);

    if (progressValueXp) progressValueXp.textContent = `${state.profile.xp} XP`;
    if (progressValueRep) progressValueRep.textContent = `${state.profile.repAtcl} rep`;
    if (progressCopyXp) progressCopyXp.textContent = buildProgressCopy(xpProgress, "XP");
    if (progressCopyRep) progressCopyRep.textContent = buildProgressCopy(repProgress, "punti rep");

    if (progressBarXp) {
      progressBarXp.style.width = `${xpProgress.percent}%`;
      progressBarXp.parentElement?.setAttribute("aria-valuenow", xpProgress.percent.toString());
    }
    if (progressBarRep) {
      progressBarRep.style.width = `${repProgress.percent}%`;
      progressBarRep.parentElement?.setAttribute("aria-valuenow", repProgress.percent.toString());
    }

    const earnedXp = getEarnedMilestones(state.profile.xp, xpMilestones);
    const earnedRep = getEarnedMilestones(state.profile.repAtcl, repMilestones);
    const seen = new Set<string>();
    const repIds = new Set(repMilestones.map((item) => item.id));
    const badges = [...earnedXp, ...earnedRep].filter((badge) => {
      if (seen.has(badge.id)) return false;
      seen.add(badge.id);
      return true;
    });

    if (badgeList) {
      badgeList.innerHTML = badges.length
        ? badges
            .map(
              (badge) =>
                `<span class="badge-chip">${badge.label}<small>${badge.target}${repIds.has(badge.id) ? " rep" : " XP"}</small></span>`
            )
            .join("")
        : '<span class="badge-chip ghost">Ancora nessun badge: completa milestone XP/rep.</span>';
    }

    if (badgeNote) {
      const nextTarget = xpProgress.remaining > 0 ? { progress: xpProgress, unit: "XP" } : { progress: repProgress, unit: "punti" };
      const nextCopy =
        xpProgress.remaining <= 0 && repProgress.remaining <= 0
          ? "Tieni traccia dei nuovi turni per ampliare il medagliere."
          : buildProgressCopy(nextTarget.progress, nextTarget.unit);
      badgeNote.textContent = nextCopy;
    }
  }

  renderProgressAndBadges();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderProfile();
    renderProgressAndBadges();
    showSyncBadge();
  });
};

void start();
