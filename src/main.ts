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
        Foundation for the interactive experience: offline-ready shell, installable manifest, and a lightweight UI scaffold to plug gameplay into.
      </p>
      <div class="cta-row">
        <button class="button primary" type="button" data-action="start">
          Open prototype shell
        </button>
        <button class="button ghost" type="button" data-action="refresh">
          Reload for updates
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
          Single-page skeleton to host the future game loop. Add scenes, HUD, or menus inside <code>src/</code> and keep data-only assets in <code>public/</code>.
        </p>
        <ul class="list">
          <li><strong>Routing:</strong> spa via Vite dev server</li>
          <li><strong>Install:</strong> manifest + service worker</li>
          <li><strong>Assets:</strong> cached on first use</li>
        </ul>
      </article>

      <article class="card">
        <h2>Build + Dev</h2>
        <p>
          Use <code>npm run dev</code> for local work, <code>npm run build</code> for production output, and <code>npm run preview</code> to smoke-test the build.
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
        <p class="muted">Toggle your network to test offline behaviour. When an update is ready, use the reload button above.</p>
      </article>

      <article class="card">
        <h2>Permission check</h2>
        <p>Richiedi i permessi comuni (notifiche, geolocalizzazione) e controlla l'esito in tempo reale.</p>
        <div class="cta-row">
          <button class="button primary" type="button" data-action="notify-permission">
            Richiedi notifiche
          </button>
          <button class="button ghost" type="button" data-action="geo-permission">
            Richiedi geolocalizzazione
          </button>
        </div>
        <div class="result-box" data-permission-result>Pronto per i test.</div>
      </article>
    </section>
  </main>
`;

const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
const reloadButton = root.querySelector<HTMLButtonElement>('[data-action="refresh"]');
const notifyButton = root.querySelector<HTMLButtonElement>('[data-action="notify-permission"]');
const geoButton = root.querySelector<HTMLButtonElement>('[data-action="geo-permission"]');
const permissionOutput = root.querySelector<HTMLElement>("[data-permission-result]");

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
      swStatusNode.textContent = "Update available — reload to apply";
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

notifyButton?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    renderPermission("Notifiche non supportate in questo browser.", "error");
    return;
  }
  try {
    const result = await Notification.requestPermission();
    const state = result === "granted" ? "ok" : result === "denied" ? "warn" : "info";
    renderPermission(`Permesso notifiche: ${result}`, state);
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
