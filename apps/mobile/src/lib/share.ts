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

const FALLBACK_ORIGIN = 'https://turni.atcllazio.it';

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
 * L'origin è **sempre** quello dell'app correntemente caricata
 * (`window.location.origin`), con un fallback al dominio canonico per
 * contesti SSR/test. Non accettiamo un origin esterno per evitare un open
 * redirect latente — se in futuro un caller avesse bisogno di un origin
 * diverso, lo si introduce con allow-list esplicita.
 *
 * @param refHash hash anonimo (es. quello prodotto da analytics.getUserHash)
 *                — non usare userId in chiaro qui.
 */
export function buildShareUrl(refHash: string | null | undefined): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_ORIGIN;
  if (!refHash) return origin;
  const safeRef = encodeURIComponent(refHash);
  return `${origin}/?ref=${safeRef}`;
}
