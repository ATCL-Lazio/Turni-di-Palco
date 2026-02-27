import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { requireDevAccess } from "./services/dev-gate";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type MainAction = {
  id: "commands" | "render" | "audit";
  label: string;
  description: string;
};

const MAIN_ACTIONS: MainAction[] = [
  {
    id: "commands",
    label: "Esegui un comando",
    description: "Apri il flusso guidato per fare una modifica.",
  },
  {
    id: "render",
    label: "Controlla i rilasci",
    description: "Verifica quale versione e online.",
  },
  {
    id: "audit",
    label: "Vedi il registro",
    description: "Controlla le operazioni recenti.",
  },
];

function renderMainActions() {
  return MAIN_ACTIONS.map((action) => {
    const href = buildControlPlaneUrl({ view: action.id, source: "ops-dashboard" });
    return `
      <li>
        <a class="button ghost" href="${href}" target="_blank" rel="noreferrer">${action.label}</a>
        <p class="muted">${action.description}</p>
      </li>
    `;
  }).join("");
}

const start = async () => {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Root container missing");
  }

  const configWarnings = getConfigWarnings();

  const hero = renderPageHero({
    title: "Turni di Palco",
    description: "Dashboard comandi semplificata: scegli un'azione e apri.",
    currentPage: "home",
    breadcrumbs: [{ label: "Dashboard" }],
    quickActions: [
      { id: "mobile", label: "App mobile", href: "/mobile/" },
      { id: "commands", label: "Comandi", href: buildControlPlaneUrl({ view: "commands", source: "ops-dashboard" }) },
    ],
    ctaRow: [
      {
        id: "open-mobile",
        label: "Apri app mobile",
        href: "/mobile/",
        variant: "primary",
      },
      {
        id: "refresh",
        label: "Ricarica",
        kind: "button",
        dataAction: "refresh",
        variant: "ghost",
      },
    ],
  });

  root.innerHTML = `
    <main class="page">
      <section class="layout-stack" id="hero">
        ${hero}
        <div class="badges">
          <span class="badge">Semplice</span>
          <span class="badge">3 azioni</span>
          <span class="badge">1 pagina</span>
        </div>
      </section>

      <section class="grid layout-grid simple-grid">
        <article class="card layout-span-2">
          <h2>Cosa vuoi fare?</h2>
          <ul class="list simple-action-list">
            ${renderMainActions()}
          </ul>
        </article>

        <article class="card">
          <h2>Avanzate</h2>
          <p>Usa queste opzioni solo se necessario.</p>
          <div class="cta-row">
            <a class="button ghost small" href="${buildControlPlaneUrl({ view: "db", source: "ops-dashboard" })}" target="_blank" rel="noreferrer">Database</a>
            <a class="button ghost small" href="${buildControlPlaneUrl({ view: "mobile-flags", source: "ops-dashboard" })}" target="_blank" rel="noreferrer">Interruttori</a>
          </div>
        </article>

        <article class="card">
          <h2>Stato</h2>
          <ul class="list">
            <li><strong>Ambiente:</strong> ${appConfig.environment}</li>
            <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "ok" : "da configurare"}</li>
          </ul>
          ${configWarnings.length ? `<p class="muted">${configWarnings.join(" | ")}</p>` : '<p class="muted">Nessun problema rilevato.</p>'}
        </article>
      </section>
    </main>
  `;

  const refreshButton = root.querySelector<HTMLElement>('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.addEventListener("click", () => window.location.reload());
  }
};

void start();
