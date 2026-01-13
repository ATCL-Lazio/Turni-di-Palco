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
          <ul class="log-list dense" data-event-list></ul>
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
        .map(
          (item) =>
            `<li><div><strong>${item.name}</strong> - ${item.theatre}</div><div class="muted">${item.date} | Focus: ${item.focusRole ? resolveRole(item.focusRole).name : "Any"} - Lat ${item.lat.toFixed(3)} / Lng ${item.lng.toFixed(3)}</div></li>`
        )
        .join("");
    }
  }
};

void start();
