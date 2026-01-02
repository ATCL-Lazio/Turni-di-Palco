import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { formatRewards, loadState, resolveRole } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

const pageHero = renderPageHero({
  title: "Registro turni",
  description: "Ultimi turni registrati dal prototipo.",
  currentPage: "turns",
  breadcrumbs: [
    { label: "Hub", href: "/game.html" },
    { label: "Turni" },
  ],
  backHref: "/game.html",
  backLabel: "Torna all'hub",
});

root.innerHTML = `
  <main class="page page-game layout-shell">
    ${pageHero}

    <section class="grid layout-grid">
      <article class="card layout-span-2">
        <h2>Turni</h2>
        <ul class="log-list dense" data-turn-list></ul>
      </article>
    </section>
  </main>
`;

const turnList = root.querySelector<HTMLElement>('[data-turn-list]');
const state = loadState();

if (turnList) {
  if (!state.turns.length) {
    turnList.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
  } else {
    turnList.innerHTML = state.turns
      .map(
        (turn) =>
          `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
      )
      .join("");
  }
}
