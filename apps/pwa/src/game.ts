import "../../../shared/styles/main.css";
import { registerServiceWorker } from "./pwa/register-sw";
import { formatRewards, getAvatarVisual, loadState, resolveRole } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

const state = loadState();
const role = resolveRole(state.profile.roleId);
const avatarVisual = getAvatarVisual(state.profile.avatar);

root.innerHTML = `
  <main class="page page-game layout-shell">
    <header class="hero layout-stack">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Hub di navigazione</h1>
      <p class="lede">Accedi a mappa, profilo, eventi e registro turni.</p>
      <div class="cta-row">
        <a class="button primary" href="/map.html">Apri mappa</a>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/profile.html">Profilo</a>
        <a class="button ghost" href="/events.html">Eventi</a>
        <a class="button ghost" href="/turns.html">Turni</a>
        <a class="button ghost" href="/">Landing</a>
      </div>
    </header>

    <section class="grid layout-grid">
      <article class="card">
        <h2>Profilo</h2>
        <div class="profile-pane">
          <div class="avatar-display large ${avatarVisual.image ? "has-image" : ""}" data-avatar="profile" style="--avatar-color:${avatarVisual.color};--avatar-hue:${state.profile.avatar.hue}deg;">
            ${avatarVisual.image ? `<img src="${avatarVisual.image}" alt="Avatar ReadyPlayerMe" />` : ""}
            <span class="avatar-icon">${avatarVisual.icon}</span>
          </div>
          <div>
            <p class="eyebrow">${state.profile.name || "Profilo non configurato"}</p>
            <p class="muted">${role.name} | Focus: ${role.focus}</p>
            <div class="pill-row">${role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("")}</div>
          </div>
        </div>
      </article>

      <article class="card">
        <h2>Statistiche</h2>
        <ul class="stat-list">
          <li><span>XP</span><strong>${state.profile.xp}</strong></li>
          <li><span>Cachet</span><strong>${state.profile.cachet}</strong></li>
          <li><span>Reputazione ATCL</span><strong>${state.profile.repAtcl}</strong></li>
        </ul>
      </article>

      <article class="card layout-span-2">
        <h2>Ultimi turni</h2>
        <ul class="log-list dense" data-turn-log></ul>
      </article>
    </section>
  </main>
`;

const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');
if (turnLog) {
  if (!state.turns.length) {
    turnLog.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
  } else {
    turnLog.innerHTML = state.turns
      .slice(0, 6)
      .map(
        (turn) =>
          `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
      )
      .join("");
  }
}

registerServiceWorker({
  onReady: () => undefined,
  onUpdate: () => undefined,
  onError: () => undefined,
});
