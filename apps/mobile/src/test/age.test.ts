// Tests per l'age gate del signup (GDPR Art. 8, età consenso digitale IT = 14).

import { describe, expect, it } from 'vitest';
import { MIN_SIGNUP_AGE, computeAge, meetsMinAge } from '../lib/age';

const NOW = new Date(2026, 6, 2); // 2 luglio 2026 (mese 0-based → 6 = luglio)

describe('computeAge', () => {
  it('calcola gli anni compiuti', () => {
    expect(computeAge('2000-01-01', NOW)).toBe(26);
    expect(computeAge('2010-07-02', NOW)).toBe(16); // compleanno oggi
  });

  it('sottrae un anno se il compleanno non è ancora arrivato', () => {
    expect(computeAge('2010-07-03', NOW)).toBe(15); // compleanno domani
    expect(computeAge('2010-12-31', NOW)).toBe(15);
  });

  it('ritorna null per date vuote, non valide, malformate o nel futuro', () => {
    expect(computeAge('', NOW)).toBeNull();
    expect(computeAge('non-una-data', NOW)).toBeNull();
    expect(computeAge('2011-02-31', NOW)).toBeNull(); // 31 febbraio inesistente
    expect(computeAge('2030-01-01', NOW)).toBeNull(); // futuro
  });
});

describe('meetsMinAge', () => {
  it(`accetta chi ha almeno ${MIN_SIGNUP_AGE} anni`, () => {
    expect(meetsMinAge('2012-07-02', NOW)).toBe(true); // esattamente 14 oggi
    expect(meetsMinAge('2000-01-01', NOW)).toBe(true);
  });

  it('rifiuta gli under-14', () => {
    expect(meetsMinAge('2012-07-03', NOW)).toBe(false); // 14 anni domani → oggi 13
    expect(meetsMinAge('2015-01-01', NOW)).toBe(false);
  });

  it('rifiuta input non validi', () => {
    expect(meetsMinAge('', NOW)).toBe(false);
    expect(meetsMinAge('2030-01-01', NOW)).toBe(false);
  });
});
