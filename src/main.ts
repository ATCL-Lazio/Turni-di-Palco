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
    </section>
  </main>
`;

const connectionNode = root.querySelector<HTMLElement>("[data-connection]");
const swStatusNode = root.querySelector<HTMLElement>("[data-sw-status]");
const reloadButton = root.querySelector<HTMLButtonElement>('[data-action="refresh"]');

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
