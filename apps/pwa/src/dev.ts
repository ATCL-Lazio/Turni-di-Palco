import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { requireDevAccess } from "./services/dev-gate";
import { enforceDesktopOnly } from "./utils/desktop-only";

const start = async () => {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const hero = renderPageHero({
    title: "Dev Playground",
    description: "Sandbox for mobile monitoring probes, runbook checks, and control-plane payload drafting.",
    currentPage: "dev",
    breadcrumbs: [
      { label: "Home", href: "/" },
      { label: "Dev Playground" },
    ],
    backHref: "/",
    backLabel: "Back To Landing",
    quickActions: [
      { id: "dev-plus", label: "Dev Plus", href: "/control-plane.html" },
      { id: "game", label: "Mobile Ops Hub", href: "/mobile-ops.html" },
      { id: "events", label: "Mobile Releases", href: "/mobile-releases.html" },
      { id: "turns", label: "Mobile Data Ops", href: "/mobile-data-ops.html" },
    ],
    ctaRow: [
      { id: "open-dev-plus", label: "Open Dev Plus", href: "/control-plane.html", variant: "primary" },
      { id: "open-mobile-preview", label: "Open Mobile Preview", href: "/mobile/", variant: "ghost" },
      { id: "open-ops", label: "Open Mobile Ops Hub", href: "/mobile-ops.html", variant: "ghost" },
      { id: "open-infra", label: "Open Mobile Infrastructure", href: "/mobile-infrastructure.html", variant: "ghost" },
    ],
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${hero}

      <section class="grid layout-grid">
        <article class="card">
          <h2>Mobile Probe Sandbox</h2>
          <p>Use this page for ad-hoc API checks and payload drafting before mobile-impacting commands.</p>
          <ul class="list">
            <li>Draft command arguments and reason text</li>
            <li>Validate expected response shape for mobile dashboards</li>
            <li>Capture temporary notes during mobile incidents</li>
          </ul>
        </article>

        <article class="card">
          <h2>Mobile Command Hygiene</h2>
          <p>Before execution, always follow this baseline flow:</p>
          <ul class="list">
            <li>Validate session and role</li>
            <li>Prepare command and inspect mobile-impact preview</li>
            <li>Confirm with explicit text and token</li>
          </ul>
        </article>

        <article class="card layout-span-2">
          <h2>Mobile Monitoring Links</h2>
          <div class="cta-row">
            <a class="button ghost" href="/control-plane.html">Dev Plus Console</a>
            <a class="button ghost" href="/mobile/">Mobile Preview</a>
            <a class="button ghost" href="/mobile-runtime.html">Mobile Runtime</a>
            <a class="button ghost" href="/mobile-audit.html">Mobile Audit</a>
            <a class="button ghost" href="/privacy.html">Privacy</a>
          </div>
        </article>
      </section>
    </main>
  `;
};

void start();
