import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { mockEvents, resolveRole } from "./state";
import { requireDevAccess } from "./services/dev-gate";

const start = async () => {
  if (!(await requireDevAccess())) return;


  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const pageHero = renderPageHero({
    title: "Eventi mock",
    description: "Usati per testare la registrazione turni e la mappa.",
    currentPage: "events",
    breadcrumbs: [
      { label: "Hub", href: "/game.html" },
      { label: "Eventi" },
    ],
    backHref: "/game.html",
    backLabel: "Torna all'hub",
  });

  root.innerHTML = `
    <main class="page page-game layout-shell">
      ${pageHero}

      <section class="grid layout-grid">
        <article class="card layout-span-2">
          <h2>Prossimi eventi</h2>
          <p class="muted">Schede ATCL con focus ruolo e ricompense principali.</p>
          <ul class="event-grid" data-event-list></ul>
        </article>
      </section>
    </main>
  `;

  const eventList = root.querySelector<HTMLElement>('[data-event-list]');

  if (eventList) {
    if (!mockEvents.length) {
      eventList.innerHTML = `<li class="muted">Nessun evento disponibile.</li>`;
    } else {
      eventList.innerHTML = mockEvents
        .map((item) => {
          const focusRole = item.focusRole ? resolveRole(item.focusRole) : null;
          return `
            <li>
              <article class="event-card static">
                <div class="event-card__header">
                  <div>
                    <strong>${item.name}</strong>
                    <p class="muted tiny">${item.theatre} • ${item.date}</p>
                  </div>
                  <span class="focus-pill ghost">${focusRole ? focusRole.name : "Multi-ruolo"}</span>
                </div>
                <div class="event-card__meta">
                  <span class="pill ghost">Lat ${item.lat.toFixed(3)} / Lng ${item.lng.toFixed(3)}</span>
                  <span class="pill ghost">Cachet +${item.baseRewards.cachet}</span>
                </div>
                <div class="event-card__badges">
                  <span class="glass-badge xp"><span aria-hidden="true">⚡</span> +${item.baseRewards.xp} XP</span>
                  <span class="glass-badge rep"><span aria-hidden="true">★</span> +${item.baseRewards.reputation} Rep</span>
                </div>
              </article>
            </li>
          `;
        })
        .join("");
    }
  }
};

void start();
