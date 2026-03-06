import "../../../shared/styles/main.css";
import {
  appConfig,
  getConfigWarnings,
  getFeatureFlagDescription,
  listFeatureFlagKeys,
  setStoredFeatureFlagOverride,
  type FeatureFlag,
} from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";
import { registerServiceWorker } from "./pwa/register-sw";
import { promptServiceWorkerUpdate } from "./pwa/sw-update";

// ─── Icone ───────────────────────────────────────────────────────────────────

const I = {
  grid:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  terminal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  upload:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  log:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  db:       `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  flag:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  clock:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  phone:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  shield:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  warn:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function cp(preset: Parameters<typeof buildControlPlaneUrl>[0]) {
  return buildControlPlaneUrl({ ...preset, source: "dev-dashboard" });
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function sidebar(): string {
  const nav = [
    { icon: I.grid,     label: "Overview",     href: "/",                          active: true },
    { icon: I.terminal, label: "Comandi",       href: cp({ view: "commands" }) },
    { icon: I.upload,   label: "Rilasci",       href: cp({ view: "render" }) },
    { icon: I.log,      label: "Audit log",     href: cp({ view: "audit" }) },
    { icon: I.db,       label: "Database",      href: cp({ view: "db" }) },
    { icon: I.flag,     label: "Feature flags", href: cp({ view: "mobile-flags" }) },
  ];

  const envBadge = appConfig.isProd
    ? `<span class="badge badge--danger">PROD</span>`
    : `<span class="badge badge--accent">DEV</span>`;

  return `
    <aside class="dev-sidebar">
      <div class="dev-sidebar-header">
        <div class="dev-logo">
          <span class="dev-logo-mark">T</span>
          <div>
            <p class="dev-logo-name">Turni di Palco</p>
            <p class="dev-logo-sub">Developer Dashboard</p>
          </div>
        </div>
        ${envBadge}
      </div>

      <nav class="dev-nav" aria-label="Navigazione">
        ${nav.map(({ icon, label, href, active }) => `
          <a href="${href}" class="dev-nav-link${active ? " dev-nav-link--active" : ""}">
            ${icon}<span>${label}</span>
          </a>
        `).join("")}
      </nav>

      <div class="dev-sidebar-footer">
        <a href="/mobile/" class="dev-sidebar-link" target="_blank">${I.phone} App mobile</a>
        <a href="/privacy.html" class="dev-sidebar-link">${I.shield} Privacy</a>
      </div>
    </aside>
  `;
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function topbar(): string {
  const warnings = getConfigWarnings();
  const time = new Date().toLocaleString("it-IT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const badge = warnings.length > 0
    ? `<span class="badge badge--warn" title="${warnings.join("\n")}">${warnings.length} avviso${warnings.length > 1 ? "i" : ""}</span>`
    : `<span class="badge badge--ok">Sistema OK</span>`;

  return `
    <header class="dev-topbar">
      <h1 class="dev-topbar-title">Overview</h1>
      <div class="dev-topbar-meta">
        ${badge}
        <time class="dev-topbar-time">${time}</time>
      </div>
    </header>
  `;
}

// ─── Status card ──────────────────────────────────────────────────────────────

function statusCard(): string {
  const rows: Array<{ name: string; detail: string; state: "ok" | "err" | "unknown"; id?: string }> = [
    {
      name: "Supabase",
      state: appConfig.supabase.configured ? "ok" : "err",
      detail: appConfig.supabase.configured ? "Configurato" : "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti",
    },
    {
      name: "Control Plane",
      state: appConfig.controlPlane.baseUrl ? "ok" : "unknown",
      detail: appConfig.controlPlane.baseUrl || "path relativo",
    },
    { name: "Service Worker", state: "unknown", detail: "in attesa...", id: "sw-status" },
    { name: "Connessione",   state: navigator.onLine ? "ok" : "err", detail: navigator.onLine ? "Online" : "Offline", id: "net-status" },
  ];

  return `
    <section class="dev-card">
      <div class="dev-card-head">${I.clock} <h2>Stato sistema</h2></div>
      <div class="svc-list">
        ${rows.map(({ name, detail, state, id }) => `
          <div class="svc-row">
            <div class="svc-row-left">
              <span class="dot dot--${state}" ${id ? `data-dot="${id}"` : ""}></span>
              <span class="svc-name">${name}</span>
            </div>
            <span class="svc-detail" ${id ? `data-detail="${id}"` : ""}>${detail}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

// ─── Feature flags ────────────────────────────────────────────────────────────

function flagsCard(): string {
  const flags = listFeatureFlagKeys();
  const warnings = getConfigWarnings();

  const warningBlock = warnings.length > 0 ? `
    <div class="warn-block">
      ${I.warn}
      <ul>${warnings.map((w) => `<li>${w}</li>`).join("")}</ul>
    </div>
  ` : "";

  return `
    <section class="dev-card dev-card--wide">
      <div class="dev-card-head">
        ${I.flag}
        <h2>Feature Flags</h2>
        <span class="badge badge--neutral">${flags.length}</span>
      </div>
      ${warningBlock}
      <div class="flag-list">
        ${flags.map((flag) => {
          const on = appConfig.featureFlags[flag];
          return `
            <div class="flag-row">
              <div class="flag-info">
                <code class="flag-key">${flag}</code>
                <span class="flag-desc">${getFeatureFlagDescription(flag)}</span>
              </div>
              <button
                class="toggle${on ? " toggle--on" : ""}"
                aria-label="Toggle ${flag}"
                aria-checked="${on}"
                role="switch"
                data-toggle="${flag}"
              ><span class="toggle-thumb"></span></button>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

function start() {
  if (enforceDesktopOnly()) return;

  const root = document.querySelector<HTMLDivElement>("#app")!;

  root.innerHTML = `
    <div class="dev-layout">
      ${sidebar()}
      <div class="dev-main">
        ${topbar()}
        <div class="dev-content">
          <div class="dev-grid">
            ${statusCard()}
            ${flagsCard()}
          </div>
        </div>
      </div>
    </div>
  `;

  // Feature flag toggles
  root.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const flag = btn.dataset.toggle as FeatureFlag;
      const next = !btn.classList.contains("toggle--on");
      setStoredFeatureFlagOverride(flag, next);
      btn.classList.toggle("toggle--on", next);
      btn.setAttribute("aria-checked", String(next));
      const row = btn.closest(".flag-row");
      row?.classList.add("flag-row--flash");
      setTimeout(() => row?.classList.remove("flag-row--flash"), 350);
    });
  });

  // Stato connessione live
  const updateNet = () => {
    const detail = root.querySelector<HTMLElement>('[data-detail="net-status"]');
    const dot = root.querySelector<HTMLElement>('[data-dot="net-status"]');
    if (detail) detail.textContent = navigator.onLine ? "Online" : "Offline";
    if (dot) dot.className = `dot dot--${navigator.onLine ? "ok" : "err"}`;
  };
  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  // Service Worker status live
  registerServiceWorker({
    onReady: () => {
      const detail = root.querySelector<HTMLElement>('[data-detail="sw-status"]');
      const dot = root.querySelector<HTMLElement>('[data-dot="sw-status"]');
      if (detail) detail.textContent = "Pronto (offline ok)";
      if (dot) dot.className = "dot dot--ok";
    },
    onUpdate: (reg) => {
      const detail = root.querySelector<HTMLElement>('[data-detail="sw-status"]');
      const dot = root.querySelector<HTMLElement>('[data-dot="sw-status"]');
      if (detail) detail.textContent = "Aggiornamento disponibile";
      if (dot) dot.className = "dot dot--warn";
      promptServiceWorkerUpdate(reg);
    },
    onError: () => {
      const detail = root.querySelector<HTMLElement>('[data-detail="sw-status"]');
      const dot = root.querySelector<HTMLElement>('[data-dot="sw-status"]');
      if (detail) detail.textContent = "Registrazione fallita";
      if (dot) dot.className = "dot dot--err";
    },
  });
}

start();
