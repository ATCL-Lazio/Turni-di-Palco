import "./styles/tokens.css";
import "./style.css";
import { formatRewards, getAvatarVisual, loadState, resolveRole } from "./state";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Root container missing");
}

root.innerHTML = `
  <main class="page page-game">
    <header class="hero">
      <p class="eyebrow">Turni di Palco</p>
      <h1>Profilo</h1>
      <p class="lede">Stato giocatore, avatar e riepilogo recente.</p>
      <div class="cta-row">
        <a class="button ghost" href="/">Landing</a>
        <a class="button ghost" href="/avatar.html">Avatar</a>
        <a class="button ghost" href="/map.html">Mappa</a>
        <a class="button ghost" href="/events.html">Eventi</a>
        <a class="button ghost" href="/turns.html">Turni</a>
      </div>
    </header>

    <section class="grid">
      <article class="card span-2">
        <h2>Stato giocatore</h2>
        <div class="profile-pane">
          <div class="avatar-display large" data-avatar="profile">
            <img data-avatar-img alt="Avatar ReadyPlayerMe" />
            <span class="avatar-icon" data-avatar-label></span>
          </div>
          <div>
            <p class="eyebrow">Profilo</p>
            <h3 data-player-name>Profilo non configurato</h3>
            <p class="muted" data-player-role>Ruolo non impostato</p>
            <div class="pill-row" data-role-tags></div>
          </div>
        </div>
        <div class="stat-board">
          <div class="stat-chip"><span>XP</span><strong data-stat="xp">0</strong></div>
          <div class="stat-chip"><span>Cachet</span><strong data-stat="cachet">0</strong></div>
          <div class="stat-chip"><span>Rep</span><strong data-stat="rep">0</strong></div>
        </div>
      </article>

      <article class="card">
        <h2>Ultimi turni</h2>
        <ul class="log-list" data-turn-log></ul>
      </article>
    </section>
  </main>
`;

const avatarDisplay = root.querySelector<HTMLElement>('[data-avatar="profile"]');
const avatarLabel = root.querySelector<HTMLElement>('[data-avatar-label]');
const avatarImg = root.querySelector<HTMLImageElement>('[data-avatar-img]');
const nameNode = root.querySelector<HTMLElement>("[data-player-name]");
const roleNode = root.querySelector<HTMLElement>("[data-player-role]");
const roleTags = root.querySelector<HTMLElement>("[data-role-tags]");
const statXp = root.querySelector<HTMLElement>('[data-stat="xp"]');
const statCachet = root.querySelector<HTMLElement>('[data-stat="cachet"]');
const statRep = root.querySelector<HTMLElement>('[data-stat="rep"]');
const turnLog = root.querySelector<HTMLElement>('[data-turn-log]');

const state = loadState();
const avatarVisual = getAvatarVisual(state.profile.avatar);
if (avatarDisplay) {
  avatarDisplay.style.setProperty("--avatar-color", avatarVisual.color);
  avatarDisplay.style.setProperty("--avatar-hue", `${state.profile.avatar.hue}deg`);
  avatarDisplay.classList.toggle("has-image", !!avatarVisual.image);
}
if (avatarImg) {
  if (avatarVisual.image) {
    avatarImg.src = avatarVisual.image;
    avatarImg.style.display = "block";
  } else {
    avatarImg.removeAttribute("src");
    avatarImg.style.display = "none";
  }
}
if (avatarLabel) {
  avatarLabel.textContent = avatarVisual.icon;
}

if (nameNode) {
  nameNode.textContent = state.profile.name || "Profilo non configurato";
}
const role = resolveRole(state.profile.roleId);
if (roleNode) {
  roleNode.textContent = `${role.name} - Focus: ${role.focus}`;
}
if (roleTags) {
  roleTags.innerHTML = role.stats.map((stat) => `<span class="pill ghost">${stat}</span>`).join("");
}
if (statXp) statXp.textContent = state.profile.xp.toString();
if (statCachet) statCachet.textContent = state.profile.cachet.toString();
if (statRep) statRep.textContent = state.profile.repAtcl.toString();

if (turnLog) {
  if (!state.turns.length) {
    turnLog.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
  } else {
    turnLog.innerHTML = state.turns
      .slice(0, 8)
      .map(
        (turn) =>
          `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
      )
      .join("");
  }
}
