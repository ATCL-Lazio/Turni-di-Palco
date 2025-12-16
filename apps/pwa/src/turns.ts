import "./styles/tokens.css";
import "./style.css";
import { formatRewards, loadState, resolveRole } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page page-game layout-shell">
    <header class="hero layout-stack">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Registro turni</h1>
      <p class="lede">Ultimi turni registrati dal prototipo.</p>
      <div class="cta-row">
        <a class="button ghost" href="/">Landing</a>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/map.html">Mappa</a>
        <a class="button ghost" href="/profile.html">Profilo</a>
        <a class="button ghost" href="/events.html">Eventi</a>
      </div>
    </header>

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
