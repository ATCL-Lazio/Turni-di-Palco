import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { formatRewards, loadState, resolveRole, roles, STORAGE_KEY } from "./state";

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
        <div class="toolbar">
          <div class="filter-row">
            <label class="field inline">
              <span>Ruolo</span>
              <select data-filter-role></select>
            </label>
            <label class="field inline">
              <span>Teatro</span>
              <select data-filter-venue></select>
            </label>
            <label class="field inline">
              <span>Ordina</span>
              <select data-filter-sort>
                <option value="desc">Dal piu recente</option>
                <option value="asc">Dal piu vecchio</option>
              </select>
            </label>
          </div>
        </div>
        <div class="stat-board">
          <div class="stat-chip"><span>Turni filtrati</span><strong data-total-count>0</strong></div>
          <div class="stat-chip"><span>XP filtrati</span><strong data-total-xp>0</strong></div>
          <div class="stat-chip"><span>Cachet filtrato</span><strong data-total-cachet>0</strong></div>
        </div>
        <div class="chart-grid">
          <div class="chart-card">
            <div class="chart-head">
              <div>
                <p class="eyebrow">XP</p>
                <p class="muted">Andamento cumulativo XP guadagnati</p>
              </div>
              <strong data-chart-total="xp">0 XP</strong>
            </div>
            <div class="sparkline" data-sparkline="xp"></div>
          </div>
          <div class="chart-card">
            <div class="chart-head">
              <div>
                <p class="eyebrow">Cachet</p>
                <p class="muted">Crescita cachet nel tempo</p>
              </div>
              <strong data-chart-total="cachet">0</strong>
            </div>
            <div class="sparkline" data-sparkline="cachet"></div>
          </div>
        </div>
        <ul class="log-list dense" data-turn-list></ul>
      </article>
    </section>
  </main>
`;

const turnList = root.querySelector<HTMLElement>('[data-turn-list]');
const syncBadge = root.querySelector<HTMLElement>('[data-sync-badge]');
const roleFilter = root.querySelector<HTMLSelectElement>('[data-filter-role]');
const venueFilter = root.querySelector<HTMLSelectElement>('[data-filter-venue]');
const sortFilter = root.querySelector<HTMLSelectElement>('[data-filter-sort]');
const totalCount = root.querySelector<HTMLElement>('[data-total-count]');
const totalXp = root.querySelector<HTMLElement>('[data-total-xp]');
const totalCachet = root.querySelector<HTMLElement>('[data-total-cachet]');
const sparklineXp = root.querySelector<HTMLElement>('[data-sparkline="xp"]');
const sparklineCachet = root.querySelector<HTMLElement>('[data-sparkline="cachet"]');
const chartTotalXp = root.querySelector<HTMLElement>('[data-chart-total="xp"]');
const chartTotalCachet = root.querySelector<HTMLElement>('[data-chart-total="cachet"]');
let state = loadState();
let syncBadgeTimeout: number | undefined;

function showSyncBadge(message = "Stato aggiornato") {
  if (!syncBadge) return;
  syncBadge.textContent = message;
  syncBadge.style.display = "inline-flex";
  if (syncBadgeTimeout) {
    window.clearTimeout(syncBadgeTimeout);
  }
  syncBadgeTimeout = window.setTimeout(() => {
    if (syncBadge) syncBadge.style.display = "none";
  }, 2500);
}

function safeDateValue(dateStr: string) {
  const parsed = Date.parse(dateStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function populateFilters() {
  const previousRole = roleFilter?.value ?? "all";
  const previousVenue = venueFilter?.value ?? "all";
  const previousSort = sortFilter?.value ?? "desc";

  if (roleFilter) {
    roleFilter.innerHTML = `<option value="all">Tutti i ruoli</option>${roles.map((role) => `<option value="${role.id}">${role.name}</option>`).join("")}`;
    roleFilter.value = Array.from(roleFilter.options).some((option) => option.value === previousRole) ? previousRole : "all";
  }

  if (venueFilter) {
    const venues = Array.from(new Set(state.turns.map((turn) => turn.theatre)));
    venueFilter.innerHTML = `<option value="all">Tutti i teatri</option>${venues.length ? venues.map((venue) => `<option value="${venue}">${venue}</option>`).join("") : ""}`;
    venueFilter.value = Array.from(venueFilter.options).some((option) => option.value === previousVenue) ? previousVenue : "all";
  }

  if (sortFilter) {
    sortFilter.value = Array.from(sortFilter.options).some((option) => option.value === previousSort) ? previousSort : "desc";
  }
}

function getFilteredTurns() {
  const roleValue = roleFilter?.value || "all";
  const venueValue = venueFilter?.value || "all";
  const sortOrder = sortFilter?.value || "desc";
  const turns = state.turns
    .filter((turn) => (roleValue === "all" ? true : turn.roleId === roleValue))
    .filter((turn) => (venueValue === "all" ? true : turn.theatre === venueValue))
    .sort((a, b) => (sortOrder === "asc" ? safeDateValue(a.date) - safeDateValue(b.date) : safeDateValue(b.date) - safeDateValue(a.date)));
  return turns;
}

function renderTotals(turns: typeof state.turns) {
  const count = turns.length;
  const totalXpValue = turns.reduce((acc, turn) => acc + turn.rewards.xp, 0);
  const totalCachetValue = turns.reduce((acc, turn) => acc + turn.rewards.cachet, 0);
  if (totalCount) totalCount.textContent = count.toString();
  if (totalXp) totalXp.textContent = `${totalXpValue}`;
  if (totalCachet) totalCachet.textContent = `${totalCachetValue}`;
  if (chartTotalXp) chartTotalXp.textContent = `${totalXpValue} XP`;
  if (chartTotalCachet) chartTotalCachet.textContent = `${totalCachetValue}`;
}

function buildSparkline(values: number[], accent = false) {
  if (!values.length) {
    return `<div class="muted">Nessun dato da visualizzare.</div>`;
  }
  const width = 280;
  const height = 80;
  const maxValue = Math.max(...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const stroke = accent ? "var(--color-warning)" : "var(--color-sky-300)";
  const points = values
    .map((value, index) => {
      const x = Math.round(index * step);
      const normalized = maxValue === 0 ? 0 : value / maxValue;
      const y = Math.round(height - normalized * (height - 14) - 6);
      return `${x},${y}`;
    })
    .join(" ");
  const lastValue = values[values.length - 1];
  const lastX = (values.length - 1) * step;
  const lastY = height - (maxValue === 0 ? 0 : (lastValue / maxValue) * (height - 14)) - 6;
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Andamento nel tempo">
    <polyline fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" points="${points}" />
    <circle cx="${lastX}" cy="${lastY}" r="5" fill="${stroke}" />
  </svg>`;
}

function renderCharts(turns: typeof state.turns) {
  const sorted = [...turns].sort((a, b) => safeDateValue(a.date) - safeDateValue(b.date));
  let xpAccumulator = 0;
  let cachetAccumulator = 0;
  const xpSeries = sorted.map((turn) => {
    xpAccumulator += turn.rewards.xp;
    return xpAccumulator;
  });
  const cachetSeries = sorted.map((turn) => {
    cachetAccumulator += turn.rewards.cachet;
    return cachetAccumulator;
  });
  if (sparklineXp) {
    sparklineXp.innerHTML = buildSparkline(xpSeries);
  }
  if (sparklineCachet) {
    sparklineCachet.innerHTML = buildSparkline(cachetSeries, true);
  }
}

function renderTurnList(turns: typeof state.turns) {
  if (!turnList) return;
  if (!turns.length) {
    turnList.innerHTML = `<li class="muted">Nessun turno registrato.</li>`;
    return;
  }
  turnList.innerHTML = turns
    .map(
      (turn) =>
        `<li><div><strong>${turn.eventName}</strong> - ${turn.theatre} - ${turn.date}</div><div class="muted">${resolveRole(turn.roleId).name} | ${formatRewards(turn.rewards)}</div></li>`
    )
    .join("");
}

function renderView() {
  const filtered = getFilteredTurns();
  renderTotals(filtered);
  renderCharts(filtered);
  renderTurnList(filtered);
}

populateFilters();
renderView();

roleFilter?.addEventListener("change", renderView);
venueFilter?.addEventListener("change", renderView);
sortFilter?.addEventListener("change", renderView);

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  state = loadState();
  populateFilters();
  renderView();
  showSyncBadge();
});
