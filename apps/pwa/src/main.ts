import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type DashboardPanel = "home" | "ops";

type PanelDefinition = {
  id: DashboardPanel;
  label: string;
  description: string;
};

const PANELS: PanelDefinition[] = [
  {
    id: "home",
    label: "Home",
    description: "Tutto quello che serve per usare l'app in modo semplice.",
  },
  {
    id: "ops",
    label: "Area tecnica",
    description: "Strumenti per configurazioni e controlli avanzati.",
  },
];

function isDashboardPanel(value: string | null | undefined): value is DashboardPanel {
  return PANELS.some((panel) => panel.id === value);
}

function getPanelFromUrl(): DashboardPanel {
  if (typeof window === "undefined") return "home";
  const panel = new URLSearchParams(window.location.search).get("panel")?.trim() || "";
  return isDashboardPanel(panel) ? panel : "home";
}

function getPanelHref(panel: DashboardPanel) {
  if (panel === "home") return "/";
  return `/?panel=${panel}`;
}

function renderPanelSwitcher(activePanel: DashboardPanel) {
  return PANELS.map((panel) => {
    const variant = panel.id === activePanel ? "primary" : "ghost";
    return `<a class="button ${variant} small" href="${getPanelHref(panel.id)}">${panel.label}</a>`;
  }).join("");
}

function renderHomePanel(configWarnings: string[]) {
  return `
    <article class="card layout-span-2">
      <h2>Inizia da qui</h2>
      <p>Usa i pulsanti qui sotto: non servono passaggi tecnici.</p>
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

    <article class="card">
      <h2>Cosa puoi fare</h2>
      <ul class="list">
        <li>Vedere i turni e gli eventi disponibili.</li>
        <li>Registrare rapidamente la presenza con QR.</li>
        <li>Controllare profilo, reputazione e progressi.</li>
      </ul>
    </article>

    <article class="card">
      <h2>Hai bisogno di aiuto?</h2>
      <p>Se qualcosa non funziona, ricarica la pagina e riprova dall&apos;app mobile.</p>
      <div class="cta-row">
        <a class="button ghost small" href="/mobile/">Torna all&apos;app</a>
      </div>
      ${
        configWarnings.length
          ? `<p class="muted">Nota configurazione: ${configWarnings.join(" | ")}</p>`
          : `<p class="muted">Configurazione pronta.</p>`
      }
    </article>
  `;
}

function renderOpsPanel() {
  const runtimeControlPlane = appConfig.controlPlane.baseUrl || "relative origin";
  const runtimeFlags = Object.entries(appConfig.featureFlags)
    .map(([flag, enabled]) => `${flag}:${enabled ? "on" : "off"}`)
    .join(" | ");

  const opsViews = [
    { id: "commands", label: "Comandi" as const },
    { id: "render", label: "Rilasci" as const },
    { id: "db", label: "Database" as const },
    { id: "audit", label: "Registro" as const },
    { id: "mobile-flags", label: "Interruttori" as const },
  ];

  const workspaceUrl = buildControlPlaneUrl({ view: "commands", source: "ops-dashboard" });

  return `
    <article class="card layout-span-2">
      <h2>Area tecnica</h2>
      <p>Sezione riservata per operazioni avanzate.</p>
      <div class="cta-row">
        ${opsViews
          .map(
            (view) =>
              `<a class="button ghost small" href="${buildControlPlaneUrl({ view: view.id, source: "ops-dashboard" })}" target="_blank" rel="noreferrer">${view.label}</a>`
          )
          .join("")}
      </div>
      <div class="ops-embed-wrap">
        <iframe class="ops-embed-frame" src="${workspaceUrl}" title="Area tecnica" loading="lazy"></iframe>
      </div>
    </article>

    <article class="card">
      <h2>Stato runtime</h2>
      <ul class="list">
        <li><strong>Ambiente:</strong> ${appConfig.environment}</li>
        <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "configurato" : "mancante"}</li>
        <li><strong>Control plane:</strong> ${runtimeControlPlane}</li>
        <li><strong>Feature flags:</strong> ${runtimeFlags}</li>
      </ul>
    </article>
  `;
}

const start = async () => {
  if (enforceDesktopOnly()) return;

  const activePanelId = getPanelFromUrl();
  if (activePanelId === "ops" && !(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Root container missing");
  }

  const hero = renderPageHero({
    title: "Turni di Palco",
    description:
      activePanelId === "home"
        ? "Interfaccia semplificata: pochi pulsanti chiari e flusso guidato."
        : "Area riservata a utenti tecnici.",
    currentPage: "home",
    breadcrumbs: [{ label: "Home" }, { label: activePanelId === "home" ? "Utente" : "Tecnica" }],
    quickActions: PANELS.map((panel) => ({
      id: panel.id,
      label: panel.label,
      href: getPanelHref(panel.id),
    })),
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

  const showStatusCard = activePanelId === "ops" && isFeatureEnabled("status-card");
  const showPermissionsCard = activePanelId === "ops" && isFeatureEnabled("permissions-card");
  const configWarnings = getConfigWarnings();

  root.innerHTML = `
    <main class="page">
      <section class="layout-stack" id="hero">
        ${hero}
        <div class="badges">
          <span class="badge">Facile da usare</span>
          <span class="badge">Installabile</span>
          <span class="badge">QR pronto</span>
        </div>
      </section>

      <section class="grid layout-grid simple-grid">
        ${activePanelId === "home" ? renderHomePanel(configWarnings) : renderOpsPanel()}
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
