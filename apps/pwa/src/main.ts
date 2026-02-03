import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { isPublicMode, requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";

const start = async () => {
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const description = isPublicMode
    ? "Shell installabile e offline-ready per costruire il loop di gioco."
    : "Shell installabile e offline-ready per costruire il loop di gioco. I moduli demo (profilo, attivita simulate e turni) ora vivono nel playground dev.";
  const quickActions = [
    { id: "hero", label: "Hero", href: "#hero", icon: "⬆️" },
    { id: "permissions", label: "Permessi", href: "#permissions", icon: "✅" },
    { id: "game", label: "Hub", href: "/game.html", icon: "🎮" },
  ];

  if (!isPublicMode) {
    quickActions.splice(2, 0, { id: "dev", label: "Dev playground", href: "/dev.html", icon: "🛠️" });
  }

  const ctaRow = [
    { id: "refresh", label: "Reload per update", kind: "button", dataAction: "refresh", variant: "ghost" },
    { id: "open-game", label: "Apri interfaccia base", href: "/game.html", variant: "ghost", icon: "🎮" },
  ];

  if (!isPublicMode) {
    ctaRow.unshift({ id: "open-dev", label: "Apri dev playground", href: "/dev.html", variant: "primary", icon: "🛠️" });
  }

  const hero = renderPageHero({
    title: "Progressive Web App base",
    description,
    currentPage: "home",
    breadcrumbs: [{ label: "Home" }],
    quickActions,
    ctaRow,
  });

  root.innerHTML = `
    <main class="page">
      <section class="layout-stack" id="hero">
        ${hero}
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

        ${isFeatureEnabled("status-card") ? renderStatusCard() : ""}

        ${isFeatureEnabled("permissions-card") ? renderPermissionsCard() : ""}
      </section>
    </main>
  `;

  if (isFeatureEnabled("status-card")) {
    attachStatusListeners(root, '[data-action="refresh"]');
  }
  if (isFeatureEnabled("permissions-card")) {
    attachPermissionsListeners(root);
  }
};

void start();
