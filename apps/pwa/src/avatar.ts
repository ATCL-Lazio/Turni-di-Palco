import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { registerServiceWorker } from "./pwa/register-sw";
import { promptServiceWorkerUpdate } from "./pwa/sw-update";
import { deriveRpmThumbnail, getAvatarVisual, loadState, saveState, SaveStateResult, STORAGE_KEY } from "./state";
import { requireDevAccess } from "./services/dev-gate";

const start = async () => {
  if (!(await requireDevAccess())) return;


  const RPM_ORIGIN = "https://readyplayer.me";
  const RPM_SRC = "https://readyplayer.me/avatar?frameApi";

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const pageHero = renderPageHero({
    title: "Avatar ReadyPlayer.Me",
    description: "Crea o aggiorna il tuo avatar 3D. Il risultato verrà salvato nel profilo e usato nelle altre pagine.",
    currentPage: "avatar",
    breadcrumbs: [
      { label: "Hub", href: "/game.html" },
      { label: "Avatar" },
    ],
    backHref: "/game.html",
    backLabel: "Torna all'hub",
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${pageHero}

      <section class="grid layout-grid">
        <article class="card layout-span-2">
          <h2>Editor ReadyPlayer.Me</h2>
          <div class="rpm-frame">
            <iframe title="ReadyPlayer.Me avatar" data-rpm-frame src="${RPM_SRC}" allow="camera *; microphone *" referrerpolicy="no-referrer"></iframe>
          </div>
          <div class="result-box" data-rpm-status>Apri l'editor, esporta l'avatar e verrà salvato qui.</div>
        </article>

        <article class="card">
          <h2>Anteprima avatar</h2>
          <div class="profile-pane">
            <div class="avatar-display large" data-avatar="preview">
              <img data-avatar-img alt="Avatar ReadyPlayerMe" />
              <span class="avatar-icon" data-avatar-label></span>
            </div>
            <div>
              <p class="muted" data-avatar-meta>Nessun avatar ReadyPlayer.Me salvato.</p>
              <div class="pill-row">
                <span class="pill ghost" data-avatar-updated>Mai sincronizzato</span>
              </div>
            </div>
          </div>
          <div class="cta-row">
            <button class="button ghost" type="button" data-action="clear-avatar">Rimuovi avatar RPM</button>
            <a class="button primary" href="/map.html">Usa nella mappa</a>
          </div>
        </article>
      </section>
    </main>
  `;

  const iframe = root.querySelector<HTMLIFrameElement>('[data-rpm-frame]');
  const statusBox = root.querySelector<HTMLElement>('[data-rpm-status]');
  const avatarDisplay = root.querySelector<HTMLElement>('[data-avatar="preview"]');
  const avatarImg = root.querySelector<HTMLImageElement>('[data-avatar-img]');
  const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');
  const avatarMeta = root.querySelector<HTMLElement>('[data-avatar-meta]');
  const avatarUpdated = root.querySelector<HTMLElement>('[data-avatar-updated]');
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

  function persistState(nextState: typeof state, feedback?: HTMLElement): SaveStateResult {
    const result = saveState(nextState);
    state = result.state;
    if (!result.ok && feedback) {
      feedback.dataset.state = "warn";
      feedback.textContent = "Salvataggio locale non riuscito: manteniamo una copia in memoria.";
    }
    return result;
  }

  function renderPreview() {
    const avatarVisual = getAvatarVisual(state.profile.avatar);
    if (avatarDisplay) {
      avatarDisplay.style.setProperty("--avatar-color", avatarVisual.color);
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
    if (avatarMeta) {
      avatarMeta.textContent = state.profile.avatar.rpmUrl
        ? `Avatar pronto: ${state.profile.avatar.rpmId || "ReadyPlayer.Me"}`
        : "Nessun avatar ReadyPlayer.Me salvato.";
    }
    if (avatarUpdated) {
      const updated = state.profile.avatar.updatedAt;
      avatarUpdated.textContent = updated ? `Aggiornato: ${new Date(updated).toLocaleString()}` : "Mai sincronizzato";
    }
  }

  function isRpmEvent(event: MessageEvent) {
    const origin = event.origin || "";
    const allowed = origin === RPM_ORIGIN || origin.endsWith(".readyplayer.me");
    const sourceOk = typeof event.data === "object" && event.data?.source === "readyplayer.me";
    return allowed && sourceOk;
  }

  function subscribe(eventName: string) {
    iframe?.contentWindow?.postMessage(
      {
        target: "readyplayer.me",
        type: "subscribe",
        eventName,
      },
      "*"
    );
  }

  function handleExported(url?: string, id?: string, thumb?: string) {
    if (!url) {
      if (statusBox) {
        statusBox.dataset.state = "warn";
        statusBox.textContent = "Avatar non ricevuto: riprova l'esportazione.";
      }
      return;
    }
    const derivedThumb = thumb || deriveRpmThumbnail(url);
    state = {
      ...state,
      profile: {
        ...state.profile,
        avatar: { ...state.profile.avatar, rpmUrl: url, rpmThumbnail: derivedThumb, rpmId: id || "", updatedAt: Date.now() },
      },
    };
    const result = persistState(state, statusBox);
    renderPreview();
    if (statusBox) {
      statusBox.dataset.state = result.ok ? "ok" : "warn";
      statusBox.textContent = result.ok ? "Avatar salvato nel profilo." : "Avatar salvato solo in memoria: riprova il salvataggio.";
    }
  }

  window.addEventListener("message", (event) => {
    if (!isRpmEvent(event)) return;
    const payload = event.data;
    const type = payload?.eventName || payload?.type;
    if (type === "v1.frame.ready") {
      subscribe("v1.avatar.exported");
      return;
    }
    if (type === "v1.avatar.exported") {
      const url = payload?.data?.url || payload?.url;
      const avatarId = payload?.data?.avatarId || payload?.data?.id || payload?.avatarId;
      const thumb = payload?.data?.thumbnailUrl || payload?.data?.thumb || payload?.thumb;
      handleExported(url, avatarId, thumb);
    }
  });

  root.querySelector<HTMLButtonElement>('[data-action="clear-avatar"]')?.addEventListener("click", () => {
    state = {
      ...state,
      profile: { ...state.profile, avatar: { ...state.profile.avatar, rpmUrl: "", rpmThumbnail: "", rpmId: "", updatedAt: undefined } },
    };
    const result = persistState(state, statusBox);
    renderPreview();
    if (statusBox) {
      statusBox.dataset.state = result.ok ? "info" : "warn";
      statusBox.textContent = result.ok
        ? "Avatar RPM rimosso. Verrà usato il fallback locale."
        : "Avatar rimosso solo in memoria: controlla i permessi di storage.";
    }
  });

  renderPreview();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderPreview();
    showSyncBadge();
    if (statusBox) {
      statusBox.dataset.state = "info";
      statusBox.textContent = "Stato aggiornato da un'altra scheda.";
    }
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
