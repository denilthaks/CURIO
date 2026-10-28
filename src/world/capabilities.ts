// Lightweight checks used before the 3D engine is downloaded.

export type Quality = 'high' | 'low';

/** True when the browser can create a WebGL context at all. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = Math.min(window.screen?.width ?? 1200, window.screen?.height ?? 900) < 700;
  if (coarse || small) return 'low';
  if ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4) return 'low';
  return 'high';
}
