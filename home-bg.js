import { getReducedMotion } from './bg-utils.js';
import { initMandelbrotBackground } from './mandelbrot-bg.js';
import { initMobiusBackground } from './mobius-bg.js';

// Home page: pick a different background on each refresh.
// Options:
// - Rubik's cube (three-bg.js)
// - Mandelbrot (mandelbrot-bg.js)
// - Möbius strip (mobius-bg.js)
const reducedMotion = getReducedMotion();

const choices = ['rubik', 'mandelbrot', 'mobius'];
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
} else if (choice === 'mandelbrot') {
  initMandelbrotBackground({ animate: !reducedMotion });
} else {
  initMobiusBackground({ animate: !reducedMotion });
}
