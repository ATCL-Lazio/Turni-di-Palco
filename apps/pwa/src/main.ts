import "../../../shared/styles/main.css";
import {
  appConfig,
  getConfigWarnings,
  getFeatureFlagDescription,
  listFeatureFlagKeys,
  setStoredFeatureFlagOverride,
  type FeatureFlag,
} from "./services/app-config";
import { buildControlPlaneUrl, type ControlPlaneView } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

// ─── Types ───────────────────────────────────────────────────────────────────

type NavItem = {
  id: ControlPlaneView | "home";
  label: string;
  icon: string;
  view?: ControlPlaneView;
};

type StatusState = "ok" | "error" | "unknown";

type ServiceStatus = {
  name: string;
  status: StatusState;
  detail: string;
};

// ─── Nav config ──────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
  { id: "commands", label: "Comandi", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`, view: "commands" },
  { id: "render", label: "Rilasci", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`, view: "render" },
  { id: "audit", label: "Audit log", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`, view: "audit" },
  { id: "db", label: "Database", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`, view: "db" },
  { id: "mobile-flags", label: "Feature Flags", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`, view: "mobile-flags" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildNavUrl(item: NavItem): string {
  if (item.id === "home") return "/";
  return buildControlPlaneUrl({ view: item.view, source: "dev-dashboard-nav" });
}

function resolveServiceStatuses(): ServiceStatus[] {
  return [
    {
      name: "Supabase",
      status: appConfig.supabase.configured ? "ok" : "error",
      detail: appConfig.supabase.configured
        ? appConfig.supabase.url ?? "URL non disponibile"
        : "Variabili d'ambiente mancanti",
    },
    {
      name: "Control Plane",
      status: appConfig.controlPlane.baseUrl ? "ok" : "unknown",
      detail: appConfig.controlPlane.baseUrl || "path locale (relativo)",
    },
    {
      name: "Ambiente",
      status: "ok",
      detail: appConfig.environment,
    },
    {
      name: "Dev Gate",
      status: appConfig.devGate.allowedRoles.length || appConfig.devGate.allowedEmails.length ? "ok" : "error",
      detail:
        appConfig.devGate.allowedRoles.length || appConfig.devGate.allowedEmails.length
          ? `Ruoli: ${appConfig.devGate.allowedRoles.join(", ") || "—"}`
          : "Nessun ruolo o email configurata",
    },
  ];
}

function statusDot(status: StatusState): string {
  const classes: Record<StatusState, string> = {
    ok: "dev-status-dot dev-status-dot--ok",
    error: "dev-status-dot dev-status-dot--error",
    unknown: "dev-status-dot dev-status-dot--unknown",
  };
  return `<span class="${classes[status]}" aria-label="${status}"></span>`;
}

function statusLabel(status: StatusState): string {
  const labels: Record<StatusState, string> = { ok: "OK", error: "Errore", unknown: "N/D" };
  return labels[status];
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderSidebar(activeId = "home"): string {
  const navLinks = NAV_ITEMS.map((item) => {
    const isActive = item.id === activeId;
    const href = buildNavUrl(item);
    return `
      <a href="${href}" class="dev-nav-item${isActive ? " dev-nav-item--active" : ""}" data-nav-id="${item.id}">
        <span class="dev-nav-icon">${item.icon}</span>
        <span class="dev-nav-label">${item.label}</span>
      </a>
    `;
  }).join("");

  const envBadge = appConfig.isProd
    ? `<span class="dev-env-badge dev-env-badge--prod">PROD</span>`
    : `<span class="dev-env-badge dev-env-badge--dev">DEV</span>`;

  return `
    <aside class="dev-sidebar">
      <div class="dev-sidebar-header">
        <div class="dev-logo">
          <span class="dev-logo-mark">T</span>
          <div class="dev-logo-text">
            <span class="dev-logo-name">Turni di Palco</span>
            <span class="dev-logo-sub">Developer Dashboard</span>
          </div>
        </div>
        ${envBadge}
      </div>

      <nav class="dev-nav" aria-label="Navigazione principale">
        ${navLinks}
      </nav>

      <div class="dev-sidebar-footer">
        <a href="/mobile/" class="dev-sidebar-link" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          Apri app mobile
        </a>
        <a href="/privacy.html" class="dev-sidebar-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Privacy
        </a>
      </div>
    </aside>
  `;
}

function renderTopbar(): string {
  const now = new Date().toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const warnings = getConfigWarnings();
  const warningBadge =
    warnings.length > 0
      ? `<span class="dev-topbar-badge dev-topbar-badge--warn" title="${warnings.join("\n")}">${warnings.length} avviso${warnings.length > 1 ? "i" : ""}</span>`
      : `<span class="dev-topbar-badge dev-topbar-badge--ok">Sistema OK</span>`;

  return `
    <header class="dev-topbar">
      <div class="dev-topbar-left">
        <h1 class="dev-topbar-title">Overview</h1>
      </div>
      <div class="dev-topbar-right">
        ${warningBadge}
        <span class="dev-topbar-time">${now}</span>
      </div>
    </header>
  `;
}

function renderStatusCard(): string {
  const statuses = resolveServiceStatuses();
  const rows = statuses
    .map(
      (s) => `
      <div class="dev-status-row">
        <div class="dev-status-row-left">
          ${statusDot(s.status)}
          <span class="dev-status-name">${s.name}</span>
        </div>
        <div class="dev-status-row-right">
          <code class="dev-status-detail">${s.detail}</code>
          <span class="dev-status-label dev-status-label--${s.status}">${statusLabel(s.status)}</span>
        </div>
      </div>
    `
    )
    .join("");

  return `
    <section class="dev-card dev-card--status">
      <div class="dev-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <h2 class="dev-card-title">Stato servizi</h2>
      </div>
      <div class="dev-status-list">
        ${rows}
      </div>
    </section>
  `;
}

function renderQuickActionsCard(): string {
  type QuickLink = { label: string; view: ControlPlaneView; description: string; icon: string };
  const links: QuickLink[] = [
    {
      label: "Comandi",
      view: "commands",
      description: "Esegui operazioni sui servizi",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    },
    {
      label: "Rilasci",
      view: "render",
      description: "Controlla e gestisci i deploy",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    },
    {
      label: "Audit log",
      view: "audit",
      description: "Registro delle operazioni recenti",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    },
    {
      label: "Database",
      view: "db",
      description: "Operazioni e panoramica DB",
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    },
  ];

  const cards = links
    .map(
      (link) => `
      <a href="${buildControlPlaneUrl({ view: link.view, source: "dev-dashboard-quick" })}" class="dev-quick-card">
        <span class="dev-quick-icon">${link.icon}</span>
        <div class="dev-quick-body">
          <span class="dev-quick-label">${link.label}</span>
          <span class="dev-quick-desc">${link.description}</span>
        </div>
        <svg class="dev-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
      </a>
    `
    )
    .join("");

  return `
    <section class="dev-card">
      <div class="dev-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <h2 class="dev-card-title">Accesso rapido</h2>
      </div>
      <div class="dev-quick-grid">
        ${cards}
      </div>
    </section>
  `;
}

function renderFeatureFlagsCard(): string {
  const flags = listFeatureFlagKeys();
  const rows = flags
    .map((flag) => {
      const enabled = appConfig.featureFlags[flag];
      const description = getFeatureFlagDescription(flag);
      return `
        <div class="dev-flag-row" data-flag="${flag}">
          <div class="dev-flag-info">
            <code class="dev-flag-key">${flag}</code>
            <span class="dev-flag-desc">${description}</span>
          </div>
          <button
            class="dev-toggle${enabled ? " dev-toggle--on" : ""}"
            aria-label="Toggle ${flag}"
            aria-checked="${enabled}"
            role="switch"
            data-flag-toggle="${flag}"
          >
            <span class="dev-toggle-thumb"></span>
          </button>
        </div>
      `;
    })
    .join("");

  return `
    <section class="dev-card dev-card--flags">
      <div class="dev-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        <h2 class="dev-card-title">Feature Flags PWA</h2>
        <span class="dev-card-badge">${flags.length}</span>
      </div>
      <div class="dev-flag-list">
        ${rows}
      </div>
    </section>
  `;
}

function renderConfigCard(): string {
  const warnings = getConfigWarnings();

  const items: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Modalità", value: appConfig.isProd ? "Produzione" : "Sviluppo" },
    { label: "Accesso pubblico", value: appConfig.publicMode ? "Sì" : "No" },
    { label: "SW dev mode", value: appConfig.serviceWorker.devMode },
    { label: "Session TTL", value: `${Math.round(appConfig.devGate.sessionCacheTtlMs / 60000)} min` },
    {
      label: "Supabase URL",
      value: appConfig.supabase.url ? appConfig.supabase.url.replace("https://", "").split(".")[0] + ".supabase.co" : "—",
      mono: true,
    },
    {
      label: "Dev function",
      value: appConfig.devGate.serverAccessFunction,
      mono: true,
    },
  ];

  const rows = items
    .map(
      (item) => `
      <div class="dev-config-row">
        <span class="dev-config-label">${item.label}</span>
        ${item.mono ? `<code class="dev-config-value">${item.value}</code>` : `<span class="dev-config-value">${item.value}</span>`}
      </div>
    `
    )
    .join("");

  const warningBlock =
    warnings.length > 0
      ? `<div class="dev-config-warnings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <ul class="dev-config-warning-list">
            ${warnings.map((w) => `<li>${w}</li>`).join("")}
          </ul>
        </div>`
      : "";

  return `
    <section class="dev-card">
      <div class="dev-card-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        <h2 class="dev-card-title">Configurazione</h2>
      </div>
      <div class="dev-config-list">
        ${rows}
      </div>
      ${warningBlock}
    </section>
  `;
}

// ─── Main layout ─────────────────────────────────────────────────────────────

function renderDashboard(): string {
  return `
    <div class="dev-layout">
      ${renderSidebar("home")}
      <div class="dev-main">
        ${renderTopbar()}
        <div class="dev-content">
          <div class="dev-grid">
            ${renderStatusCard()}
            ${renderConfigCard()}
            ${renderQuickActionsCard()}
            ${renderFeatureFlagsCard()}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── Interactivity ───────────────────────────────────────────────────────────

function attachFlagToggles(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>("[data-flag-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const flag = btn.dataset.flagToggle as FeatureFlag;
      const isCurrentlyOn = btn.classList.contains("dev-toggle--on");
      const next = !isCurrentlyOn;

      setStoredFeatureFlagOverride(flag, next);

      btn.classList.toggle("dev-toggle--on", next);
      btn.setAttribute("aria-checked", String(next));

      // Visual feedback
      const row = btn.closest<HTMLElement>(".dev-flag-row");
      if (row) {
        row.classList.add("dev-flag-row--flash");
        setTimeout(() => row.classList.remove("dev-flag-row--flash"), 400);
      }
    });
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

const start = () => {
  if (enforceDesktopOnly()) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Root container missing");

  root.innerHTML = renderDashboard();
  attachFlagToggles(root);
};

start();
