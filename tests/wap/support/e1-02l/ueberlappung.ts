// Paket E1-02l (R-14.3-04): Überlappungen einer Wochenseite zählen und klassifizieren (Auftraggeber R3,
// 09.10.2026; Beschrieb 4.6 «Überdeckung und Ausnahmen», «Beso im Detail», Marker). Unabhängig vom Layout: nur
// das Seitenmodell (Flächen, Linien, Texte in Zeichenreihenfolge) und die Schriftmetrik.

import type {
  PageItem,
  PageModel,
  Rect,
  TextItem,
} from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';

/** Rollen der Einträge im Raster. */
const EINTRAG = new Set(['block', 'rapport', 'besoBox', 'querbalken', 'marker']);
/** Rollen der Texte im Raster und in den Köpfen. */
const RASTERTEXT = new Set([...EINTRAG, 'columnHeader', 'dayHeader', 'timeAxis']);
/** Mindestüberdeckung in pt je Richtung (wie R-14.3-01, > 0,001 pt). */
const EPS = 0.001;

export type Gewollt =
  | 'besoUeberBlock'
  | 'markerUeberEintrag'
  | 'beschriftungUeberBlock'
  | 'querbalkenBand';
export type Fehler =
  | 'flaecheUeberFlaeche'
  | 'textUeberText'
  | 'textVerdeckt'
  | 'textAufFremderFlaeche';

export interface Fund {
  readonly art: Gewollt | Fehler;
  readonly a: number;
  readonly b: number;
  readonly text: string;
}

export interface Klassifizierung {
  readonly gewollt: readonly Fund[];
  readonly fehler: readonly Fund[];
  /** Einträge mit mehreren Teilflächen (Aussparung, Beschrieb 4.6); gewollt, ohne Überdeckung. */
  readonly aussparungen: number;
}

interface Element {
  readonly index: number;
  readonly item: PageItem;
  readonly rect: Rect;
  readonly entryId: string | null;
  readonly role: string;
}

function schnitt(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > EPS && h > EPS;
}

function enthaelt(aussen: Rect, innen: Rect, tol = 0.01): boolean {
  return (
    innen.x >= aussen.x - tol &&
    innen.y >= aussen.y - tol &&
    innen.x + innen.w <= aussen.x + aussen.w + tol &&
    innen.y + innen.h <= aussen.y + aussen.h + tol
  );
}

/** Umriss einer Zeile aus Vorschub, Ober- und Unterlänge (hhea), je nach Drehung. */
export function textUmriss(t: TextItem): Rect {
  const m = fontMetrics();
  const asc = (m.ascender * t.sizePt) / m.unitsPerEm;
  const desc = (-m.descender * t.sizePt) / m.unitsPerEm;
  const w = t.runs.reduce(
    (s, r) => s + measureRuns([{ text: r.text, weight: r.weight }], t.sizePt),
    0,
  );
  if (t.rotation === 0) return { x: t.x, y: t.baselineY - asc, w, h: asc + desc };
  if (t.rotation === 90) return { x: t.x - asc, y: t.baselineY - w, w: asc + desc, h: w };
  return { x: t.x - desc, y: t.baselineY, w: asc + desc, h: w };
}

function zeile(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

function elemente(page: PageModel): { flaechen: Element[]; texte: Element[] } {
  const flaechen: Element[] = [];
  const texte: Element[] = [];
  page.items.forEach((item, index) => {
    const entryId = item.entryId ?? null;
    if (item.kind === 'text' && RASTERTEXT.has(item.role)) {
      texte.push({ index, item, rect: textUmriss(item), entryId, role: item.role });
    } else if (item.kind === 'rect' && item.fill !== null && EINTRAG.has(item.role)) {
      flaechen.push({ index, item, rect: item.rect, entryId, role: item.role });
    } else if (item.kind === 'line' && item.role === 'marker' && item.y1 === item.y2) {
      const d = item.stroke.widthPt / 2;
      const x = Math.min(item.x1, item.x2);
      flaechen.push({
        index,
        item,
        rect: { x, y: item.y1 - d, w: Math.abs(item.x2 - item.x1), h: 2 * d },
        entryId,
        role: 'marker',
      });
    }
  });
  return { flaechen, texte };
}

/** Beschriftungsträger ausserhalb des Kästchens: weisse Fläche eines Kästchens (E1-02l R2). */
function istTraeger(e: Element): boolean {
  if (e.item.kind !== 'rect' || e.item.fill === null) return false;
  const f = e.item.fill;
  return (
    (e.role === 'besoBox' || e.role === 'rapport') && f.r === 255 && f.g === 255 && f.b === 255
  );
}

function flaechenArt(unten: Element, oben: Element): Gewollt | Fehler {
  if (oben.role === 'marker' || unten.role === 'marker') return 'markerUeberEintrag';
  if (oben.role === 'querbalken' && unten.role === 'querbalken') return 'flaecheUeberFlaeche';
  if (istTraeger(oben) && unten.role === 'block') return 'beschriftungUeberBlock';
  if (oben.role === 'besoBox' && unten.role === 'block') return 'besoUeberBlock';
  return 'flaecheUeberFlaeche';
}

const GEWOLLT: ReadonlySet<string> = new Set([
  'besoUeberBlock',
  'markerUeberEintrag',
  'beschriftungUeberBlock',
  'querbalkenBand',
]);

/** Klassifiziert alle Überdeckungen von Flächen und Texten der Seite (nur Raster und Köpfe). */
export function klassifiziere(page: PageModel): Klassifizierung {
  const { flaechen, texte } = elemente(page);
  const gewollt: Fund[] = [];
  const fehler: Fund[] = [];
  const melde = (art: Gewollt | Fehler, a: Element, b: Element, text: string): void => {
    (GEWOLLT.has(art) ? gewollt : fehler).push({ art, a: a.index, b: b.index, text });
  };
  for (let i = 0; i < flaechen.length; i++) {
    for (let j = i + 1; j < flaechen.length; j++) {
      const a = flaechen[i] as Element;
      const b = flaechen[j] as Element;
      if (a.entryId !== null && a.entryId === b.entryId) continue;
      if (!schnitt(a.rect, b.rect)) continue;
      const [unten, oben] = a.index < b.index ? [a, b] : [b, a];
      melde(flaechenArt(unten, oben), unten, oben, `${unten.role}/${oben.role}`);
    }
  }
  for (let i = 0; i < texte.length; i++) {
    for (let j = i + 1; j < texte.length; j++) {
      const a = texte[i] as Element;
      const b = texte[j] as Element;
      if (schnitt(a.rect, b.rect)) {
        melde(
          'textUeberText',
          a,
          b,
          `«${zeile(a.item as TextItem)}» / «${zeile(b.item as TextItem)}»`,
        );
      }
    }
  }
  for (const t of texte) {
    const eigene = flaechen.filter((f) => f.entryId !== null && f.entryId === t.entryId);
    for (const f of flaechen) {
      if (f.entryId !== null && f.entryId === t.entryId) continue;
      if (!schnitt(t.rect, f.rect)) continue;
      const text = `«${zeile(t.item as TextItem)}» ${t.role} / ${f.role}`;
      if (f.index > t.index) {
        melde('textVerdeckt', f, t, text);
        continue;
      }
      // Eigene Fläche über der fremden trägt den Text: keine Überdeckung des Texts.
      const getragen = eigene.some((o) => o.index > f.index && enthaelt(o.rect, t.rect));
      if (!getragen) melde('textAufFremderFlaeche', f, t, text);
    }
  }
  const teile = new Map<string, number>();
  for (const f of flaechen) {
    if (f.entryId === null || f.role !== 'block') continue;
    teile.set(f.entryId, (teile.get(f.entryId) ?? 0) + 1);
  }
  const aussparungen = [...teile.values()].filter((n) => n > 1).length;
  return { gewollt, fehler, aussparungen };
}

/** Anzahl je Art. */
export function zaehle(funde: readonly Fund[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of funde) out[f.art] = (out[f.art] ?? 0) + 1;
  return out;
}
