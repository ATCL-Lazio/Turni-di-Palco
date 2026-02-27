import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type OpsShortcut = {
  id: "commands" | "render" | "db" | "audit" | "mobile-flags";
  label: string;
  description: string;
};

const OPS_SHORTCUTS: OpsShortcut[] = [
  {
    id: "commands",
    label: "Comandi",
    description: "Azioni guidate in due passaggi.",
  },
  {
    id: "render",
    label: "Rilasci",
    description: "Controlla cosa e davvero online.",
  },
  {
    id: "db",
    label: "Database",
    description: "Consulta o aggiorna dati in sicurezza.",
  },
  {
    id: "audit",
    label: "Registro",
    description: "Storico operazioni eseguite.",
  },
  {
    id: "mobile-flags",
    label: "Interruttori",
    description: "Accendi o spegni funzioni mobile.",
  },
];

function renderOpsCards() {
  return OPS_SHORTCUTS.map((shortcut) => {
    const href = buildControlPlaneUrl({ view: shortcut.id, source: "ops-dashboard" });
    return `
      <article class="card">
        <h2>${shortcut.label}</h2>
        <p>${shortcut.description}</p>
        <div class="cta-row">
          <a class="button ghost small" href="${href}" target="_blank" rel="noreferrer">Apri ${shortcut.label}</a>
        </div>
      </article>
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
    description: "Dashboard unica: tutto in una pagina, senza embed.",
    currentPage: "home",
    breadcrumbs: [{ label: "Dashboard" }],
    quickActions: [
      { id: "mobile", label: "App mobile", href: "/mobile/" },
      { id: "privacy", label: "Privacy", href: "/privacy.html" },
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

  const showStatusCard = isFeatureEnabled("status-card");
  const showPermissionsCard = isFeatureEnabled("permissions-card");

  root.innerHTML = `
    <main class="page">
      <section class="layout-stack" id="hero">
        ${hero}
        <div class="badges">
          <span class="badge">1 pagina</span>
          <span class="badge">Zero embed</span>
          <span class="badge">Flusso guidato</span>
        </div>
      </section>

      <section class="grid layout-grid simple-grid">
        <article class="card layout-span-2">
          <h2>Inizia da qui</h2>
          <p>Usa i pulsanti qui sotto. Non servono passaggi tecnici.</p>
          <div class="cta-row">
            <a class="button primary" href="/mobile/">Apri app mobile</a>
            <a class="button ghost" href="/privacy.html">Privacy</a>
          </div>
          <ul class="list step-list">
            <li><strong>1.</strong> Apri l&apos;app mobile.</li>
            <li><strong>2.</strong> Accedi o registrati.</li>
            <li><strong>3.</strong> Scansiona il QR per registrare il turno.</li>
          </ul>
        </article>

        ${renderOpsCards()}

        <article class="card layout-span-2">
          <h2>Stato configurazione</h2>
          <ul class="list">
            <li><strong>Ambiente:</strong> ${appConfig.environment}</li>
            <li><strong>Modalita pubblica:</strong> ${appConfig.publicMode ? "attiva" : "disattiva"}</li>
            <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "configurato" : "mancante"}</li>
          </ul>
          ${configWarnings.length ? `<p class="muted">${configWarnings.join(" | ")}</p>` : '<p class="muted">Nessun warning critico.</p>'}
        </article>

        ${showStatusCard ? renderStatusCard() : ""}
        ${showPermissionsCard ? renderPermissionsCard() : ""}
      </section>
    </main>
  `;

  const refreshButton = root.querySelector<HTMLElement>('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.addEventListener("click", () => window.location.reload());
  }

  if (showStatusCard) {
    attachStatusListeners(root, '[data-action="refresh"]');
  }
  if (showPermissionsCard) {
    attachPermissionsListeners(root);
  }
};

void start();
