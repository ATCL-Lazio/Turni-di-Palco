import "../../../shared/styles/main.css";
import { registerServiceWorker } from "./pwa/register-sw";
import { promptServiceWorkerUpdate } from "./pwa/sw-update";
import { renderAppBar } from "./components/app-bar";
import {
  STORAGE_KEY,
  avatarIcons,
  createDefaultState,
  deriveRpmThumbnail,
  formatRewards,
  loadState,
  resolveRole,
  roleMap,
  roles,
  saveState,
} from "./state";
import type { AvatarIcon, GameState, Rewards, RoleId, SaveStateResult, TurnRecord } from "./types";
import { buildProgressCopy, getEarnedMilestones, getProgressState, repMilestones, xpMilestones } from "./progression";
import { requireDevAccess } from "./services/dev-gate";

const start = async () => {
  if (!(await requireDevAccess())) return;


  type ActivityChoice = { id: string; label: string; summary: string; rewards: Rewards };
  type Activity = { id: string; title: string; description: string; choices: ActivityChoice[] };
  type DevEvent = { id: string; name: string; theatre: string; date: string; baseRewards: Rewards; focusRole?: RoleId };

  const devEvents: DevEvent[] = [
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

  const devNav = [
    { label: "Landing", href: "/", icon: "🏠" },
    { label: "Hub", href: "/game.html", icon: "🎛️" },
    { label: "Mappa", href: "/map.html", icon: "🗺️" },
    { label: "Avatar", href: "/avatar.html", icon: "🧑" },
  ];

  const devAppBar = renderAppBar({ eyebrow: "Turni di Palco", subtitle: "Dev playground", actions: devNav });

  const ACTIVITY_COOLDOWN_MS = 20000;
  const MAX_ACTIVITY_RUNS = 3;
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

  const MAX_TURNS_STORED = 8;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  root.innerHTML = `
    <main class="page">
      ${devAppBar}

      <section class="hero layout-stack" id="dev">
        <p class="eyebrow">Turni di Palco</p>
        <h1>Dev playground</h1>
        <p class="lede">Profilo, carriera, attivita simulate e registrazione turni di test.</p>
        <div class="cta-row">
          <a class="button primary" href="/game.html">Vai all'hub</a>
          <a class="button ghost" href="/">Torna alla landing</a>
        </div>
        <div class="badges">
          <span class="badge" data-sync-badge style="display:none">Stato aggiornato</span>
        </div>
      </section>

      <section class="grid layout-grid gameplay">
        <article class="card layout-span-2">
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
            <div class="avatar-config">
              <div class="avatar-display large" data-avatar="preview">
                <img data-avatar-img alt="Avatar ReadyPlayerMe" />
                <span class="avatar-icon" data-avatar-label></span>
              </div>
              <div class="form-grid compact">
                <label class="field">
                  <span>Tinta avatar</span>
                  <input type="range" min="0" max="360" step="1" value="210" data-avatar-hue />
                </label>
                <label class="field">
                  <span>Icona</span>
                  <select data-avatar-icon></select>
                </label>
              </div>
            </div>
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
          <div class="progress-grid">
            <div class="progress-track" data-track="xp">
              <div class="progress-head">
                <div>
                  <p class="eyebrow">Crescita XP</p>
                  <p class="muted" data-progress-copy="xp">Registrando turni e attivita sblocchi milestone XP.</p>
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
                  <p class="muted" data-progress-copy="rep">Cura i turni per ottenere badge di reputazione.</p>
                </div>
                <strong data-progress-value="rep">0 rep</strong>
              </div>
              <div class="progress-bar" role="progressbar" aria-label="Progresso reputazione" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <span class="progress-fill accent" data-progress-bar="rep" style="width: 0%"></span>
              </div>
            </div>
          </div>
          <div class="pill-row" data-role-stats></div>
          <div class="badge-panel">
            <div class="badge-grid" data-badge-list></div>
            <p class="muted" data-career-note>Seleziona un ruolo per vedere le competenze chiave.</p>
          </div>
        </article>

        <article class="card">
          <h2>Attivita simulate</h2>
          <div class="form-grid">
            <label class="field">
              <span>Scenario</span>
              <select data-field="activity-select"></select>
            </label>
            <p class="muted" data-activity-description>Seleziona uno scenario per avviare una micro-attivita narrativa.</p>
            <div class="inline-alert" data-activity-tutorial>
              <div>
                <p class="eyebrow">Tutorial</p>
                <p class="muted">Scegli una opzione per sbloccare le attivita e registrare la prima scelta guidata.</p>
              </div>
              <button class="button ghost small" type="button" data-action="dismiss-tutorial">Segna come letto</button>
            </div>
            <div class="meta-row">
              <span class="meta-chip" data-activity-guard>Cooldown attivita pronto.</span>
              <span class="meta-chip ghost" data-activity-limit>Limite sessione: 0 / ${MAX_ACTIVITY_RUNS}</span>
            </div>
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

  const profileNameInput = root.querySelector<HTMLInputElement>('[data-field="player-name"]');
  const profileRoleSelect = root.querySelector<HTMLSelectElement>('[data-field="player-role"]');
  const profileSummaryBox = root.querySelector<HTMLElement>('[data-profile-summary]');
  const avatarPreview = root.querySelector<HTMLElement>('[data-avatar="preview"]');
  const avatarImg = root.querySelector<HTMLImageElement>('[data-avatar-img]');
  const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');
  const avatarHueInput = root.querySelector<HTMLInputElement>('[data-avatar-hue]');
  const avatarIconSelect = root.querySelector<HTMLSelectElement>('[data-avatar-icon]');
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
  const roleStatsContainer = root.querySelector<HTMLElement>('[data-role-stats]');
  const careerNote = root.querySelector<HTMLElement>('[data-career-note]');
  const activitySelect = root.querySelector<HTMLSelectElement>('[data-field="activity-select"]');
  const activityDescription = root.querySelector<HTMLElement>('[data-activity-description]');
  const activityChoices = root.querySelector<HTMLElement>('[data-activity-choices]');
  const activityResultBox = root.querySelector<HTMLElement>('[data-activity-result]');
  const activityGuardChip = root.querySelector<HTMLElement>('[data-activity-guard]');
  const activityLimitChip = root.querySelector<HTMLElement>('[data-activity-limit]');
  const tutorialBox = root.querySelector<HTMLElement>('[data-activity-tutorial]');
  const eventSelect = root.querySelector<HTMLSelectElement>('[data-field="event-select"]');
  const turnRoleSelect = root.querySelector<HTMLSelectElement>('[data-field="turn-role"]');
  const turnFeedbackBox = root.querySelector<HTMLElement>('[data-turn-feedback]');
  const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');
  const syncBadge = root.querySelector<HTMLElement>('[data-sync-badge]');

  let gameState: GameState = loadState();
  let syncBadgeTimeout: number | undefined;

  function showSyncBadge(message = "Stato aggiornato") {
    if (!syncBadge) return;
    syncBadge.textContent = message;
    syncBadge.style.display = "inline-flex";
    syncBadge.classList.remove("is-live");
    void syncBadge.offsetWidth;
    syncBadge.classList.add("is-live");
    if (syncBadgeTimeout) {
      window.clearTimeout(syncBadgeTimeout);
    }
    syncBadgeTimeout = window.setTimeout(() => {
      if (syncBadge) {
        syncBadge.classList.remove("is-live");
        syncBadge.style.display = "none";
      }
    }, 2500);
  }

  function persistState(nextState: GameState, feedback?: HTMLElement): SaveStateResult {
    const result = saveState(nextState);
    gameState = result.state;
    if (!result.ok && feedback) {
      feedback.dataset.state = "warn";
      feedback.textContent = "Salvataggio locale non riuscito: verrà usato un backup in memoria.";
    }
    return result;
  }

  function renderAvatarPreview() {
    if (!avatarPreview) return;
    const { hue, icon, rpmUrl, rpmThumbnail } = gameState.profile.avatar;
    const color = `hsl(${hue}deg 75% 55%)`;
    const image = rpmThumbnail || deriveRpmThumbnail(rpmUrl);
    avatarPreview.style.setProperty("--avatar-color", color);
    avatarPreview.style.setProperty("--avatar-hue", `${hue}deg`);
    avatarPreview.classList.toggle("has-image", !!image);
    const iconDef = avatarIcons.find((item) => item.id === icon) ?? avatarIcons[0];
    if (avatarImg) {
      if (image) {
        avatarImg.src = image;
        avatarImg.style.display = "block";
      } else {
        avatarImg.removeAttribute("src");
        avatarImg.style.display = "none";
      }
    }
    if (avatarLabel) {
      avatarLabel.textContent = iconDef.symbol;
    }
  }

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
    if (avatarHueInput) {
      avatarHueInput.value = gameState.profile.avatar.hue.toString();
    }
    if (avatarIconSelect) {
      avatarIconSelect.value = gameState.profile.avatar.icon;
    }
    renderAvatarPreview();
  }

  function renderRoleOptions(select: HTMLSelectElement | null) {
    if (!select) return;
    select.innerHTML = roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("");
  }

  function renderAvatarOptions() {
    if (!avatarIconSelect) return;
    avatarIconSelect.innerHTML = avatarIcons.map((item) => `<option value="${item.id}">${item.label}</option>`).join("");
  }

  function getActivityStats(activityId: string) {
    return gameState.activityStats[activityId] ?? { runs: 0, lastPlayedAt: undefined };
  }

  function renderActivityGuard(activityId: string) {
    if (!activityGuardChip || !activityLimitChip) return;
    const stats = getActivityStats(activityId);
    const now = Date.now();
    const remainingSeconds = stats.lastPlayedAt ? Math.max(0, Math.ceil((ACTIVITY_COOLDOWN_MS - (now - stats.lastPlayedAt)) / 1000)) : 0;
    if (remainingSeconds > 0) {
      activityGuardChip.textContent = `Cooldown: attendi ${remainingSeconds}s prima di ripetere.`;
      activityGuardChip.dataset.state = "warn";
    } else {
      activityGuardChip.textContent = "Cooldown attivita pronto.";
      activityGuardChip.dataset.state = "ok";
    }
    activityLimitChip.textContent = `Limite sessione: ${Math.min(stats.runs, MAX_ACTIVITY_RUNS)} / ${MAX_ACTIVITY_RUNS}`;
    activityLimitChip.dataset.state = stats.runs >= MAX_ACTIVITY_RUNS ? "warn" : "info";
  }

  function renderTutorialBox() {
    if (!tutorialBox) return;
    tutorialBox.style.display = gameState.tutorial.firstChoiceComplete ? "none" : "grid";
  }
  function renderEvents() {
    if (!eventSelect) return;
    if (!devEvents.length) {
      eventSelect.innerHTML = `<option value="">Nessun evento mock</option>`;
      return;
    }
    eventSelect.innerHTML = devEvents.map((event) => `<option value="${event.id}">${event.name} (${event.theatre})</option>`).join("");
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

    const xpProgress = getProgressState(gameState.profile.xp, xpMilestones);
    const repProgress = getProgressState(gameState.profile.repAtcl, repMilestones);
    if (progressValueXp) progressValueXp.textContent = `${gameState.profile.xp} XP`;
    if (progressValueRep) progressValueRep.textContent = `${gameState.profile.repAtcl} rep`;
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

    const earnedXp = getEarnedMilestones(gameState.profile.xp, xpMilestones);
    const earnedRep = getEarnedMilestones(gameState.profile.repAtcl, repMilestones);
    const seen = new Set<string>();
    const repIds = new Set(repMilestones.map((item) => item.id));
    const badges = [...earnedXp, ...earnedRep].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
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
        : '<span class="badge-chip ghost">Completa una milestone XP/rep per sbloccare un badge.</span>';
    }

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
    const hueValue = avatarHueInput ? Number(avatarHueInput.value) : gameState.profile.avatar.hue;
    const nextHue = Number.isFinite(hueValue) ? Math.max(0, Math.min(360, Math.round(hueValue))) : gameState.profile.avatar.hue;
    const nextIcon = avatarIconSelect?.value as AvatarIcon;
    const safeIcon = avatarIcons.some((item) => item.id === nextIcon) ? nextIcon : gameState.profile.avatar.icon;
    gameState = {
      ...gameState,
      profile: {
        ...gameState.profile,
        name,
        roleId: chosenRole in roleMap ? chosenRole : gameState.profile.roleId,
        avatar: { ...gameState.profile.avatar, hue: nextHue, icon: safeIcon },
      },
    };
    persistState(gameState, turnFeedbackBox || undefined);
    syncProfileForm();
    renderCareerCard();
    renderTurnHistory();
    renderAvatarPreview();
    if (turnFeedbackBox) {
      turnFeedbackBox.textContent = "Profilo aggiornato.";
    }
  }

  function handleResetState() {
    const confirmReset = window.confirm("Reset dello stato locale? Tutti i progressi mock verranno azzerati.");
    if (!confirmReset) return;
    gameState = createDefaultState();
    persistState(gameState, turnFeedbackBox || undefined);
    syncProfileForm();
    renderCareerCard();
    renderActivityUI();
    if (activities.length) {
      renderActivityGuard(activities[0].id);
    }
    renderTurnHistory();
    renderAvatarPreview();
    renderTutorialBox();
    if (turnFeedbackBox) {
      turnFeedbackBox.textContent = "Stato locale resettato.";
    }
  }

  function renderActivityOptions(activity: Activity) {
    if (!activityChoices) return;
    activityChoices.innerHTML = activity.choices
      .map((choice) => `<button class="button ghost" type="button" data-choice-id="${choice.id}">${choice.label}</button>`)
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
      renderTutorialBox();
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
    renderActivityGuard(activity.id);
    renderTutorialBox();
  }

  function handleActivityChoice(choiceId: string) {
    if (!activities.length) return;
    const fallback = activities[0];
    const currentActivityId = activitySelect?.value || fallback.id;
    const activity = activities.find((item) => item.id === currentActivityId);
    if (!activity) return;
    const choice = activity.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    const stats = getActivityStats(activity.id);
    const now = Date.now();
    const remainingMs = stats.lastPlayedAt ? ACTIVITY_COOLDOWN_MS - (now - stats.lastPlayedAt) : 0;
    if (remainingMs > 0) {
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      if (activityResultBox) {
        activityResultBox.dataset.state = "warn";
        activityResultBox.textContent = `Attendi ${remainingSeconds}s prima di ripetere l'attivita.`;
      }
      renderActivityGuard(activity.id);
      return;
    }
    if (stats.runs >= MAX_ACTIVITY_RUNS) {
      if (activityResultBox) {
        activityResultBox.dataset.state = "warn";
        activityResultBox.textContent = "Limite sessione raggiunto per questo scenario demo.";
      }
      renderActivityGuard(activity.id);
      return;
    }
    applyRewards(choice.rewards);
    gameState = {
      ...gameState,
      activityStats: { ...gameState.activityStats, [activity.id]: { runs: stats.runs + 1, lastPlayedAt: now } },
      tutorial: { ...gameState.tutorial, firstChoiceComplete: true },
    };
    persistState(gameState, activityResultBox || undefined);
    renderCareerCard();
    renderActivityGuard(activity.id);
    renderTutorialBox();
    if (activityResultBox) {
      activityResultBox.dataset.state = "ok";
      activityResultBox.textContent = `${choice.summary} (${formatRewards(choice.rewards)})`;
    }
  }

  function computeTurnRewards(event: DevEvent, roleId: RoleId): Rewards {
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
      turnLog.innerHTML = '<li class="muted">Nessun turno registrato.</li>';
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
    if (!devEvents.length) {
      if (turnFeedbackBox) {
        turnFeedbackBox.dataset.state = "warn";
        turnFeedbackBox.textContent = "Nessun evento di test configurato.";
      }
      return;
    }
    const eventId = eventSelect?.value || devEvents[0].id;
    const selectedEvent = devEvents.find((item) => item.id === eventId) ?? devEvents[0];
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
    };

    applyRewards(rewards);
    gameState = { ...gameState, turns: [record, ...gameState.turns].slice(0, MAX_TURNS_STORED) };
    const result = persistState(gameState, turnFeedbackBox || undefined);
    renderCareerCard();
    renderTurnHistory();
    renderAvatarPreview();
    if (turnFeedbackBox) {
      turnFeedbackBox.dataset.state = result.ok ? "ok" : "warn";
      turnFeedbackBox.textContent = result.ok
        ? `Turno registrato: ${selectedEvent.name} (${formatRewards(rewards)})`
        : "Turno registrato ma salvataggio locale non riuscito: usa la stessa scheda.";
    }
  }

  renderRoleOptions(profileRoleSelect);
  renderRoleOptions(turnRoleSelect);
  renderAvatarOptions();
  renderEvents();
  renderActivityUI();
  syncProfileForm();
  renderCareerCard();
  renderTurnHistory();
  renderAvatarPreview();
  renderTutorialBox();

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

  avatarHueInput?.addEventListener("input", () => {
    handleSaveProfile();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    gameState = loadState();
    syncProfileForm();
    renderCareerCard();
    renderActivityUI();
    renderTurnHistory();
    renderAvatarPreview();
    showSyncBadge();
  });

  avatarIconSelect?.addEventListener("change", () => {
    handleSaveProfile();
  });

  root.querySelector<HTMLButtonElement>('[data-action="dismiss-tutorial"]')?.addEventListener("click", () => {
    gameState = { ...gameState, tutorial: { ...gameState.tutorial, firstChoiceComplete: true } };
    saveState(gameState);
    renderTutorialBox();
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
