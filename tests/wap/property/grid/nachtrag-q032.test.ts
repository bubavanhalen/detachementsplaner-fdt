// @vitest-environment jsdom
// Paket E1-02d: Testnachtrag zur Änderungsnotiz «Q-032 Ausrichtung» (Vertrag E1-02d, Stand Runde 2), Properties
// [R-6-02] (A3 in sechs Stufen mit Umbruchschranke U und F-23-Ausnahme), [R-4.6-44] (A5: einzeilige Texte
// waagrecht) und [R-7-07] (A9: Ausweichen bis zur äusseren Strichkante; Bezug R-4.6-54 von E1-02e). Zufällige fiktive Wochen mit festem
// Startwert (ADR-010 §5); Titel, Zusatz, Ltg, Ort, Tn und Tenue des Generators enthalten kein «-».
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  EntryPiece,
  FallbackEvent,
  GridLayout,
} from '../../../../src/model/wap/layout/grid/types';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { breakText } from '../../../../src/model/wap/layout/text/break';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { fontMetrics, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { formatTimeSpec } from '../../../../src/model/wap/time';
import type { Block } from '../../../../src/model/wap/types';
import {
  GRID_RUNS,
  GRID_SEED,
  type ZufallsWoche,
  zufallsWoche,
} from '../../support/arbitraries/grid';
import { GROESSE, LINIEN, lege, texteIn, zeilenText } from '../../support/grid/build';
import { withEntries } from '../../support/model/builders';

const OPTIONEN = { seed: GRID_SEED, numRuns: GRID_RUNS } as const;

const lay = (w: ZufallsWoche, plan: ZufallsWoche['plan'] = w.plan): GridLayout =>
  lege(plan, { W: w.raster.W, ppm: w.raster.ppm });

// ---------------------------------------------------------------------------------------------------------
// [R-6-02]: Kennzahlen nach A2 aus der Ausgabe eines Laufs
// ---------------------------------------------------------------------------------------------------------

/** Ausgabe eines Laufs für ein Teilstück: Zeilen, Ereignisse (mit `piece` = Index) und Teilstück. */
interface Ausgabe {
  readonly texte: readonly TextItem[];
  readonly ereignisse: readonly FallbackEvent[];
  readonly teil: EntryPiece;
}

function ausgabe(L: GridLayout, id: string, index: number): Ausgabe {
  const g = L.entries.find((e) => e.entryId === id);
  const teil = g?.pieces[index];
  expect(teil, `${id} Teilstück ${index}`).toBeDefined();
  const p = teil as EntryPiece;
  return {
    texte: texteIn(L, id, p.rect),
    ereignisse: L.fallbacks.filter((f) => f.entryId === id && f.piece === index),
    teil: p,
  };
}

/**
 * Zahl der Zeilen der Zeitzeile wie E1-02e S3-9: kleinstes k ≥ 1, sodass die getrimmten Texte der ersten k Zeilen
 * aneinandergereiht und ohne Leerzeichen `formatTimeSpec(time, date)` ergeben; gibt es keines, 0.
 */
function zeitzeilen(z: readonly TextItem[], e: Block): number {
  const soll = formatTimeSpec(e.time, e.date).replace(/\s/gu, '');
  let s = '';
  for (let k = 1; k <= z.length; k++) {
    s += zeilenText(z[k - 1] as TextItem)
      .trim()
      .replace(/\s/gu, '');
    if (s === soll) return k;
    if (!soll.startsWith(s)) return 0;
  }
  return 0;
}

interface Kennzahlen {
  readonly klasse: number;
  readonly L: number;
  readonly d: number;
  readonly k: number;
  readonly t: number;
  readonly U: number;
}

/** Klasse, L, d, k, t und U nach A2 und Notiz «Property [R-6-02]», am Teilstück abgelesen. */
function kennzahlen(a: Ausgabe, e: Block): Kennzahlen {
  expect(a.ereignisse.length, 'höchstens ein Ereignis je Textträger').toBeLessThanOrEqual(1);
  const ev = a.ereignisse[0];
  if (ev !== undefined) expect(['lineDropped', 'ellipsis', 'textOmitted']).toContain(ev.kind);
  const klasse = ev === undefined || ev.kind === 'lineDropped' ? 0 : ev.kind === 'ellipsis' ? 1 : 2;
  const dropped = ev?.dropped ?? [];
  const nz = zeitzeilen(a.texte, e);
  const rest = a.texte.slice(nz);
  const L = klasse === 0 ? dropped.length : 0;
  // d = (blockTitle − grösstes sizePt) / 0,25; in Klasse 0 ist der Titel immer gezeigt.
  const d =
    klasse === 0 ? (GROESSE.blockTitle - Math.max(...a.texte.map((x) => x.sizePt))) / 0.25 : 0;
  // k: Codepunkte ohne Leerraum vor «…» (Titel enthalten kein «-»; ein eingefügter Trennstrich zählt nicht).
  const k =
    klasse === 1
      ? rest
          .map((x) => [...zeilenText(x)].filter((c) => !/[\s…-]/u.test(c)).length)
          .reduce((p, q) => p + q, 0)
      : 0;
  // t: Zeilen ausser der Zeitzeile, die auf «-» enden.
  const t = rest.filter((x) => zeilenText(x).endsWith('-')).length;
  // U = Zeilen − gezeigte Absätze (A2).
  let absaetze = 0;
  if (klasse === 0) {
    const weg = new Set<string>(dropped);
    const da = (s: string, art: string) => s.trim() !== '' && !weg.has(art);
    absaetze =
      (nz > 0 ? 1 : 0) +
      1 +
      (da(e.supplement, 'supplement') ? 1 : 0) +
      (da(e.ltg, 'ltg') || da(e.ort, 'ort') ? 1 : 0) +
      (e.printTn && da(e.tn, 'tn') ? 1 : 0) +
      (e.printTenue && da(e.tenue, 'tenue') ? 1 : 0);
  } else if (klasse === 1) {
    absaetze = (nz > 0 ? 1 : 0) + (rest.some((x) => zeilenText(x).includes('…')) ? 1 : 0);
  }
  return { klasse, L, d, k, t, U: a.texte.length - absaetze };
}

/** Passt der Titel in blockTitle mit Trennung «never» (2e «Passen»)? Länge entlang der Zeile, Stapel quer. */
function titelPasst(e: Block, laenge: number, stapel: number): boolean {
  if (laenge <= 0.01 || stapel <= 0.01) return false;
  const runs = e.title.map((x) => ({
    text: x.text,
    weight: x.bold ? ('bold' as const) : ('regular' as const),
  }));
  const r = breakText(runs, {
    maxWidthPt: laenge,
    sizePt: GROESSE.blockTitle,
    hyphenate: 'never',
  });
  return r.fits && r.lines.length * lineHeightPt(GROESSE.blockTitle) <= stapel + 1e-6;
}

/** F-23-Bedingung (A2) mit breakText auf `frame`: Titel nicht leer, passt waagrecht nicht, senkrecht schon. */
function f23(e: Block, frame: Rect): boolean {
  if (
    e.title
      .map((x) => x.text)
      .join('')
      .trim() === ''
  )
    return false;
  return !titelPasst(e, frame.w, frame.h) && titelPasst(e, frame.h, frame.w);
}

/** Wahl nach A3, Stufen 1–6; true = senkrecht. */
function senkrechtNachA3(W: Kennzahlen, S: Kennzahlen, bedingungF23: boolean): boolean {
  if (W.klasse !== S.klasse) return S.klasse < W.klasse; // 1 Klasse, ohne Schranke
  if (W.L !== S.L) return S.L < W.L && (S.U <= W.U || bedingungF23); // 2 entfallene Arten
  if (W.d !== S.d) return S.d < W.d && S.U <= W.U; // 3 Schrift
  if (W.klasse === 1 && W.k !== S.k) return S.k > W.k; // 4 Inhalt bei «…», ohne Schranke
  return S.t < W.t && S.U <= W.U; // 5 Trennstriche; sonst 6 Gleichstand → waagrecht
}

describe('Ausrichtung «auto» in sechs Stufen (Notiz Q-032 A2, A3)', () => {
  it('[R-6-02] (Notiz Q-032, V-02d-22) zufällige Wochen: jeder Textträger eines Blocks mit «auto» zeigt das Ergebnis der nach A3 gewählten Ausrichtung (Gleichstand: waagrecht)', () => {
    let geprueft = 0;
    let senkrecht = 0;
    let waagrecht = 0;
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const A = lay(w);
        for (const g of A.entries) {
          const e = w.plan.entries[g.entryId];
          if (e?.type !== 'block' || e.textDirection !== 'auto') continue;
          const traeger = g.pieces.flatMap((p, i) => (p.textCarrier ? [i] : []));
          if (traeger.length === 0) continue;
          // Voraussetzung der Notiz: kein «-» in den Texten des Generators.
          for (const s of [
            e.title.map((x) => x.text).join(''),
            e.supplement,
            e.ltg,
            e.ort,
            e.tn,
            e.tenue,
          ]) {
            expect(s.includes('-'), `${g.entryId}: «-» im Text`).toBe(false);
          }
          // Dieselbe Woche zweimal neu gelegt, nur die Textrichtung dieses Blocks übersteuert (A4).
          const mit = (textDirection: Block['textDirection']) =>
            lay(w, withEntries(w.plan, [{ ...e, textDirection }]));
          const H = mit('horizontal');
          const V = mit('vertical');
          for (const i of traeger) {
            const a = ausgabe(A, g.entryId, i);
            const h = ausgabe(H, g.entryId, i);
            const v = ausgabe(V, g.entryId, i);
            // Text beeinflusst keine Geometrie: gleiche Teilstücke in allen drei Läufen.
            expect(h.teil.rect, `${g.entryId}/${i} Fläche waagrecht`).toEqual(a.teil.rect);
            expect(v.teil.rect, `${g.entryId}/${i} Fläche senkrecht`).toEqual(a.teil.rect);
            const kw = kennzahlen(h, e);
            const ks = kennzahlen(v, e);
            const frame = h.texte[0]?.frame ?? v.texte[0]?.frame;
            const bed = frame === undefined ? false : f23(e, frame);
            const nimmSenkrecht = senkrechtNachA3(kw, ks, bed);
            const soll = nimmSenkrecht ? v : h;
            const was = `${g.entryId}/${i} waagrecht ${JSON.stringify(kw)} senkrecht ${JSON.stringify(ks)} F-23 ${bed}`;
            expect(a.teil.textOrientation, was).toBe(soll.teil.textOrientation);
            expect(a.texte, was).toEqual(soll.texte);
            expect(a.ereignisse, was).toEqual(soll.ereignisse);
            geprueft += 1;
            if (nimmSenkrecht) senkrecht += 1;
            else waagrecht += 1;
          }
        }
      }),
      OPTIONEN,
    );
    // Nicht leer: beide Wahlausgänge kommen vor.
    expect(geprueft).toBeGreaterThan(0);
    expect(senkrecht).toBeGreaterThan(0);
    expect(waagrecht).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// [R-4.6-44]: einzeilige Texte waagrecht (A5)
// ---------------------------------------------------------------------------------------------------------

describe('Einzeilige Texte bleiben waagrecht (Notiz Q-032 A5)', () => {
  it('[R-4.6-44] (Notiz Q-032, V-02d-23) zufällige Wochen: alle Texte der Rollen besoBox, marker und querbalken haben Drehung 0', () => {
    let gesehen = 0;
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        for (const t of lay(w).items) {
          if (t.kind !== 'text') continue;
          if (t.role !== 'besoBox' && t.role !== 'marker' && t.role !== 'querbalken') continue;
          expect(t.rotation, `${t.role} «${zeilenText(t)}» (${String(t.entryId)})`).toBe(0);
          gesehen += 1;
        }
      }),
      OPTIONEN,
    );
    expect(gesehen).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// [R-7-07] (A9): kein Textumriss im äusseren Rechteck eines später gezeichneten Hindernisses (A9)
// ---------------------------------------------------------------------------------------------------------

/** Umriss wie `textOutline` (E1-01b) mit den Metriken von fontMetrics(). */
function umriss(t: TextItem): Rect {
  const m = fontMetrics();
  const oben = (m.ascender * t.sizePt) / m.unitsPerEm;
  const unten = (m.descender * t.sizePt) / m.unitsPerEm;
  const w = measureRuns(
    t.runs.map((x) => ({ text: x.text, weight: x.weight })),
    t.sizePt,
  );
  switch (t.rotation) {
    case 90:
      return { x: t.x - oben, y: t.baselineY - w, w: oben - unten, h: w };
    case 270:
      return { x: t.x + unten, y: t.baselineY, w: oben - unten, h: w };
    default:
      return { x: t.x, y: t.baselineY - oben, w, h: oben - unten };
  }
}

/** Kleinere der Überlappungen in x und y (≤ 0 = kein Schnitt). */
function ueberdeckung(a: Rect, c: Rect): number {
  const x = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
  const y = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
  return Math.min(x, y);
}

/** Hindernis eines Tages mit äusserem Rechteck und Index seines ersten Items. */
interface Hindernis {
  readonly id: string;
  readonly date: string;
  readonly r: Rect;
  readonly art: 'markerField' | 'markerLine' | 'besoBox';
  readonly ab: number;
}

/** Äusseres Rechteck eines gerahmten Hindernisses (A9): auf jeder Seite um die halbe Strichbreite grösser. */
const aussen = (r: Rect, strich: number): Rect => ({
  x: r.x - strich / 2,
  y: r.y - strich / 2,
  w: r.w + strich,
  h: r.h + strich,
});

describe('Ausweichen bis zur äusseren Strichkante (Notiz Q-032 A9)', () => {
  it('[R-7-07] (Notiz Q-032 A9, E1-02d-AV-01) zufällige Wochen: kein Umriss eines Block- oder Beso-Nummern-Texts schneidet das äussere Rechteck eines später gezeichneten Marker-Felds, einer Marker-Linie oder (Blocktext) eines Beso-Kästchens desselben Tages um mehr als 0,001 pt', () => {
    let geprueft = 0;
    fc.assert(
      fc.property(zufallsWoche(), (w) => {
        const L = lay(w);
        // Index des ersten Items je Eintrag: «später gezeichnet» nach der Reihenfolge der items (2f).
        const ersterIndex = new Map<string, number>();
        L.items.forEach((it, i) => {
          if (it.entryId !== undefined && !ersterIndex.has(it.entryId))
            ersterIndex.set(it.entryId, i);
        });
        const hindernisse = L.entries.flatMap((g) =>
          g.pieces.flatMap((p): Hindernis[] => {
            const ab = ersterIndex.get(g.entryId) ?? -1;
            if (p.kind === 'markerField') {
              const r = aussen(p.rect, LINIEN.markerFieldBorder.widthPt);
              return [{ id: g.entryId, date: p.date, r, art: p.kind, ab }];
            }
            // Marker-Linie: rect ist schon das Strichband (A9).
            if (p.kind === 'markerLine') {
              return [{ id: g.entryId, date: p.date, r: p.rect, art: p.kind, ab }];
            }
            if (p.kind === 'besoBox') {
              const r = aussen(p.rect, LINIEN.besoBoxBorder.widthPt);
              return [{ id: g.entryId, date: p.date, r, art: p.kind, ab }];
            }
            return [];
          }),
        );
        L.items.forEach((t, i) => {
          if (t.kind !== 'text' || (t.role !== 'block' && t.role !== 'besoBox')) return;
          const g = L.entries.find((x) => x.entryId === t.entryId);
          const teil = g?.pieces.find(
            (p) =>
              t.frame.x >= p.rect.x - 0.01 &&
              t.frame.y >= p.rect.y - 0.01 &&
              t.frame.x + t.frame.w <= p.rect.x + p.rect.w + 0.01 &&
              t.frame.y + t.frame.h <= p.rect.y + p.rect.h + 0.01,
          );
          expect(teil, `Teilstück zu «${zeilenText(t)}»`).toBeDefined();
          if (teil === undefined) return;
          const u = umriss(t);
          for (const h of hindernisse) {
            if (h.id === t.entryId || h.date !== teil.date || h.ab <= i) continue;
            if (h.art === 'besoBox' && t.role !== 'block') continue;
            expect(
              ueberdeckung(u, h.r),
              `«${zeilenText(t)}» (${String(t.entryId)}) schneidet ${h.art} von ${h.id}`,
            ).toBeLessThanOrEqual(0.001);
            geprueft += 1;
          }
        });
      }),
      OPTIONEN,
    );
    expect(geprueft).toBeGreaterThan(0);
  });
});
