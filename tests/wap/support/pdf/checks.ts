// Prüfungen auf dem ausgelesenen PDF (Paket E1-01b, R-H-19, ADR-010 §7.2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4, §9 Nr 4 und E1-01b.md §2 «Prüfhilfen».
// Nur löschbare TypeScript-Syntax und nur Typimporte (läuft auch über die Typentfernung von Node 24).
import type { PdfInfo, PdfTextRun, Rect } from './read';

/** Toleranz für «innerhalb eines Rahmens» (pt). */
const RAND = 0.01;

/** Mindestschnitt, ab dem zwei Rechtecke überlappen (pt, je Achse). */
const SCHNITT = 0.001;

/** Kleinste Schriftgrösse aller Textläufe in pt; ohne Läufe Infinity. */
export function minFontSize(info: PdfInfo): number {
  let min = Number.POSITIVE_INFINITY;
  for (const t of info.texts) if (t.sizePt < min) min = t.sizePt;
  return min;
}

/**
 * Umriss eines Laufs (Ursprung oben links): entlang der Schrift von x bis x + width, quer von
 * Grundlinie − ascent·size bis Grundlinie − descent·size (Vertrag E1-01b §2).
 */
export function textOutline(t: PdfTextRun): Rect {
  const oben = t.ascent * t.sizePt;
  const unten = t.descent * t.sizePt;
  switch (t.rotation) {
    case 90:
      // Schrift läuft nach oben (y nimmt ab); die Oberlänge zeigt nach links.
      return { x: t.x - oben, y: t.baselineY - t.width, w: oben - unten, h: t.width };
    case 270:
      // Schrift läuft nach unten (y nimmt zu); die Oberlänge zeigt nach rechts.
      return { x: t.x + unten, y: t.baselineY, w: oben - unten, h: t.width };
    default:
      return { x: t.x, y: t.baselineY - oben, w: t.width, h: oben - unten };
  }
}

function innen(r: Rect, rahmen: Rect): boolean {
  return (
    r.x >= rahmen.x - RAND &&
    r.y >= rahmen.y - RAND &&
    r.x + r.w <= rahmen.x + rahmen.w + RAND &&
    r.y + r.h <= rahmen.y + rahmen.h + RAND
  );
}

/** Textläufe, deren Umriss in keinem der Rahmen vollständig liegt (ein einziger Rahmen muss ihn fassen). */
export function textOutsideFrames(info: PdfInfo, frames: Rect[]): PdfTextRun[] {
  return info.texts.filter((t) => {
    const u = textOutline(t);
    return !frames.some((f) => innen(u, f));
  });
}

function schnitt(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** Paare i < j sich überlappender Rechtecke (Schnitt > 0,001 pt in x und y); erlaubt nimmt Paare aus. */
export function overlaps(rects: Rect[], erlaubt?: (a: Rect, b: Rect) => boolean): [Rect, Rect][] {
  const aus: [Rect, Rect][] = [];
  for (let i = 0; i < rects.length; i++) {
    const a = rects[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < rects.length; j++) {
      const b = rects[j];
      if (b === undefined) continue;
      const sx = schnitt(a.x, a.x + a.w, b.x, b.x + b.w);
      const sy = schnitt(a.y, a.y + a.h, b.y, b.y + b.h);
      if (sx > SCHNITT && sy > SCHNITT && !(erlaubt?.(a, b) ?? false)) aus.push([a, b]);
    }
  }
  return aus;
}

/**
 * Kanten (y in pt), deren Abstand zur nächsten Linie des 5-Minuten-Rasters grösser als tolPt ist (§9 Nr 4):
 * Linien bei t ≡ 0 (mod 5), y(t) = yTop + (t − fromMin) · ptPerMinute; Eingabereihenfolge, Duplikate bleiben.
 */
export function edgesOffTime(
  edges: number[],
  scale: { yTop: number; ptPerMinute: number; fromMin: number },
  tolPt: number,
): number[] {
  return edges.filter((y) => {
    const minute = scale.fromMin + (y - scale.yTop) / scale.ptPerMinute;
    const linie = Math.round(minute / 5) * 5;
    const abstand = Math.abs(y - (scale.yTop + (linie - scale.fromMin) * scale.ptPerMinute));
    return abstand > tolPt;
  });
}
