// Wrapper minimo per Web Share API con fallback a clipboard.
// Closes #473: feature di condivisione sociale minima.

export type SharePayload = {
  title?: string;
  text?: string;
  url: string;
};

export type ShareResult =
  | { kind: 'shared' }
  | { kind: 'copied' }
  | { kind: 'cancelled' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

function isWebShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function sharePayload(payload: SharePayload): Promise<ShareResult> {
  if (isWebShareAvailable()) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return { kind: 'shared' };
    } catch (err) {
      // AbortError = utente ha chiuso la dialog. Non è un fallimento.
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { kind: 'cancelled' };
      }
      // Fallthrough → tenta clipboard come fallback resiliente.
    }
  }

  const copied = await copyToClipboard(payload.url);
  if (copied) return { kind: 'copied' };

  if (!isWebShareAvailable()) return { kind: 'unsupported' };
  return { kind: 'error', message: 'share_failed' };
}

/**
 * Costruisce l'URL canonico per il profilo pubblico condivisibile.
 * Tiene conto di `window.location.origin` quando disponibile, altrimenti
 * ripiega su un dominio noto (utile per SSR/test).
 */
export function buildPublicProfileUrl(
  userId: string,
  options?: { origin?: string },
): string {
  const origin =
    options?.origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://turni.atcllazio.it');
  const safeId = encodeURIComponent(userId);
  return `${origin}/profile/${safeId}`;
}
