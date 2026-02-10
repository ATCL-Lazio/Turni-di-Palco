import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderPermissionsCard, attachPermissionsListeners } from "./features/permissions-card";
import { renderStatusCard, attachStatusListeners } from "./features/status-card";
import { isPublicMode, requireDevAccess } from "./services/dev-gate";
import { isFeatureEnabled } from "./services/feature-flags";
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
    { id: "game", label: "Mobile Ops Hub", href: "/game.html" },
    { id: "map", label: "Mobile Infrastructure", href: "/map.html" },
    { id: "profile", label: "Mobile Runtime", href: "/profile.html" },
    { id: "events", label: "Mobile Releases", href: "/events.html" },
    { id: "turns", label: "Mobile Data Ops", href: "/turns.html" },
    { id: "leaderboard", label: "Mobile Audit", href: "/leaderboard.html" },
  ];

  if (!isPublicMode) {
    quickActions.unshift({ id: "dev", label: "Dev Playground", href: "/dev.html" });
    quickActions.unshift({ id: "dev-plus", label: "Dev Plus", href: "/dev-plus.html" });
  }

  const ctaRow = [
    { id: "open-dev-plus", label: "Open Dev Plus", href: "/dev-plus.html", variant: "primary" },
    { id: "open-mobile-preview", label: "Open Mobile Preview", href: "/mobile/", variant: "ghost" },
    { id: "open-ops-hub", label: "Open Mobile Ops Hub", href: "/game.html", variant: "ghost" },
    { id: "open-dev", label: "Open Dev Playground", href: "/dev.html", variant: "ghost" },
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
