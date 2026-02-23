/**
 * Helper function for sync badge animations with accessibility support
 */
const syncBadgeTimeouts = new WeakMap<HTMLElement, number>();

export function showSyncBadge(
  syncBadge: HTMLElement | null,
  message = "Stato aggiornato",
  duration = 2500
): void {
  if (!syncBadge) return;
  
  syncBadge.textContent = message;
  syncBadge.setAttribute("aria-live", "polite");
  syncBadge.style.display = "inline-flex";
  
  // Force reflow to restart animation
  syncBadge.classList.remove("is-live");
  void syncBadge.offsetWidth;
  syncBadge.classList.add("is-live");
  
  // Clear existing timeout for this badge instance
  const existingTimeout = syncBadgeTimeouts.get(syncBadge);
  if (existingTimeout !== undefined) {
    window.clearTimeout(existingTimeout);
  }
  
  // Hide after duration
  const timeoutId = window.setTimeout(() => {
    if (syncBadge) {
      syncBadge.classList.remove("is-live");
      syncBadge.style.display = "none";
      syncBadge.removeAttribute("aria-live");
      syncBadgeTimeouts.delete(syncBadge);
    }
  }, duration);
  syncBadgeTimeouts.set(syncBadge, timeoutId);
}
