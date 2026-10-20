import { describe, expect, it } from 'vitest';
import { buildDisplacementMap, supportsBackdropRefraction } from '../lib/liquid-glass';

function pixel(map: ReturnType<typeof buildDisplacementMap>, x: number, y: number) {
  const offset = (y * map.width + x) * 4;
  return { r: map.data[offset], g: map.data[offset + 1] };
}

describe('buildDisplacementMap', () => {
  const map = buildDisplacementMap(200, 100, { radius: 0, falloff: 10, downscale: 1 });

  it('rispetta le dimensioni sottocampionate', () => {
    const half = buildDisplacementMap(200, 100, { radius: 0, falloff: 10 });
    expect(half.width).toBe(100);
    expect(half.height).toBe(50);
    expect(half.data.length).toBe(100 * 50 * 4);
  });

  it('lascia il centro quasi neutro', () => {
    const center = pixel(map, 100, 50);
    expect(Math.abs(center.r - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(center.g - 128)).toBeLessThanOrEqual(1);
  });

  it('sposta verso l\'interno sui bordi', () => {
    // Bordo sinistro: la normale esce verso -x, lo spostamento va verso +x.
    expect(pixel(map, 0, 50).r).toBeGreaterThan(200);
    // Bordo destro: spostamento verso -x.
    expect(pixel(map, 199, 50).r).toBeLessThan(56);
    // Bordo in alto: spostamento verso +y.
    expect(pixel(map, 100, 0).g).toBeGreaterThan(200);
    // Bordo in basso: spostamento verso -y.
    expect(pixel(map, 100, 99).g).toBeLessThan(56);
  });

  it('decade allontanandosi dal bordo', () => {
    const edge = pixel(map, 0, 50).r - 128;
    const inner = pixel(map, 10, 50).r - 128;
    const deep = pixel(map, 40, 50).r - 128;
    expect(edge).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(deep);
  });

  it('con angoli vivi non salta di direzione sulla diagonale', () => {
    // Due pixel adiacenti ai lati della diagonale dell'angolo in alto a sinistra.
    const above = pixel(map, 6, 5);
    const below = pixel(map, 5, 6);
    expect(Math.abs(above.r - below.r)).toBeLessThan(25);
    expect(Math.abs(above.g - below.g)).toBeLessThan(25);
  });

  it('negli angoli arrotondati spinge in diagonale', () => {
    const rounded = buildDisplacementMap(100, 100, { radius: 30, falloff: 10, downscale: 1 });
    const corner = pixel(rounded, 10, 10);
    expect(corner.r).toBeGreaterThan(128);
    expect(corner.g).toBeGreaterThan(128);
    expect(Math.abs(corner.r - corner.g)).toBeLessThanOrEqual(2);
  });
});

describe('supportsBackdropRefraction', () => {
  const yes = () => true;
  const chromeAndroid =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

  it('accetta Chromium', () => {
    expect(supportsBackdropRefraction({ userAgent: chromeAndroid, supports: yes })).toBe(true);
  });

  it('esclude Safari, Chrome su iOS e Firefox anche se il parser accetta la sintassi', () => {
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const chromeIos =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1';
    const firefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0';
    expect(supportsBackdropRefraction({ userAgent: safari, supports: yes })).toBe(false);
    expect(supportsBackdropRefraction({ userAgent: chromeIos, supports: yes })).toBe(false);
    expect(supportsBackdropRefraction({ userAgent: firefox, supports: yes })).toBe(false);
  });

  it('rispetta CSS.supports', () => {
    expect(supportsBackdropRefraction({ userAgent: chromeAndroid, supports: () => false })).toBe(false);
  });
});
