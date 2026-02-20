/**
 * algorithm-visualizations.js - Bootstrap & picker for algorithm visualizations.
 *
 * Each visualization lives in its own module under ./visualizations/.
 * Modules are loaded lazily on first selection via dynamic import().
 */

import { getReducedMotion } from './bg-utils.js';

/* --- Lazy-loading registry ---------------------------------------- */

const vizModules = {
  'floyd':          () => import('./visualizations/floyd.js'),
  'tree':           () => import('./visualizations/tree.js'),
  'hash':           () => import('./visualizations/hash-table.js'),
  'fibonacci':      () => import('./visualizations/fibonacci.js'),
  'merge-lists':    () => import('./visualizations/merge-lists.js'),
  'merge-array':    () => import('./visualizations/merge-array.js'),
  'moving-average': () => import('./visualizations/moving-average.js'),
  'recent-calls':   () => import('./visualizations/recent-calls.js'),
  'sqrt':           () => import('./visualizations/sqrt.js'),
  'majority':       () => import('./visualizations/majority.js'),
  'excel':          () => import('./visualizations/excel.js'),
  'hamming':        () => import('./visualizations/hamming.js'),
  'reverse-bits':   () => import('./visualizations/reverse-bits.js'),
  'lru-cache':      () => import('./visualizations/lru-cache.js'),
  'lfu-cache':      () => import('./visualizations/lfu-cache.js'),
};

const initialized = new Set();
const loading = new Map();

async function ensureVisualization(key) {
  if (initialized.has(key)) return;

  const loadModule = vizModules[key];
  if (!loadModule) return;

  if (loading.has(key)) {
    await loading.get(key);
    return;
  }

  const loadPromise = (async () => {
    initialized.add(key);
    try {
      const mod = await loadModule();
      if (typeof mod?.default !== 'function') {
        throw new Error(`Visualization module "${key}" does not export a default init function.`);
      }
      mod.default();
    } catch (e) {
      initialized.delete(key);
      throw e;
    } finally {
      loading.delete(key);
    }
  })();

  loading.set(key, loadPromise);

  try {
    await loadPromise;
  } catch (e) {
    console.error('Failed to load visualization "' + key + '":', e);
  }
}

/* --- Picker ------------------------------------------------------- */

function initAnimationPicker() {
  const picker = document.getElementById('animationPicker');
  const items = Array.from(document.querySelectorAll('.algo-item[data-animation]'));
  if (!picker || items.length === 0) return;

  const reduceMotion = getReducedMotion();
  const available = new Set(items.map((item) => item.dataset.animation).filter(Boolean));

  if (!available.has(picker.value)) {
    picker.value = items[0].dataset.animation || '';
  }

  async function applySelection({ scrollIntoView = false } = {}) {
    const selected = picker.value;
    let selectedItem = null;

    for (const item of items) {
      const isMatch = item.dataset.animation === selected;
      item.hidden = !isMatch;
      if (isMatch) selectedItem = item;
    }

    await ensureVisualization(selected);

    if (scrollIntoView && selectedItem) {
      selectedItem.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }

    window.dispatchEvent(new Event('resize'));
  }

  picker.addEventListener('change', () => applySelection({ scrollIntoView: true }));
  applySelection();
}

initAnimationPicker();
