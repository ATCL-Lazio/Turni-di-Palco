import type { LeaderboardEntry, LeaderboardStats } from "../types";
import { resolveRole } from "../state";
import { getAvatarVisual } from "../avatar-visual";

export type LeaderboardViewMode = "xp" | "reputation" | "cachet";

export interface LeaderboardComponentOptions {
  entries: LeaderboardEntry[];
  stats: LeaderboardStats;
  currentUserId?: string;
  viewMode?: LeaderboardViewMode;
  onViewModeChange?: (mode: LeaderboardViewMode) => void;
}

export function renderLeaderboard(options: LeaderboardComponentOptions): string {
  const { entries, stats, currentUserId, viewMode = "xp", onViewModeChange } = options;
  
  const sortedEntries = sortEntries(entries, viewMode);
  const userPosition = currentUserId ? sortedEntries.findIndex(entry => entry.id === currentUserId) : -1;
  const userEntry = userPosition >= 0 ? sortedEntries[userPosition] : null;

  return `
    <div class="leaderboard-container">
      <div class="leaderboard-header">
        <h2>Classifica</h2>
        <div class="leaderboard-stats">
          <div class="stat-chip">
            <span>Giocatori</span>
            <strong>${stats.totalPlayers}</strong>
          </div>
          <div class="stat-chip">
            <span>Media XP</span>
            <strong>${stats.averageXp}</strong>
          </div>
          <div class="stat-chip">
            <span>Top XP</span>
            <strong>${stats.topXp}</strong>
          </div>
        </div>
      </div>

      <div class="leaderboard-controls">
        <div class="view-mode-tabs" role="tablist">
          <button 
            class="tab-button ${viewMode === "xp" ? "active" : ""}" 
            data-mode="xp" 
            role="tab" 
            aria-selected="${viewMode === "xp"}"
            ${onViewModeChange ? 'data-action="change-mode"' : ''}
          >
            XP
          </button>
          <button 
            class="tab-button ${viewMode === "reputation" ? "active" : ""}" 
            data-mode="reputation" 
            role="tab" 
            aria-selected="${viewMode === "reputation"}"
            ${onViewModeChange ? 'data-action="change-mode"' : ''}
          >
            Reputazione
          </button>
          <button 
            class="tab-button ${viewMode === "cachet" ? "active" : ""}" 
            data-mode="cachet" 
            role="tab" 
            aria-selected="${viewMode === "cachet"}"
            ${onViewModeChange ? 'data-action="change-mode"' : ''}
          >
            Cachet
          </button>
        </div>
      </div>

      <div class="leaderboard-list">
        ${sortedEntries
          .slice(0, 20)
          .map((entry, index) => renderLeaderboardEntry(entry, index + 1, entry.id === currentUserId, viewMode))
          .join("")}
      </div>

      ${userEntry && userPosition >= 20 ? `
        <div class="leaderboard-user-position">
          <h3>La tua posizione</h3>
          ${renderLeaderboardEntry(userEntry, userPosition + 1, true, viewMode)}
        </div>
      ` : ""}

      ${entries.length === 0 ? `
        <div class="leaderboard-empty">
          <p class="muted">Classifica vuota.</p>
        </div>
      ` : ""}
    </div>
  `;
}

function sortEntries(entries: LeaderboardEntry[], mode: LeaderboardViewMode): LeaderboardEntry[] {
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

function colorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}deg 75% 55%)`;
}

function formatLeaderboardPosition(position: number): string {
  return `${position}°`;
}

function renderLeaderboardEntry(entry: LeaderboardEntry, position: number, isCurrentUser: boolean, viewMode: LeaderboardViewMode): string {
  const role = resolveRole(entry.roleId);
  const avatarVisual = getAvatarVisual({ hue: 210, icon: "mask", rpmThumbnail: entry.profileImage || "" });
  const positionDisplay = formatLeaderboardPosition(position);
  const fallbackColor = colorFromString(entry.id);
  
  return `
    <div class="leaderboard-entry ${isCurrentUser ? "current-user" : ""}" data-player-id="${entry.id}">
      <div class="leaderboard-position">
        <span class="position-badge">${positionDisplay}</span>
      </div>
      
      <div class="leaderboard-avatar">
        <div class="avatar-display small" style="--avatar-color: ${avatarVisual.color || fallbackColor}; --avatar-hue: 210deg;">
          ${entry.profileImage ? `<img src="${entry.profileImage}" alt="${entry.name}" />` : `<span class="avatar-icon">${entry.name.slice(0, 1).toUpperCase()}</span>`}
        </div>
      </div>

      <div class="leaderboard-info">
        <div class="player-name">
          ${entry.name}
          ${isCurrentUser ? '<span class="current-user-badge">Tu</span>' : ""}
        </div>
        <div class="player-role">${role.name}</div>
        <div class="player-stats">
          <span class="stat-item">${entry.xpTotal} XP</span>
          <span class="stat-item">${entry.reputation} rep</span>
          <span class="stat-item">${entry.turnsCount} turni</span>
        </div>
      </div>

      <div class="leaderboard-score">
        <div class="score-value">${getScoreValue(entry, viewMode)}</div>
        <div class="score-label">${getScoreLabel(viewMode)}</div>
      </div>
    </div>
  `;
}

function getScoreValue(entry: LeaderboardEntry, mode: LeaderboardViewMode): number {
  switch (mode) {
    case "reputation":
      return entry.reputation;
    case "cachet":
      return entry.cachet;
    default:
      return entry.xpTotal;
  }
}

function getScoreLabel(mode: LeaderboardViewMode): string {
  switch (mode) {
    case "reputation":
      return "Reputazione";
    case "cachet":
      return "Cachet";
    default:
      return "XP";
  }
}

export function attachLeaderboardListeners(
  container: HTMLElement,
  onViewModeChange?: (mode: LeaderboardViewMode) => void
): void {
  const modeButtons = container.querySelectorAll('[data-action="change-mode"]');
  
  modeButtons.forEach(button => {
    button.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const mode = target.dataset.mode as LeaderboardViewMode;
      
      if (mode && onViewModeChange) {
        onViewModeChange(mode);
      }
    });
  });
}
