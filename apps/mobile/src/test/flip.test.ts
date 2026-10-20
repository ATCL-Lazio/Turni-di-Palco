import { describe, expect, it } from 'vitest';
import { computeFlipShifts } from '../lib/flip';

const tops = (entries: Array<[string, number]>) => new Map(entries);

describe('computeFlipShifts', () => {
  it('returns no shifts when layout positions are unchanged', () => {
    const layout = tops([['a', 0], ['b', 92], ['c', 184]]);
    expect(computeFlipShifts(layout, new Map(layout)).size).toBe(0);
  });

  it('returns the inverse offset only for rows whose position changed', () => {
    const previous = tops([['a', 0], ['b', 92], ['c', 184]]);
    const next = tops([['b', 0], ['a', 92], ['c', 184]]);
    expect(computeFlipShifts(previous, next)).toEqual(new Map([['b', 92], ['a', -92]]));
  });

  it('ignores rows that were added or removed', () => {
    const previous = tops([['a', 0], ['gone', 92]]);
    const next = tops([['a', 0], ['new', 92]]);
    expect(computeFlipShifts(previous, next).size).toBe(0);
  });

  it('ignores sub-pixel noise below the threshold', () => {
    const previous = tops([['a', 0], ['b', 92]]);
    const next = tops([['a', 0.5], ['b', 93]]);
    expect(computeFlipShifts(previous, next).size).toBe(0);
    expect(computeFlipShifts(previous, tops([['a', 0], ['b', 95]]))).toEqual(new Map([['b', -3]]));
  });

  it('yields nothing for an empty previous snapshot (first render)', () => {
    expect(computeFlipShifts(new Map(), tops([['a', 0]])).size).toBe(0);
  });
});
