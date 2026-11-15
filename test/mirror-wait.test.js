// While YouTube loads in VR, the card ignores pinches (pick false) so an early
// pinch can't skip the picker; after MIRROR_WAIT_SECONDS without YouTube the
// plain "Pinch to play" card takes over (pick null: any pinch starts).
import { describe, it, expect } from 'vitest';
import { cardPick, MIRROR_WAIT_SECONDS } from '../src/mirror-wait.js';

describe('cardPick', () => {
  it('outside VR (no mirror driving) there is no picker', () => {
    expect(cardPick({ active: false, available: false, picked: false, waited: 0 })).toBe(null);
  });

  it('while YouTube is loading, pinches are ignored', () => {
    expect(cardPick({ active: true, available: false, picked: false, waited: 0 })).toBe(false);
    expect(cardPick({ active: true, available: false, picked: false, waited: MIRROR_WAIT_SECONDS - 0.1 })).toBe(false);
  });

  it('if YouTube never comes up, the plain card takes over after the wait', () => {
    expect(cardPick({ active: true, available: false, picked: false, waited: MIRROR_WAIT_SECONDS })).toBe(null);
  });

  it('once YouTube is up, only a pick starts the run', () => {
    expect(cardPick({ active: true, available: true, picked: false, waited: 0 })).toBe(false);
    expect(cardPick({ active: true, available: true, picked: true, waited: 30 })).toBe(true);
  });
});
