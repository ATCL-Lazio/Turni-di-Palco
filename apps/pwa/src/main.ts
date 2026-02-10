import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { isPublicMode, requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
import { appConfig, getConfigWarnings } from "./services/app-config";
import { enforceDesktopOnly } from "./utils/desktop-only";

const start = async () => {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const description = isPublicMode
    ? "Installable shell for monitoring the mobile experience and release health."
    : "Installable shell with Dev Plus control-plane for mobile monitoring, rollout checks, and mobile data operations.";

  const quickActions = [
    { id: "game", label: "Mobile Ops Hub", href: "/mobile-ops.html" },
    { id: "map", label: "Mobile Infrastructure", href: "/mobile-infrastructure.html" },
    { id: "profile", label: "Mobile Runtime", href: "/mobile-runtime.html" },
    { id: "events", label: "Mobile Releases", href: "/mobile-releases.html" },
    { id: "turns", label: "Mobile Data Ops", href: "/mobile-data-ops.html" },
    { id: "leaderboard", label: "Mobile Audit", href: "/mobile-audit.html" },
  ];

  if (!isPublicMode) {
    quickActions.unshift({ id: "dev", label: "Dev Playground", href: "/dev-playground.html" });
    quickActions.unshift({ id: "dev-plus", label: "Dev Plus", href: "/control-plane.html" });
  }

  const ctaRow = [
    { id: "open-dev-plus", label: "Open Dev Plus", href: "/control-plane.html", variant: "primary" },
    { id: "open-mobile-preview", label: "Open Mobile Preview", href: "/mobile/", variant: "ghost" },
    { id: "open-ops-hub", label: "Open Mobile Ops Hub", href: "/mobile-ops.html", variant: "ghost" },
    { id: "open-dev", label: "Open Dev Playground", href: "/dev-playground.html", variant: "ghost" },
    { id: "refresh", label: "Reload", kind: "button", dataAction: "refresh", variant: "ghost" },
  ];

  const hero = renderPageHero({
    title: "Mobile Monitoring Dashboard",
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
        <article class="card">
          <h2>Mobile Monitoring Focus</h2>
          <p>
            This PWA now acts as a mobile operations cockpit: monitor runtime health, mobile releases, and
            command-driven remediation from one place.
          </p>
          <ul class="list">
            <li><strong>Mobile runtime:</strong> availability and error trend checks</li>
            <li><strong>Mobile releases:</strong> rollout visibility and trigger flow</li>
            <li><strong>Mobile data:</strong> safe Supabase read/mutate operations</li>
          </ul>
        </article>

        <article class="card">
          <h2>Monitoring Domains</h2>
          <p>The previous gameplay routes now map to mobile operations domains.</p>
          <div class="pill-row">
            <span class="pill">Mobile Ops Hub</span>
            <span class="pill">Infrastructure</span>
            <span class="pill">Access</span>
            <span class="pill">Runtime Health</span>
            <span class="pill">Releases</span>
            <span class="pill">Data Ops</span>
            <span class="pill">Audit</span>
          </div>
        </article>

        <article class="card">
          <h2>Runtime Configuration</h2>
          <ul class="list">
            <li><strong>Environment:</strong> ${appConfig.environment}</li>
            <li><strong>Public mode:</strong> ${appConfig.publicMode ? "enabled" : "disabled"}</li>
            <li><strong>Supabase:</strong> ${appConfig.supabase.configured ? "configured" : "missing"}</li>
            <li><strong>Control-plane:</strong> ${runtimeControlPlane}</li>
            <li><strong>Feature flags:</strong> ${runtimeFlags}</li>
          </ul>
          ${configWarnings.length ? `<p class="muted">${configWarnings.join(" | ")}</p>` : "<p class=\"muted\">Config loaded without critical warnings.</p>"}
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
