// Zeitkalibrierung an den Zeilengrenzen (normalisierung.md 13 «6 Zeiten», N-21: «Die Kalibrierung an
// Formkanten ist verbindlich»). Die Stundenmarken (Formen) liegen im Excel von Hand gesetzt und weichen
// bis zu einigen Minuten von den Rasterlinien ab; die Rasterlinien sind Zeilengrenzen. Jede Stundenmarke
// wird deshalb der nächsten Zeilengrenze zugeordnet; zwischen diesen Grenzen wird linear interpoliert.
// Fällt die Zuordnung nicht eindeutig aus, bleibt die Kalibrierung an den Marken (E1-07). Rein.

import type { SheetModel, SheetTimeScale } from '../xlsx-drawing/index';

interface Anchor {
  readonly minute: number;
  readonly y: number;
}

function nearestBoundary(sheet: SheetModel, y: number): number {
  let r = 0;
  while (r < 2000 && sheet.rowY(r + 1) <= y) r++;
  const a = sheet.rowY(r);
  const b = sheet.rowY(r + 1);
  return Math.abs(y - a) <= Math.abs(b - y) ? a : b;
}

/** Zeitachse an den Zeilengrenzen; `base` ist die Kalibrierung an den Stundenmarken. */
export function rowTimeScale(base: SheetTimeScale, sheet: SheetModel): SheetTimeScale {
  const anchors: Anchor[] = [];
  for (const label of base.labels) {
    const y = nearestBoundary(sheet, label.y);
    const last = anchors.at(-1);
    if (last !== undefined && (y <= last.y || label.minute <= last.minute)) return base;
    anchors.push({ minute: label.minute, y });
  }
  if (anchors.length < 2) return base;
  // Plausibel nur bei nahezu gleichen Abständen je Stunde (Zeilenhöhen des Rasters), sonst Marken.
  const perHour = anchors.slice(1).map((a, i) => {
    const p = anchors[i] ?? a;
    return (a.y - p.y) / ((a.minute - p.minute) / 60);
  });
  const sorted = [...perHour].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  if (median <= 0 || perHour.some((h) => Math.abs(h - median) > median * 0.05)) return base;
  const first = anchors[0] as Anchor;
  const last = anchors.at(-1) as Anchor;
  const segment = (value: number, key: (a: Anchor) => number): [Anchor, Anchor] => {
    for (let i = 1; i < anchors.length; i++) {
      const b = anchors[i] as Anchor;
      if (key(b) > value) return [anchors[i - 1] as Anchor, b];
    }
    return [anchors[anchors.length - 2] as Anchor, last];
  };
  const toMinute = (y: number): number => {
    const [a, b] = y < first.y ? [first, anchors[1] as Anchor] : segment(y, (x) => x.y);
    return a.minute + ((y - a.y) * (b.minute - a.minute)) / (b.y - a.y);
  };
  const toY = (minute: number): number => {
    const [a, b] =
      minute < first.minute ? [first, anchors[1] as Anchor] : segment(minute, (x) => x.minute);
    return a.y + ((minute - a.minute) * (b.y - a.y)) / (b.minute - a.minute);
  };
  return {
    ...base,
    labels: anchors.map((a) => ({ minute: a.minute, y: a.y })),
    toMinute,
    toY,
    gridTop: first.y - median,
    gridBottom: last.y + median * 1.25,
  };
}
