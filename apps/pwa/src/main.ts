import "../../../shared/styles/main.css";
import { renderAppBar } from "./components/app-bar";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";

const mainNav = [
  { label: "Home", href: "#hero", state: "active" as const },
  { label: "Permessi", href: "#permissions" },
  { label: "Dev playground", href: "/dev.html", icon: "🛠️" },
  { label: "Pagina gioco", href: "/game.html", icon: "🎮" },
];

const appBar = renderAppBar({ eyebrow: "Turni di Palco", subtitle: "PWA shell", actions: mainNav });

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page">
    ${appBar}

    <section class="hero layout-stack" id="hero">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Progressive Web App base</h1>
      <p class="lede">
        Shell installabile e offline-ready per costruire il loop di gioco. I moduli demo (profilo, attivita simulate e turni) ora vivono nel playground dev.
      </p>
      <div class="cta-row">
        <a class="button primary" href="/dev.html">
          Apri dev playground
        </a>
        <button class="button ghost" type="button" data-action="refresh">
          Reload per update
        </button>
        <a class="button ghost" href="/game.html">
          Apri interfaccia base
        </a>
      </div>
      <div class="badges">
        <span class="badge">Installable</span>
        <span class="badge">Offline friendly</span>
        <span class="badge">Vite + TypeScript</span>
      </div>
    </section>

    <section class="grid layout-grid">
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

      ${renderStatusCard()}

      ${renderPermissionsCard()}
    </section>
  </main>
`;

attachStatusListeners(root, '[data-action="refresh"]');
attachPermissionsListeners(root);
