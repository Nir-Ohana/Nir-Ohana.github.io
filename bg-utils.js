function hexToThreeColorNumber(hex, fallback = 0x1d4ed8) {
  if (!hex) return fallback;
  const normalized = String(hex).trim().replace('#', '');
  const isValid = /^[0-9a-fA-F]{6}$/.test(normalized);
  return isValid ? Number.parseInt(normalized, 16) : fallback;
}

export function getAccentColorNumber(fallback = 0x1d4ed8) {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--accent');
  return hexToThreeColorNumber(value, fallback);
}

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function getReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

export function getCanvas(canvasId = 'bg-canvas') {
  return document.getElementById(canvasId);
}
