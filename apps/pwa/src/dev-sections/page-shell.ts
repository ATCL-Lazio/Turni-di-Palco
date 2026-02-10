import "../../../../shared/styles/main.css";
import { renderPageHero, type PageShortcut } from "../components/page-hero";
import { registerServiceWorker } from "../pwa/register-sw";
import { promptServiceWorkerUpdate } from "../pwa/sw-update";
import { requireDevAccess } from "../services/dev-gate";
import { enforceDesktopOnly } from "../utils/desktop-only";

export type DevSectionCard = {
  title: string;
  description: string;
  bullets?: string[];
  pills?: string[];
  links?: Array<{ label: string; href: string }>;
  spanTwoColumns?: boolean;
};

export type DevSectionPageConfig = {
  currentPage: PageShortcut["id"];
  title: string;
  description: string;
  eyebrow?: string;
  ctaRow?: PageShortcut[];
  quickActions?: PageShortcut[];
  cards: DevSectionCard[];
};

function renderCard(card: DevSectionCard) {
  const bullets = card.bullets?.length
    ? `<ul class="list">${card.bullets.map((item) => `<li>${item}</li>`).join("")}</ul>`
    : "";
  const pills = card.pills?.length
    ? `<div class="pill-row">${card.pills.map((item) => `<span class="pill ghost">${item}</span>`).join("")}</div>`
    : "";
  const links = card.links?.length
    ? `<div class="cta-row">${card.links
        .map((link) => `<a class="button ghost" href="${link.href}">${link.label}</a>`)
        .join("")}</div>`
    : "";

  return `
    <article class="card${card.spanTwoColumns ? " layout-span-2" : ""}">
      <h2>${card.title}</h2>
      <p>${card.description}</p>
      ${bullets}
      ${pills}
      ${links}
    </article>
  `;
}

export async function renderDevSectionPage(config: DevSectionPageConfig) {
  if (enforceDesktopOnly()) return;
  if (!(await requireDevAccess())) return;

  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) {
    throw new Error("Root container missing");
  }

  const defaultCtas: PageShortcut[] = [
    { id: "open-dev-plus", label: "Open Dev Plus", href: "/dev-plus.html", variant: "primary" },
    { id: "open-mobile-preview", label: "Open Mobile Preview", href: "/mobile/", variant: "ghost" },
    { id: "open-overview", label: "Open Mobile Ops Hub", href: "/game.html", variant: "ghost" },
    { id: "back-home", label: "Back To Home", href: "/", variant: "ghost" },
  ];

  const hero = renderPageHero({
    eyebrow: config.eyebrow || "Turni Di Palco",
    title: config.title,
    description: config.description,
    currentPage: config.currentPage,
    breadcrumbs: [
      { label: "Home", href: "/" },
      { label: config.title },
    ],
    backHref: "/",
    backLabel: "Back To Landing",
    quickActions: config.quickActions || [],
    ctaRow: config.ctaRow || defaultCtas,
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${hero}

      <section class="grid layout-grid">
        ${config.cards.map((card) => renderCard(card)).join("")}
      </section>
    </main>
  `;

  registerServiceWorker({
    onReady: () => undefined,
    onUpdate: (registration) => {
      promptServiceWorkerUpdate(registration);
    },
    onError: (error) => {
      console.error("Service worker registration failed", error);
    },
  });
}
