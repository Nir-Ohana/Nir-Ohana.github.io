import { getReducedMotion } from './bg-utils.js';
import { initMobiusBackground } from './mobius-bg.js';

// Home page: pick a different background on each refresh.
// Options: Rubik's cube (three-bg.js) and Möbius strip (mobius-bg.js).
// Mandelbrot is excluded from the home page but still available on the
// Visualizations page (visualizations.html).
const reducedMotion = getReducedMotion();

const choices = ['rubik', 'mobius'];
const storageKey = 'homeBgChoiceIndex';

function getNextIndex() {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const prev = raw == null ? -1 : Number.parseInt(raw, 10);
    const next = Number.isFinite(prev) ? (prev + 1) % choices.length : 0;
    window.localStorage.setItem(storageKey, String(next));
    return next;
  } catch {
    // Storage may be blocked (privacy mode / policies). Fall back to random.
    return Math.floor(Math.random() * choices.length);
  }
}

const choice = choices[getNextIndex()];

if (choice === 'rubik') {
  // Side-effect module (runs immediately). It already respects reduced motion.
  import('./three-bg.js');
} else {
  initMobiusBackground({ animate: !reducedMotion });
}
