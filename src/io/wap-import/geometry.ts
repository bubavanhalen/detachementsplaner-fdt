// Flächen und Verdeckung für den Import (Gate S A2; R-8.2-39 bis R-8.2-42). Rein, alle Masse in EMU des Blatts.

export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export const area = (r: Rect): number => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);

export function intersect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  return x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
}

export const overlap1d = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Länge der Vereinigung von Intervallen. */
function unionLength(intervals: readonly (readonly [number, number])[]): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let start = Number.NEGATIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const [a, b] of sorted) {
    if (a > end) {
      if (end > start) total += end - start;
      start = a;
      end = b;
    } else if (b > end) end = b;
  }
  if (end > start) total += end - start;
  return total;
}

/** Anteil 0 … 1 der Fläche von `target`, die die Vereinigung von `covers` bedeckt (exakt, Streifenverfahren). */
export function coveredShare(target: Rect, covers: readonly Rect[]): number {
  const full = area(target);
  if (full <= 0) return 0;
  const parts = covers.map((c) => intersect(target, c)).filter((c): c is Rect => c !== null);
  if (parts.length === 0) return 0;
  const ys = [...new Set(parts.flatMap((p) => [p.y0, p.y1]))].sort((a, b) => a - b);
  let covered = 0;
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i] ?? 0;
    const y1 = ys[i + 1] ?? 0;
    const strip = parts.filter((p) => p.y0 <= y0 && p.y1 >= y1).map((p) => [p.x0, p.x1] as const);
    covered += unionLength(strip) * (y1 - y0);
  }
  return Math.min(1, covered / full);
}

/**
 * Kleinste y-Spanne, in der irgendein Teil der Breite von `target` sichtbar ist (R-8.2-41); null, wenn
 * nichts sichtbar ist.
 */
export function visibleSpan(
  target: Rect,
  covers: readonly Rect[],
): { y0: number; y1: number } | null {
  const parts = covers.map((c) => intersect(target, c)).filter((c): c is Rect => c !== null);
  if (parts.length === 0) return { y0: target.y0, y1: target.y1 };
  const ys = [...new Set([target.y0, target.y1, ...parts.flatMap((p) => [p.y0, p.y1])])].sort(
    (a, b) => a - b,
  );
  const width = target.x1 - target.x0;
  let first: number | null = null;
  let last: number | null = null;
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i] ?? 0;
    const y1 = ys[i + 1] ?? 0;
    if (y1 <= target.y0 || y0 >= target.y1) continue;
    const strip = parts.filter((p) => p.y0 <= y0 && p.y1 >= y1).map((p) => [p.x0, p.x1] as const);
    // Toleranz für Rundung der Anker: weniger als 0,5 % der Breite gilt als bedeckt.
    if (width - unionLength(strip) > width * 0.005) {
      first ??= y0;
      last = y1;
    }
  }
  return first === null || last === null ? null : { y0: first, y1: last };
}
