/**
 * Visualizations page: manages switching between Three.js background visualizations.
 * 
 * - Dropdown lets the user pick a visualization
 * - On refresh, cycles to the next one automatically (localStorage)
 * - Each visualization is initialized fresh when switched (cleanup previous)
 * - Collapsible sidebar for full canvas view
 */

import { getReducedMotion, supportsWebGL } from './bg-utils.js';
import { initMandelbrotBackground } from './mandelbrot-bg.js';
import { initMobiusBackground } from './mobius-bg.js';

const STORAGE_KEY = 'vizChoiceIndex';

const VISUALIZATIONS = [
  {
    key: 'rubik',
    label: "Rubik's Cube (2×2)",
    description:
      "A 2x2 Rubik's cube that scrambles and solves itself continuously. Each cubie rotates through random face turns, then reverses the sequence to solve: over and over.",
  },
  {
    key: 'mandelbrot',
    label: 'Mandelbrot Set',
    description:
      'An infinite zoom into the Seahorse Valley of the Mandelbrot set. The fractal continuously spirals deeper, revealing ever-finer detail at the boundary of the complex plane.',
  },
  {
    key: 'mobius',
    label: 'Möbius Strip',
    description:
      'A wireframe Mobius strip: a surface with only one side and one edge. The strip rotates slowly, revealing its non-orientable topology from every angle.',
  },
];

let currentCleanup = null;

function getNextIndex() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const prev = raw == null ? -1 : Number.parseInt(raw, 10);
    const next = Number.isFinite(prev) ? (prev + 1) % VISUALIZATIONS.length : 0;
    window.localStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * VISUALIZATIONS.length);
  }
}

function initVisualization(key) {
  // Clean up previous visualization
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const reducedMotion = getReducedMotion();

  if (key === 'rubik') {
    // three-bg.js is a side-effect module: import it directly.
    // It respects reduced motion internally.
    import('./three-bg.js');
    // three-bg.js doesn't return a cleanup function, so we leave currentCleanup null.
  } else if (key === 'mandelbrot') {
    currentCleanup = initMandelbrotBackground({ animate: !reducedMotion });
  } else if (key === 'mobius') {
    currentCleanup = initMobiusBackground({ animate: !reducedMotion });
  }
}

function updateInfoPanel(viz) {
  const titleEl = document.getElementById('vizTitle');
  const descEl = document.getElementById('vizDescription');

  if (titleEl) titleEl.textContent = viz.label;
  if (descEl) descEl.textContent = viz.description;
}

export function initVisualizations() {
  if (!supportsWebGL()) {
    const descEl = document.getElementById('vizDescription');
    if (descEl) {
      descEl.textContent =
        'WebGL is not available in your browser. Visualizations require a WebGL-capable GPU.';
    }
    return;
  }

  const picker = document.getElementById('vizPicker');
  if (!picker) return;

  // Determine which visualization to show: dropdown value OR cycle on load
  const choiceIndex = getNextIndex();
  const choice = VISUALIZATIONS[choiceIndex];

  // Set dropdown to match the cycled choice
  picker.value = choice.key;

  // Initialize the visualization
  initVisualization(choice.key);
  updateInfoPanel(choice);

  // Listen for dropdown changes
  picker.addEventListener('change', (e) => {
    const key = e.target.value;
    const viz = VISUALIZATIONS.find((v) => v.key === key);
    if (!viz) return;

    // Save the manual selection so next refresh cycles from here
    try {
      const idx = VISUALIZATIONS.findIndex((v) => v.key === key);
      window.localStorage.setItem(STORAGE_KEY, String(idx));
    } catch { /* storage blocked */ }

    initVisualization(key);
    updateInfoPanel(viz);
  });
}

initVisualizations();

// --- Sidebar toggle ---

const sidebar = document.getElementById('vizSidebar');
const sidebarToggle = document.getElementById('vizSidebarToggle');

if (sidebar && sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.toggle('is-collapsed');
    sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
  });
}
