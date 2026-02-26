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
    description: "Vista generale: cosa sta funzionando e cosa no.",
  },
  {
    id: "commands",
    label: "Comandi",
    description: "Esegui azioni tecniche guidate, in due passaggi.",
    controlPlaneView: "commands",
  },
  {
    id: "deploy",
    label: "Rilasci",
    description: "Controlla lo stato dei rilasci e dei servizi online.",
    controlPlaneView: "render",
  },
  {
    id: "db",
    label: "Database",
    description: "Leggi o aggiorna dati in modo sicuro.",
    controlPlaneView: "db",
  },
  {
    id: "audit",
    label: "Registro attività",
    description: "Cronologia delle azioni fatte da dashboard.",
    controlPlaneView: "audit",
  },
  {
    id: "flags",
    label: "Interruttori funzioni",
    description: "Attiva/disattiva funzioni mobile in tempo reale.",
    controlPlaneView: "mobile-flags",
  },
  {
    id: "mobile",
    label: "Anteprima mobile",
    description: "Apri l'app mobile come la vede l'utente.",
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
    ? "Una pagina unica, con comandi chiari e senza giri inutili."
    : "Una sola dashboard: scegli una sezione e lavori lì, senza saltare tra pagine.";

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
          <span class="badge">Installabile</span>
          <span class="badge">Pronta per mobile</span>
          <span class="badge">Controllo tecnico</span>
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
                  <li><strong>Comandi:</strong> scegli un'azione, spiega il motivo e conferma.</li>
                  <li><strong>Rilasci:</strong> controlla quale versione è davvero online.</li>
                  <li><strong>Database:</strong> leggi o modifica dati con permessi controllati.</li>
                  <li><strong>Registro attività:</strong> vedi chi ha fatto cosa e quando.</li>
                  <li><strong>Interruttori funzioni:</strong> accendi/spegni funzioni mobile al volo.</li>
                </ul>
              `
          }
        </article>

        <article class="card">
          <h2>Impostazioni tecniche</h2>
          <ul class="list">
            <li><strong>Ambiente:</strong> ${appConfig.environment}</li>
            <li><strong>Modalità pubblica:</strong> ${appConfig.publicMode ? "attiva" : "disattiva"}</li>
            <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "configurato" : "mancante"}</li>
            <li><strong>Server controllo:</strong> ${runtimeControlPlane}</li>
            <li><strong>Interruttori:</strong> ${runtimeFlags}</li>
          </ul>
          ${configWarnings.length ? `<p class="muted">${configWarnings.join(" | ")}</p>` : "<p class=\"muted\">Nessun warning critico.</p>"}
        </article>

        <article class="card">
          <h2>Traduzione rapida</h2>
          <ul class="list">
            <li><strong>Rilasci</strong> = pubblicazioni nuove versioni.</li>
            <li><strong>Registro attività</strong> = cronologia operazioni.</li>
            <li><strong>Interruttori funzioni</strong> = pulsanti on/off delle feature.</li>
            <li><strong>Comando in due passaggi</strong> = prima controlli, poi confermi.</li>
          </ul>
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
