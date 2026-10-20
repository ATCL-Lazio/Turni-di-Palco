/**
 * FLIP helpers for list reordering animations.
 *
 * Positions must be layout positions (e.g. `offsetTop` relative to the list
 * container): independent of page scroll and of any in-flight transform, so
 * that an unchanged list never produces a shift.
 */

/** Shifts smaller than this (px) are treated as sub-pixel noise. */
export const FLIP_MIN_SHIFT_PX = 1;

/**
 * Returns, for every row present in both snapshots whose layout position
 * changed, the inverse offset (previous - next) to apply before animating
 * back to zero. Rows that are new, removed or unchanged are omitted.
 */
export function computeFlipShifts(
  previous: ReadonlyMap<string, number>,
  next: ReadonlyMap<string, number>,
  minShift: number = FLIP_MIN_SHIFT_PX,
): Map<string, number> {
  const shifts = new Map<string, number>();
  for (const [id, nextTop] of next) {
    const previousTop = previous.get(id);
    if (previousTop === undefined) continue;
    const delta = previousTop - nextTop;
    if (Math.abs(delta) > minShift) shifts.set(id, delta);
  }
  return shifts;
}
