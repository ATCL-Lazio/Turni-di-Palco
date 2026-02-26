import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { isPublicMode, requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type CockpitCard = {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  links: Array<{ label: string; href: string }>;
};

function getPanelFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("panel")?.trim() || "";
}

function renderCockpitCard(card: CockpitCard, focusedPanel: string) {
  const isFocused = focusedPanel === card.id;
  return `
    <article class="card${isFocused ? " card-focused" : ""}">
      <h2>${card.title}</h2>
      <p>${card.summary}</p>
      <ul class="list">${card.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>
      <div class="cta-row">
        ${card.links.map((link) => `<a class="button ghost" href="${link.href}">${link.label}</a>`).join("")}
      </div>
    </article>
  `;
}

const start = async () => {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const description = isPublicMode
    ? "Dashboard leggera per controllare salute mobile e deploy."
    : "Dashboard operativa: stato, deploy, DB, audit e feature flags in un unico flusso.";

  const focusedPanel = getPanelFromUrl();
  const controlPlaneCommandsUrl = buildControlPlaneUrl({ view: "commands", source: "home" });
  const controlPlaneRenderUrl = buildControlPlaneUrl({ view: "render", source: "home" });
  const controlPlaneDbUrl = buildControlPlaneUrl({ view: "db", source: "home" });
  const controlPlaneAuditUrl = buildControlPlaneUrl({ view: "audit", source: "home" });
  const controlPlaneFlagsUrl = buildControlPlaneUrl({ view: "mobile-flags", source: "home" });

  const quickActions = [
    { id: "control-plane", label: "Comandi", href: controlPlaneCommandsUrl },
    { id: "render", label: "Deploy", href: controlPlaneRenderUrl },
    { id: "db", label: "Database", href: controlPlaneDbUrl },
    { id: "audit", label: "Audit", href: controlPlaneAuditUrl },
    { id: "mobile-flags", label: "Flags", href: controlPlaneFlagsUrl },
    { id: "mobile-preview", label: "Mobile", href: "/mobile/" },
  ];

  if (!isPublicMode) {
    quickActions.unshift({ id: "dev-plus", label: "Dev Plus", href: controlPlaneCommandsUrl });
  }

  const ctaRow = [
    { id: "open-commands", label: "Apri comandi", href: controlPlaneCommandsUrl, variant: "primary" },
    { id: "open-deploy", label: "Apri deploy", href: controlPlaneRenderUrl, variant: "ghost" },
    { id: "open-mobile-preview", label: "Apri mobile", href: "/mobile/", variant: "ghost" },
    { id: "refresh", label: "Reload", kind: "button", dataAction: "refresh", variant: "ghost" },
  ];

  const cockpitCards: CockpitCard[] = [
    {
      id: "operations",
      title: "Comandi operativi",
      summary: "Tutto passa dal Control Plane: step 1 prepara, step 2 conferma.",
      bullets: [
        "Preset comando con reason e dry-run",
        "Conferma esplicita per azioni sensibili",
        "Fallback leggibile in caso di errore remoto",
      ],
      links: [
        { label: "Console comandi", href: controlPlaneCommandsUrl },
        { label: "Feature flags", href: controlPlaneFlagsUrl },
      ],
    },
    {
      id: "deploy",
      title: "Deploy e runtime",
      summary: "Monitora servizi Railway/Render e verifica release prima di intervenire.",
      bullets: [
        "Stato servizi e latenza",
        "Cronologia deploy e segnali runtime",
        "Quick path per trigger deployment",
      ],
      links: [
        { label: "Vista deploy", href: controlPlaneRenderUrl },
        { label: "Audit tecnico", href: controlPlaneAuditUrl },
      ],
    },
    {
      id: "data",
      title: "Database e audit",
      summary: "Controllo dati e tracciamento in una pipeline unica.",
      bullets: [
        "Read path sicuro su Supabase",
        "Mutazioni protette da ruoli",
        "Audit stream per postmortem",
      ],
      links: [
        { label: "Vista DB", href: controlPlaneDbUrl },
        { label: "Vista audit", href: controlPlaneAuditUrl },
      ],
    },
  ];

  const hero = renderPageHero({
    title: "Developer Ops Dashboard",
    description,
    currentPage: "home",
    breadcrumbs: [{ label: "Home" }],
    quickActions,
    ctaRow,
  });
  const configWarnings = getConfigWarnings();
  const runtimeControlPlane = appConfig.controlPlane.baseUrl || "relative origin";
  const runtimeFlags = Object.entries(appConfig.featureFlags)
    .map(([flag, enabled]) => `${flag}:${enabled ? "on" : "off"}`)
    .join(" | ");

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
        ${cockpitCards.map((card) => renderCockpitCard(card, focusedPanel)).join("")}

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
