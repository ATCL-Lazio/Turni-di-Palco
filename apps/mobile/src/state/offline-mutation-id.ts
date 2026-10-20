let offlineMutationIdFallbackCounter = 0;

export function createOfflineMutationId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Format as a UUID-like hex string to keep IDs readable and unique enough
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `offline-${Date.now()}-${hex.slice(0, 16)}`;
  }

  // Last-resort fallback without using Math.random (not cryptographically secure)
  offlineMutationIdFallbackCounter += 1;
  return `offline-${Date.now()}-${offlineMutationIdFallbackCounter}`;
}
