// Farbzuordnung (Beschrieb 8.2 Regel 5; F-31: ΔE2000 ≤ 10, halbtransparente Farben vorher auf Weiss
// verrechnet; zweitnächste Farbe näher als das 1,5-Fache oder ΔE > 10 → Bericht). Rein.

import type { Rgb } from '../../model/wap/types';

export const DELTA_E_MAX = 10;
export const AMBIGUITY_RATIO = 1.5;

/** «RRGGBB» → Rgb; ungültig → null. */
export function hexToRgb(hex: string | null): Rgb | null {
  if (hex === null || !/^[0-9a-f]{6}$/i.test(hex)) return null;
  const n = Number.parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Auf Weiss verrechnet (Deckkraft 0 … 1). */
export function onWhite(c: Rgb, alpha: number): Rgb {
  const a = Math.max(0, Math.min(1, alpha));
  const mix = (v: number) => Math.round(v * a + 255 * (1 - a));
  return { r: mix(c.r), g: mix(c.g), b: mix(c.b) };
}

function toLab(c: Rgb): readonly [number, number, number] {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(c.r);
  const g = lin(c.g);
  const b = lin(c.b);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** CIEDE2000-Farbabstand (Sharma, Wu, Dalal 2005). */
export function deltaE2000(c1: Rgb, c2: Rgb): number {
  const [l1, a1, b1] = toLab(c1);
  const [l2, a2, b2] = toLab(c2);
  const cAvg = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const g = 0.5 * (1 - Math.sqrt(cAvg ** 7 / (cAvg ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1;
  const ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1);
  const cp2 = Math.hypot(ap2, b2);
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = deg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const hp1 = hue(b1, ap1);
  const hp2 = hue(b2, ap2);
  const dl = l2 - l1;
  const dc = cp2 - cp1;
  let dh = 0;
  if (cp1 * cp2 !== 0) {
    dh = hp2 - hp1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(rad(dh / 2));
  const lAvg = (l1 + l2) / 2;
  const cpAvg = (cp1 + cp2) / 2;
  let hAvg = hp1 + hp2;
  if (cp1 * cp2 !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) hAvg = (hp1 + hp2) / 2;
    else hAvg = hp1 + hp2 < 360 ? (hp1 + hp2 + 360) / 2 : (hp1 + hp2 - 360) / 2;
  }
  const t =
    1 -
    0.17 * Math.cos(rad(hAvg - 30)) +
    0.24 * Math.cos(rad(2 * hAvg)) +
    0.32 * Math.cos(rad(3 * hAvg + 6)) -
    0.2 * Math.cos(rad(4 * hAvg - 63));
  const dTheta = 30 * Math.exp(-(((hAvg - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cpAvg ** 7 / (cpAvg ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lAvg - 50) ** 2) / Math.sqrt(20 + (lAvg - 50) ** 2);
  const sc = 1 + 0.045 * cpAvg;
  const sh = 1 + 0.015 * cpAvg * t;
  const rt = -Math.sin(rad(2 * dTheta)) * rc;
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh));
}

export interface ColorCandidate<T> {
  readonly key: T;
  readonly color: Rgb;
}

export interface ColorMatch<T> {
  /** Nächste Farbe innerhalb der Toleranz, sonst null. */
  readonly key: T | null;
  readonly distance: number;
  /** Ausserhalb der Toleranz oder zweitnächste Farbe zu nahe (F-31) → Bericht. */
  readonly unclear: boolean;
}

/** Nächste Kandidatenfarbe nach ΔE2000 mit den Regeln aus F-31. */
export function nearestColor<T>(
  color: Rgb,
  candidates: readonly ColorCandidate<T>[],
): ColorMatch<T> {
  const ranked = candidates
    .map((c) => ({ key: c.key, distance: deltaE2000(color, c.color) }))
    .sort((a, b) => a.distance - b.distance);
  const [first, second] = ranked;
  if (first === undefined) return { key: null, distance: Number.POSITIVE_INFINITY, unclear: true };
  if (first.distance > DELTA_E_MAX) return { key: null, distance: first.distance, unclear: true };
  const ambiguous =
    second !== undefined &&
    first.distance > 0.5 &&
    second.distance < first.distance * AMBIGUITY_RATIO;
  return { key: first.key, distance: first.distance, unclear: ambiguous };
}
