import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { isPublicMode, requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type DashboardPanel = "overview" | "commands" | "deploy" | "db" | "audit" | "flags" | "mobile";

type PanelDefinition = {
  id: DashboardPanel;
  label: string;
  description: string;
  controlPlaneView?: "commands" | "render" | "db" | "audit" | "mobile-flags";
  externalUrl?: string;
};

const PANELS: PanelDefinition[] = [
  {
    id: "overview",
    label: "Panoramica",
    description: "Stato rapido del sistema e configurazione runtime.",
  },
  {
    id: "commands",
    label: "Comandi",
    description: "Prepara/esegui operazioni con conferma a 2 step.",
    controlPlaneView: "commands",
  },
  {
    id: "deploy",
    label: "Deploy",
    description: "Stato servizi e deploy attivi.",
    controlPlaneView: "render",
  },
  {
    id: "db",
    label: "Database",
    description: "Operazioni DB e controlli safe.",
    controlPlaneView: "db",
  },
  {
    id: "audit",
    label: "Audit",
    description: "Tracciamento tecnico eventi e comandi.",
    controlPlaneView: "audit",
  },
  {
    id: "flags",
    label: "Feature Flags",
    description: "Gestione runtime flag mobile.",
    controlPlaneView: "mobile-flags",
  },
  {
    id: "mobile",
    label: "Mobile Preview",
    description: "Preview client mobile live.",
    externalUrl: "/mobile/",
  },
];

function isDashboardPanel(value: string | null | undefined): value is DashboardPanel {
  return PANELS.some((panel) => panel.id === value);
}

function getPanelFromUrl(): DashboardPanel {
  if (typeof window === "undefined") return "overview";
  const panel = new URLSearchParams(window.location.search).get("panel")?.trim() || "";
  return isDashboardPanel(panel) ? panel : "overview";
}

function getPanelHref(panel: DashboardPanel) {
  if (panel === "overview") return "/";
  return `/?panel=${panel}`;
}

function renderPanelSwitcher(activePanel: DashboardPanel) {
  return PANELS.map((panel) => {
    const variant = panel.id === activePanel ? "primary" : "ghost";
    return `<a class="button ${variant} small" href="${getPanelHref(panel.id)}">${panel.label}</a>`;
  }).join("");
}

function getPanelById(panel: DashboardPanel) {
  return PANELS.find((item) => item.id === panel) ?? PANELS[0];
}

function resolveWorkspaceUrl(panel: PanelDefinition) {
  if (panel.controlPlaneView) {
    return buildControlPlaneUrl({ view: panel.controlPlaneView, source: "ops-dashboard" });
  }
  if (panel.externalUrl) return panel.externalUrl;
  return null;
}

const start = async () => {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const description = isPublicMode
    ? "Una pagina unica per monitoraggio tecnico essenziale."
    : "Una pagina unica con sezioni dinamiche: comandi, deploy, database, audit, flags e mobile preview.";

  const activePanelId = getPanelFromUrl();
  const activePanel = getPanelById(activePanelId);
  const workspaceUrl = resolveWorkspaceUrl(activePanel);

  const quickActions = PANELS.map((panel) => ({
    id: panel.id,
    label: panel.label,
    href: getPanelHref(panel.id),
  }));

  const ctaRow = [
    {
      id: "open-active",
      label: activePanel.label,
      href: getPanelHref(activePanelId),
      variant: "primary",
    },
    {
      id: "open-overview",
      label: "Panoramica",
      href: "/",
      variant: "ghost",
    },
    {
      id: "refresh",
      label: "Reload",
      kind: "button",
      dataAction: "refresh",
      variant: "ghost",
    },
  ];

  const hero = renderPageHero({
    title: "Ops Dashboard",
    description,
    currentPage: "home",
    breadcrumbs: [{ label: "Home" }, { label: activePanel.label }],
    quickActions,
    ctaRow,
  });
  const configWarnings = getConfigWarnings();
  const runtimeControlPlane = appConfig.controlPlane.baseUrl || "relative origin";
  const runtimeFlags = Object.entries(appConfig.featureFlags)
    .map(([flag, enabled]) => `${flag}:${enabled ? "on" : "off"}`)
    .join(" | ");

  const showOverviewCards = activePanelId === "overview";
  const showStatusCard = showOverviewCards && isFeatureEnabled("status-card");
  const showPermissionsCard = showOverviewCards && isFeatureEnabled("permissions-card");

  root.innerHTML = `
    <main class="page">
      <section class="layout-stack" id="hero">
        ${hero}
        <div class="badges">
          <span class="badge">Installable</span>
          <span class="badge">Mobile Focused</span>
          <span class="badge">Control-Plane Ready</span>
        </div>
      </section>

      <section class="grid layout-grid">
        <article class="card layout-span-2">
          <h2>Area di lavoro</h2>
          <p>${activePanel.description}</p>
          <div class="cta-row">${renderPanelSwitcher(activePanelId)}</div>
          ${
            workspaceUrl
              ? `
                <div class="cta-row">
                  <a class="button ghost small" href="${workspaceUrl}" target="_blank" rel="noreferrer">Apri in nuova scheda</a>
                </div>
                <div class="ops-embed-wrap">
                  <iframe class="ops-embed-frame" src="${workspaceUrl}" title="${activePanel.label}" loading="lazy"></iframe>
                </div>
              `
              : `
                <ul class="list">
                  <li><strong>Comandi:</strong> esegui operazioni con reason obbligatoria e conferma 2-step.</li>
                  <li><strong>Deploy:</strong> verifica il deployment attivo reale prima di qualsiasi azione.</li>
                  <li><strong>Database:</strong> usa query safe e mutazioni controllate da ruolo.</li>
                  <li><strong>Audit:</strong> traccia tutte le operazioni tecniche in un solo stream.</li>
                  <li><strong>Flags:</strong> abilita/disabilita feature mobile in runtime.</li>
                </ul>
              `
          }
        </article>

        <article class="card">
          <h2>Configurazione runtime</h2>
          <ul class="list">
            <li><strong>Env:</strong> ${appConfig.environment}</li>
            <li><strong>Public mode:</strong> ${appConfig.publicMode ? "on" : "off"}</li>
            <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "ok" : "missing"}</li>
            <li><strong>Control-plane:</strong> ${runtimeControlPlane}</li>
            <li><strong>Flags:</strong> ${runtimeFlags}</li>
          </ul>
          ${configWarnings.length ? `<p class="muted">${configWarnings.join(" | ")}</p>` : "<p class=\"muted\">Nessun warning critico.</p>"}
        </article>

        ${showStatusCard ? renderStatusCard() : ""}

        ${showPermissionsCard ? renderPermissionsCard() : ""}
      </section>
    </main>
  `;

  if (showStatusCard) {
    attachStatusListeners(root, '[data-action="refresh"]');
  }
  if (showPermissionsCard) {
    attachPermissionsListeners(root);
  }
};

void start();
