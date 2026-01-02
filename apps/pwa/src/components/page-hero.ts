export type PageShortcut = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  variant?: "primary" | "ghost";
  kind?: "link" | "button";
  dataAction?: string;
};

export type Breadcrumb = {
  label: string;
  href?: string;
};

export type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  currentPage: PageShortcut["id"];
  breadcrumbs?: Breadcrumb[];
  quickActions?: PageShortcut[];
  ctaRow?: PageShortcut[];
  backHref?: string;
  backLabel?: string;
};

export const sharedShortcuts: PageShortcut[] = [
  { id: "home", label: "Home", href: "/", icon: "🏠" },
  { id: "game", label: "Hub", href: "/game.html", icon: "🎮" },
  { id: "map", label: "Mappa", href: "/map.html", icon: "🗺️" },
  { id: "turns", label: "Turni", href: "/turns.html", icon: "📒" },
  { id: "events", label: "Eventi", href: "/events.html", icon: "🎟️" },
  { id: "profile", label: "Profilo", href: "/profile.html", icon: "👤" },
  { id: "avatar", label: "Avatar", href: "/avatar.html", icon: "🧩" },
];

function renderBreadcrumbs(items: Breadcrumb[] = []) {
  if (!items.length) return "";
  const lastIndex = items.length - 1;
  return `
    <nav aria-label="Percorso" class="breadcrumbs">
      <ol>
        ${items
          .map((crumb, index) => {
            const isCurrent = index === lastIndex;
            if (crumb.href && !isCurrent) {
              return `<li><a href="${crumb.href}">${crumb.label}</a></li>`;
            }
            return `<li aria-current="page">${crumb.label}</li>`;
          })
          .join('<li class="breadcrumb-separator">/</li>')}
      </ol>
    </nav>
  `;
}

function renderShortcut(shortcut: PageShortcut, currentPage: string) {
  const isActive = shortcut.id === currentPage;
  const stateAttr = isActive ? "active" : "default";
  return `
    <a class="quick-link" href="${shortcut.href ?? "#"}" data-state="${stateAttr}">
      ${shortcut.icon ? `<span class="quick-icon" aria-hidden="true">${shortcut.icon}</span>` : ""}
      <span class="quick-label">${shortcut.label}</span>
    </a>
  `;
}

function renderQuickbar(currentPage: string, quickActions: PageShortcut[]) {
  if (!quickActions.length) return "";
  const uniqueActions = quickActions.filter(
    (action, index, list) => list.findIndex((item) => item.id === action.id) === index
  );
  const shortcuts = uniqueActions.map((action) => renderShortcut(action, currentPage)).join("");
  return `
    <div class="quickbar" role="navigation" aria-label="Scorciatoie">
      <span class="quickbar-label">Navigazione rapida</span>
      <div class="quickbar-actions">
        ${shortcuts}
      </div>
    </div>
  `;
}

function renderCtaRow(ctaRow: PageShortcut[] = []) {
  if (!ctaRow.length) return "";
  const buttons = ctaRow
    .map((cta) => {
      const variant = cta.variant ?? "ghost";
      if (cta.kind === "button") {
        return `<button class="button ${variant}" type="button"${cta.dataAction ? ` data-action="${cta.dataAction}"` : ""}>
          ${cta.icon ? `<span aria-hidden="true">${cta.icon}</span>` : ""}${cta.label}
        </button>`;
      }
      return `<a class="button ${variant}" href="${cta.href ?? "#"}">
        ${cta.icon ? `<span aria-hidden="true">${cta.icon}</span>` : ""}${cta.label}
      </a>`;
    })
    .join("");
  return `<div class="cta-row">${buttons}</div>`;
}

export function renderPageHero({
  eyebrow = "Turni di Palco",
  title,
  description,
  currentPage,
  breadcrumbs = [],
  quickActions = [],
  ctaRow = [],
  backHref,
  backLabel = "Indietro",
}: PageHeroProps) {
  const quickbar = renderQuickbar(currentPage, [...sharedShortcuts, ...quickActions]);
  const ctas = renderCtaRow(ctaRow);
  const backLink = backHref
    ? `<a class="back-link" href="${backHref}" data-back>
        <span aria-hidden="true">←</span>
        <span>${backLabel}</span>
      </a>`
    : "";

  return `
    <header class="hero layout-stack page-hero">
      <div class="page-hero-header">
        <div class="page-hero-brand">
          <span class="brand-mark">TdP</span>
          <div class="page-hero-meta">
            <div class="page-hero-topline">
              ${backLink}
              <p class="eyebrow">${eyebrow}</p>
            </div>
            <div class="page-hero-title-row">
              <h1>${title}</h1>
              ${renderBreadcrumbs(breadcrumbs)}
            </div>
            ${description ? `<p class="lede">${description}</p>` : ""}
          </div>
        </div>
      </div>
      ${ctas}
      ${quickbar}
    </header>
  `;
}
