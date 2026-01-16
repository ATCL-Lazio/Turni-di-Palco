import "../../../shared/styles/main.css";
import { renderPageHero } from "./components/page-hero";
import { renderLeaderboard, attachLeaderboardListeners, LeaderboardViewMode } from "./components/leaderboard";
import { calculateLeaderboardStats, loadState, STORAGE_KEY } from "./state";
import type { LeaderboardEntry, RoleId } from "./types";
import { supabase, isSupabaseConfigured } from "./services/supabase";
import { requireDevAccess } from "./services/dev-gate";

const start = async () => {
  if (!(await requireDevAccess())) return;


  const root = document.querySelector<HTMLDivElement>("#app");

  if (!root) {
    throw new Error("Root container missing");
  }

  const pageHero = renderPageHero({
    title: "Classifica",
    description: "Le migliori performance dei tecnici teatrali ATCL.",
    currentPage: "leaderboard",
    breadcrumbs: [
      { label: "Hub", href: "/game.html" },
      { label: "Classifica" },
    ],
    backHref: "/game.html",
    backLabel: "Torna all'hub",
  });

  let currentViewMode: LeaderboardViewMode = "xp";
  let leaderboardEntries: LeaderboardEntry[] = [];
  let leaderboardStats = calculateLeaderboardStats(leaderboardEntries);
  let isLoading = false;
  let loadError: string | null = null;
  let currentUserId: string | undefined;

  type LeaderboardRow = {
    id: string;
    name: string;
    role_id: string | null;
    xp_total: number | null;
    cachet: number | null;
    reputation: number | null;
    profile_image: string | null;
    last_activity_at: string | null;
    turns_count: number | null;
  };

  function renderLeaderboardPage() {
    if (!root) return;
    
    const sortedEntries = sortEntriesByMode(leaderboardEntries, currentViewMode);
    
    root.innerHTML = `
      <main class="page page-game layout-shell">
        ${pageHero}

        <section class="card">
          ${isLoading ? '<p class="muted">Caricamento classifica...</p>' : ""}
          ${loadError ? `<p class="muted">${loadError}</p>` : ""}
          ${!isLoading && !loadError ? renderLeaderboard({
              entries: sortedEntries,
              stats: leaderboardStats,
              currentUserId,
              viewMode: currentViewMode,
              onViewModeChange: handleViewModeChange,
            }) : ""}
        </section>
      </main>
    `;

    attachLeaderboardListeners(root, handleViewModeChange);
  }

  function sortEntriesByMode(entries: LeaderboardEntry[], mode: LeaderboardViewMode): LeaderboardEntry[] {
    const sorted = [...entries];
    
    switch (mode) {
      case "xp":
        return sorted.sort((a, b) => b.xpTotal - a.xpTotal);
      case "reputation":
        return sorted.sort((a, b) => b.reputation - a.reputation);
      case "cachet":
        return sorted.sort((a, b) => b.cachet - a.cachet);
      default:
        return sorted;
    }
  }

  async function loadLeaderboard() {
    isLoading = true;
    loadError = null;
    renderLeaderboardPage();

    if (!isSupabaseConfigured || !supabase) {
      isLoading = false;
      loadError = "Supabase non configurato (mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).";
      renderLeaderboardPage();
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      currentUserId = authData.user?.id;

      const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: 100 });
      if (error) throw error;

      const rows = (data as LeaderboardRow[]) ?? [];
      leaderboardEntries = rows.map((row) => {
        const roleCandidate = row.role_id ?? "attore";
        const roleId: RoleId = (roleCandidate === "attore" || roleCandidate === "luci" || roleCandidate === "fonico" || roleCandidate === "attrezzista" || roleCandidate === "palco")
          ? (roleCandidate as RoleId)
          : "attore";

        const lastActivityAt = row.last_activity_at ? Date.parse(row.last_activity_at) : undefined;
        return {
          id: row.id,
          name: row.name ?? "Player",
          roleId,
          xpTotal: row.xp_total ?? 0,
          cachet: row.cachet ?? 0,
          reputation: row.reputation ?? 0,
          turnsCount: row.turns_count ?? 0,
          lastActivityAt,
          profileImage: row.profile_image ?? undefined,
        };
      });

      leaderboardStats = calculateLeaderboardStats(leaderboardEntries);
      isLoading = false;
      renderLeaderboardPage();
    } catch (error) {
      isLoading = false;
      loadError = error instanceof Error ? error.message : "Errore durante il caricamento della classifica.";
      renderLeaderboardPage();
    }
  }

  function handleViewModeChange(mode: LeaderboardViewMode) {
    currentViewMode = mode;
    
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
    
    renderLeaderboardPage();
  }

  function showSyncBadge(message = "Stato aggiornato") {
    const syncBadge = document.querySelector<HTMLElement>('[data-sync-badge]');
    if (!syncBadge) return;
    
    syncBadge.textContent = message;
    syncBadge.style.display = "inline-flex";
    
    setTimeout(() => {
      if (syncBadge) syncBadge.style.display = "none";
    }, 2500);
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    loadState();
    showSyncBadge();
  });

  renderLeaderboardPage();
  loadLeaderboard();
};

void start();
