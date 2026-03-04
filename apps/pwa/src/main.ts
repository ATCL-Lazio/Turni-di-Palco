import "../../../shared/styles/main.css";
import { appConfig, getConfigWarnings, type FeatureFlag } from "./services/app-config";
import { buildControlPlaneUrl } from "./services/ops-sdk";
import { enforceDesktopOnly } from "./utils/desktop-only";

type MainAction = {
  id: "commands" | "render" | "audit";
  label: string;
};

const MAIN_ACTIONS: MainAction[] = [
  {
    id: "commands",
    label: "Apri comandi",
  },
  {
    id: "render",
    label: "Controlla rilasci",
  },
  {
    id: "audit",
    label: "Apri registro operazioni",
  },
];

function renderActions() {
  return MAIN_ACTIONS.map((action) => {
    const href = buildControlPlaneUrl({ view: action.id, source: "home-dashboard" });
    return `
      <li class="tdp-action-item">
        <a class="tdp-btn tdp-btn-primary" href="${href}">${action.label}</a>
      </li>
    `;
  }).join("");
}

function renderFeatureFlags() {
  return (Object.entries(appConfig.featureFlags) as [FeatureFlag, boolean][])
    .map(
      ([key, enabled]) =>
        `<li>
          <div class="tdp-flag-meta">
            <strong>${key}</strong>
          </div>
          <span class="${enabled ? "tdp-flag-on" : "tdp-flag-off"}">${enabled ? "ON" : "OFF"}</span>
        </li>`
    )
    .join("");
}

const start = () => {
  if (enforceDesktopOnly()) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) throw new Error("Root container missing");

  const configWarnings = getConfigWarnings();
  const showMainActions = appConfig.featureFlags["home.main-actions"];
  const showPwaFlags = appConfig.featureFlags["home.pwa-flags"];

  root.innerHTML = `
    <main class="tdp-shell">
      <header class="tdp-hero">
        <p class="tdp-kicker">Turni di Palco</p>
        <h1>Dashboard PWA</h1>
        <div class="tdp-hero-actions">
          <a class="tdp-btn tdp-btn-primary" href="/mobile/">Apri app mobile</a>
          <a class="tdp-btn tdp-btn-ghost" href="/control-plane.html?view=commands&source=home-hero">Apri dashboard comandi</a>
          <a class="tdp-btn tdp-btn-ghost" href="/privacy.html">Privacy</a>
        </div>
      </header>

      <section class="tdp-grid">
        ${showMainActions ? `
        <article class="tdp-card tdp-span-2">
          <h2>Azioni principali</h2>
          <ul class="tdp-action-list">
            ${renderActions()}
          </ul>
        </article>
        ` : ""}

        ${showPwaFlags ? `
        <article class="tdp-card">
          <h2>Feature flags PWA</h2>
          <ul class="tdp-simple-list">
            ${renderFeatureFlags()}
          </ul>
        </article>
        ` : ""}

        <article class="tdp-card">
          <h2>Stato sistema</h2>
          <ul class="tdp-simple-list">
            <li><strong>Ambiente</strong><span>${appConfig.environment}</span></li>
            <li><strong>Supabase</strong><span>${appConfig.supabase.configured ? "OK" : "MANCANTE"}</span></li>
            <li><strong>Control plane</strong><span>${appConfig.controlPlane.baseUrl || "path locale"}</span></li>
          </ul>
          ${configWarnings.length ? `<p class="tdp-warning">${configWarnings.join(" | ")}</p>` : ""}
        </article>
      </section>
    </main>
  `;
};

start();
