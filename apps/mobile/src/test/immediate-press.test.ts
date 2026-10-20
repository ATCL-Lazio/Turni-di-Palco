import { describe, expect, it } from 'vitest';
import { createImmediatePressGuard } from '../lib/immediate-press';

describe('createImmediatePressGuard', () => {
  it('fires once for a tap (pointerdown + click)', () => {
    const guard = createImmediatePressGuard();
    expect(guard.shouldHandlePointerDown({ button: 0 })).toBe(true);
    expect(guard.shouldHandleClick({ detail: 1 })).toBe(false);
  });

  it('fires on every tap of a sequence', () => {
    const guard = createImmediatePressGuard();
    for (let i = 0; i < 3; i += 1) {
      expect(guard.shouldHandlePointerDown({ button: 0 })).toBe(true);
      expect(guard.shouldHandleClick({ detail: 1 })).toBe(false);
    }
  });

  it('keeps keyboard activation (click with detail 0)', () => {
    const guard = createImmediatePressGuard();
    expect(guard.shouldHandleClick({ detail: 0 })).toBe(true);
    expect(guard.shouldHandleClick({ detail: 0 })).toBe(true);
  });

  it('keeps keyboard activation even after a pointer press released elsewhere', () => {
    const guard = createImmediatePressGuard();
    expect(guard.shouldHandlePointerDown({ button: 0 })).toBe(true);
    // no click: pointer released outside the button
    expect(guard.shouldHandleClick({ detail: 0 })).toBe(true);
  });

  it('ignores non-primary pointer buttons', () => {
    const guard = createImmediatePressGuard();
    expect(guard.shouldHandlePointerDown({ button: 2 })).toBe(false);
  });

  it('handles a click with no preceding pointerdown (e.g. assistive tech)', () => {
    const guard = createImmediatePressGuard();
    expect(guard.shouldHandleClick({ detail: 1 })).toBe(true);
  });
});
