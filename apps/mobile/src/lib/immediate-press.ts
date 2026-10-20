/**
 * Lets a button act on pointer down (no release latency, e.g. for reflex
 * minigames) while keeping keyboard activation via `click`, without firing
 * twice for the pointerdown + click pair produced by a single tap.
 */
export interface ImmediatePressGuard {
  /** True when this pointerdown should trigger the action. */
  shouldHandlePointerDown(event: { button: number }): boolean;
  /** True when this click should trigger the action (keyboard or unpaired click). */
  shouldHandleClick(event: { detail: number }): boolean;
}

export function createImmediatePressGuard(): ImmediatePressGuard {
  // Set by a primary pointerdown: the click that ends the same pointer
  // sequence (possibly after a long hold) must be swallowed.
  let pointerSequencePending = false;

  return {
    shouldHandlePointerDown(event) {
      // Only primary presses: mouse left button, touch contact, pen tip.
      if (event.button !== 0) return false;
      pointerSequencePending = true;
      return true;
    },
    shouldHandleClick(event) {
      // detail === 0: keyboard (Enter/Space) or programmatic activation,
      // never paired with a pointerdown.
      if (event.detail === 0) return true;
      if (pointerSequencePending) {
        pointerSequencePending = false;
        return false;
      }
      return true;
    },
  };
}
