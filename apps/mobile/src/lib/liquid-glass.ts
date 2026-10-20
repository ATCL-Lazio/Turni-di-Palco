// Liquid glass: mappa di spostamento per la rifrazione dei bordi.
//
// Modello ottico ripreso da dashersw/liquid-glass-js (MIT): la rifrazione è
// massima sul bordo della forma e decade in modo esponenziale verso il centro,
// lungo la normale della superficie. Invece di rifrangere uno screenshot della
// pagina in WebGL, qui la mappa alimenta un feDisplacementMap applicato al
// backdrop vivo (backdrop-filter: url(#…)), quindi il vetro mostra sempre il
// contenuto aggiornato.

export interface DisplacementMapOptions {
  /** Raggio degli angoli in px (0 = rettangolo). */
  radius: number;
  /** Distanza dal bordo in px a cui l'intensità scende a ~37%. */
  falloff: number;
  /** Fattore di sottocampionamento della mappa (2 = metà risoluzione). */
  downscale?: number;
}

export interface DisplacementMap {
  width: number;
  height: number;
  /** Pixel RGBA: R/G = spostamento X/Y codificato attorno a 128. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Costruisce la mappa di spostamento per un rettangolo arrotondato di
 * `width`×`height` px. Lo spostamento punta verso l'interno, così il filtro
 * campiona sempre dentro l'elemento e non trascina pixel dal bordo esterno.
 */
export function buildDisplacementMap(
  width: number,
  height: number,
  { radius, falloff, downscale = 2 }: DisplacementMapOptions,
): DisplacementMap {
  const mapWidth = Math.max(1, Math.round(width / downscale));
  const mapHeight = Math.max(1, Math.round(height / downscale));
  const data = new Uint8ClampedArray(mapWidth * mapHeight * 4);

  const maxRadius = Math.min(width / 2, height / 2);
  const r = Math.max(0, Math.min(radius, maxRadius));
  const safeFalloff = Math.max(falloff, 0.0001);
  // La direzione usa un raggio almeno pari alla fascia rifratta: con angoli
  // vivi la normale salterebbe di 90° sulla diagonale e il bordo si
  // "strapperebbe" a gradini.
  const normalRadius = Math.min(Math.max(r, safeFalloff), maxRadius);
  const cx = width / 2;
  const cy = height / 2;

  for (let j = 0; j < mapHeight; j++) {
    const py = ((j + 0.5) * height) / mapHeight;
    for (let i = 0; i < mapWidth; i++) {
      const px = ((i + 0.5) * width) / mapWidth;

      const dx = px - cx;
      const dy = py - cy;
      const distance = insideDistance(Math.abs(dx), Math.abs(dy), cx, cy, r);

      // Normale uscente: gradiente della distanza sulla forma ammorbidita.
      const qx = Math.abs(dx) - (cx - normalRadius);
      const qy = Math.abs(dy) - (cy - normalRadius);
      let nx: number;
      let ny: number;
      if (qx > 0 && qy > 0) {
        const len = Math.hypot(qx, qy);
        nx = (qx / len) * (Math.sign(dx) || 1);
        ny = (qy / len) * (Math.sign(dy) || 1);
      } else if (qx > qy) {
        nx = Math.sign(dx) || 1;
        ny = 0;
      } else {
        nx = 0;
        ny = Math.sign(dy) || 1;
      }

      const magnitude = Math.exp(-Math.max(distance, 0) / safeFalloff);
      const offset = (j * mapWidth + i) * 4;
      data[offset] = 128 - nx * magnitude * 127;
      data[offset + 1] = 128 - ny * magnitude * 127;
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
  }

  return { width: mapWidth, height: mapHeight, data };
}

/** Distanza (positiva dentro) dal bordo di un rettangolo arrotondato. */
function insideDistance(ax: number, ay: number, cx: number, cy: number, r: number): number {
  const qx = ax - (cx - r);
  const qy = ay - (cy - r);
  if (qx > 0 && qy > 0) return r - Math.hypot(qx, qy);
  return r - Math.max(qx, qy);
}

/**
 * `backdrop-filter: url(#…)` funziona solo nei browser Chromium. Safari e
 * Firefox accettano la sintassi ma ignorano il filtro, e in alcuni casi
 * invalidano l'intera dichiarazione perdendo anche il blur: lì restiamo sul
 * vetro solo-blur.
 */
export function supportsBackdropRefraction(
  env: { userAgent: string; supports: (property: string, value: string) => boolean },
): boolean {
  if (!env.supports('backdrop-filter', 'url(#liquid-glass) blur(1px)')) return false;
  // "CriOS"/"FxiOS" sono WebKit su iOS: niente filtri SVG nel backdrop.
  if (/CriOS|FxiOS|EdgiOS|Firefox/i.test(env.userAgent)) return false;
  return /Chrome\/|Chromium\//.test(env.userAgent);
}
