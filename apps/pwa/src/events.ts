import "../../../shared/styles/main.css";
import { mockEvents, resolveRole } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page page-game layout-shell">
    <header class="hero layout-stack">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Eventi mock</h1>
      <p class="lede">Usati per testare la registrazione turni e la mappa.</p>
      <div class="cta-row">
        <a class="button ghost" href="/">Landing</a>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/map.html">Mappa</a>
        <a class="button ghost" href="/profile.html">Profilo</a>
        <a class="button ghost" href="/turns.html">Turni</a>
      </div>
    </header>

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
