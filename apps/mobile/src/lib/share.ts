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
 * Costruisce un URL condivisibile che apre l'app sulla home.
 *
 * **Perché non `/profile/<userId>`**: il router della PWA non ha (ancora)
 * una rotta per il profilo pubblico arbitrario via deep-link — `PublicProfile`
 * è renderizzato solo quando `selectedLeaderboardEntry` viene impostato
 * dalla classifica in-app. Un URL `/profile/<userId>` finirebbe su un 404
 * dello static host. Finché il routing del deep-link non esiste, condividiamo
 * la home con un parametro `?ref=<hash>` (referral-only): l'app si carica
 * normalmente, e l'hash anonimo può essere usato a fini di tracking senza
 * esporre l'userId.
 *
 * Una volta che #1086 (deep-link profile route) sarà mergeato, questa
 * funzione potrà ritornare l'URL pieno al profilo specifico.
 *
 * @param refHash hash anonimo (es. quello prodotto da analytics.getUserHash)
 *                — non usare userId in chiaro qui.
 */
export function buildShareUrl(
  refHash: string | null | undefined,
  options?: { origin?: string },
): string {
  const origin =
    options?.origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://turni.atcllazio.it');
  if (!refHash) return origin;
  const safeRef = encodeURIComponent(refHash);
  return `${origin}/?ref=${safeRef}`;
}
