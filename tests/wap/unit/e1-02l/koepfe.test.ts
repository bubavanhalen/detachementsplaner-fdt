// @vitest-environment node
// Paket E1-02l R1 (R-10-54; Auftraggeber 09.10.2026, Reihenfolge nach Entscheid «2 a» vom 14.10.2026): Spaltenköpfe
// nie gekürzt – zuerst waagrecht bis 4,5 pt, senkrecht nur, wenn waagrecht nicht passt; Halt
// sobald passend, Mindestgrösse 4,5 pt; passt es nicht, vollständig im Kopfbereich mit Befund «zu viele Spalten für
// diesen Tag» am Spaltensatz. Fiktive Spalten.
import { describe, expect, it } from 'vitest';
import {
  type ColumnHeadInput,
  headBounds,
  layoutColumnHeads,
} from '../../../../src/model/wap/layout/page/columnHeads';
import type { Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { ColumnSet } from '../../../../src/model/wap/types';
import { alleTage, rasterPlan, satz } from '../../support/grid/build';
import { col } from '../../support/model/builders';
import { seite } from '../../support/page/seite';

const S = 5;
const MIN = 4.5;
const SIZES = { standard: S, min: MIN };

function kopf(name: string, frame: Rect, over: Partial<ColumnHeadInput> = {}): ColumnHeadInput {
  return {
    columnId: `c-${name}`,
    runs: [{ text: name, weight: 'bold' }],
    frame,
    frameV: frame,
    prefer: 'horizontal',
    hyphenate: 'ifWordDoesNotFit',
    ...over,
  };
}

/** Text aller Zeilen ohne eingefügte Trennstriche, ohne Leerraum (Vollständigkeit). */
function inhalt(lines: readonly { readonly runs: readonly { readonly text: string }[] }[]): string {
  return lines
    .map((l) => l.runs.map((r) => r.text).join(''))
    .map((t) => t.replace(/-$/, ''))
    .join('')
    .replace(/\s/g, '');
}

function schneiden(a: Rect, b: Rect): boolean {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0.001 && h > 0.001;
}

const space = (area: Rect) => ({ area, extended: { ...area, h: area.h * 3 }, blocked: [] });

describe('Spaltenkopf in seiner Spalte (R-10-54)', () => {
  it('[R-10-54] passender Kopf: waagrecht in Standardgrösse, vollständig, Ergebnis fits', () => {
    const f = { x: 0, y: 0, w: 40, h: 12 };
    const [h] = layoutColumnHeads([kopf('Kdo', f)], space(f), SIZES);
    expect(h?.result).toBe('fits');
    expect(h?.orientation).toBe('horizontal');
    expect(h?.sizePt).toBe(S);
    expect(inhalt(h?.lines ?? [])).toBe('Kdo');
  });

  it('[R-10-54] (Entscheid «2 a») waagrecht verkleinert vor senkrecht: passt waagrecht in 4,75 pt, senkrecht in 5 pt → waagrecht 4,75 pt', () => {
    const name = 'Zfhr';
    const breit = measureRuns([{ text: name, weight: 'bold' }], S);
    // Breite knapp unter der Standardbreite, aber über der Breite in 4,75 pt; Höhe reicht senkrecht.
    const f = { x: 0, y: 0, w: breit - 0.2, h: breit + 2 };
    expect(measureRuns([{ text: name, weight: 'bold' }], 4.75)).toBeLessThan(f.w);
    const [h] = layoutColumnHeads([kopf(name, f)], space(f), SIZES);
    expect(h?.orientation).toBe('horizontal');
    expect(h?.sizePt).toBe(4.75);
    expect(h?.result).toBe('reduced');
    expect(inhalt(h?.lines ?? [])).toBe(name);
  });

  it('[R-10-54] (Entscheid «2 a») senkrecht erst, wenn waagrecht auch in 4,5 pt nicht passt → senkrecht in Standardgrösse', () => {
    const name = 'Zfhr';
    const breit = measureRuns([{ text: name, weight: 'bold' }], S);
    // Waagrecht zu schmal selbst in 4,5 pt (ein Wort, Silbentrennung reicht nicht); senkrecht lang genug.
    const f = { x: 0, y: 0, w: 6, h: breit + 2 };
    const [h] = layoutColumnHeads([kopf(name, f, { hyphenate: 'never' })], space(f), SIZES);
    expect(h?.orientation).toBe('vertical');
    expect(h?.sizePt).toBe(S);
    expect(inhalt(h?.lines ?? [])).toBe(name);
  });

  it('[R-10-54] verkleinert wird in 0,25-pt-Stufen; Halt bei der ersten passenden Stufe', () => {
    const name = 'Trp';
    const w5 = measureRuns([{ text: name, weight: 'bold' }], S);
    const w475 = measureRuns([{ text: name, weight: 'bold' }], 4.75);
    // Waagrecht passt erst 4,75; senkrecht ist die Fläche zu kurz.
    const f = { x: 0, y: 0, w: (w5 + w475) / 2, h: lineHeightPt(S) + 0.1 };
    const [h] = layoutColumnHeads([kopf(name, f)], space(f), SIZES);
    expect(h?.result).toBe('reduced');
    expect(h?.sizePt).toBe(4.75);
    expect(h?.orientation).toBe('horizontal');
  });

  it('[R-10-54] Mindestgrösse 4,5 pt ist die Untergrenze: keine Zeile darunter, auch im Überlauf', () => {
    const f = { x: 0, y: 0, w: 3, h: 6 };
    const area = { x: 0, y: 0, w: 80, h: 6 };
    const [h] = layoutColumnHeads([kopf('Ausbildung Munition', f)], space(area), SIZES);
    for (const l of h?.lines ?? []) expect(l.sizePt).toBeGreaterThanOrEqual(MIN);
    expect(h?.sizePt).toBe(MIN);
  });

  it('[R-10-54] bevorzugt senkrecht: zuerst senkrecht', () => {
    const f = { x: 0, y: 0, w: 30, h: 30 };
    const [h] = layoutColumnHeads([kopf('Sph', f, { prefer: 'vertical' })], space(f), SIZES);
    expect(h?.orientation).toBe('vertical');
    expect(h?.sizePt).toBe(S);
  });
});

describe('Zu viele Spalten: vollständig statt gekürzt (R-10-54)', () => {
  it('[R-10-54] langer Name in 1-Einheit-Spalte: vollständig in Mindestgrösse, kein «…», Ergebnis overflow, Rahmen umschliesst die Zeilen', () => {
    const area = { x: 0, y: 0, w: 60, h: 12 };
    const heads = [
      kopf('Kdo', { x: 0, y: 0, w: 20, h: 12 }),
      kopf('Ausbildung Munition Detachement', { x: 20.5, y: 0, w: 4, h: 12 }),
      kopf('Rap', { x: 25, y: 0, w: 15, h: 12 }, { hyphenate: 'never' }),
    ];
    const laid = layoutColumnHeads(heads, space(area), SIZES);
    const lang = laid[1];
    expect(lang?.result).toBe('overflow');
    expect(inhalt(lang?.lines ?? [])).toBe('AusbildungMunitionDetachement');
    for (const l of laid) for (const z of l.lines) expect(inhalt([z])).not.toContain('…');
    const b = headBounds(lang?.lines ?? []);
    expect(b).not.toBeNull();
    const fr = lang?.frame as Rect;
    expect((b as Rect).x).toBeGreaterThanOrEqual(fr.x - 0.01);
    expect((b as Rect).x + (b as Rect).w).toBeLessThanOrEqual(fr.x + fr.w + 0.01);
  });

  it('[R-10-54] viele Spalten: alle Köpfe vollständig, kein Kopf überlappt einen anderen', () => {
    const area = { x: 0, y: 0, w: 90, h: 12 };
    const names = [
      'Kdo',
      'Zug 1',
      'Zug 2',
      'Zug 3',
      'Zug 4',
      'Mö',
      'Sph',
      'Trp',
      'Det',
      'Rap',
      'Bes',
    ];
    const w = 90 / names.length;
    const heads = names.map((n, i) =>
      kopf(
        n,
        { x: i * w + 0.5, y: 0, w: w - 1, h: 12 },
        {
          hyphenate: n === 'Rap' || n === 'Bes' ? 'never' : 'ifWordDoesNotFit',
        },
      ),
    );
    const laid = layoutColumnHeads(heads, space(area), SIZES);
    laid.forEach((l, i) => {
      expect(inhalt(l.lines), names[i]).toBe((names[i] as string).replace(/\s/g, ''));
    });
    const boxes = laid.map((l) => headBounds(l.lines)).filter((b): b is Rect => b !== null);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++)
        expect(schneiden(boxes[i] as Rect, boxes[j] as Rect), `${names[i]}/${names[j]}`).toBe(
          false,
        );
  });

  it('[R-10-54] Rap- und Beso-Kopf bleiben einzeilig, auch im Überlauf', () => {
    const area = { x: 0, y: 0, w: 40, h: 12 };
    const [h] = layoutColumnHeads(
      [kopf('Rap', { x: 10, y: 0, w: 2, h: 12 }, { hyphenate: 'never' })],
      space(area),
      SIZES,
    );
    expect(h?.lines).toHaveLength(1);
    expect(inhalt(h?.lines ?? [])).toBe('Rap');
  });
});

/** Satz mit vielen schmalen Spalten (1 Einheit) und langen Namen; alle Tage voll. */
function engerSatz(): ColumnSet {
  const s = satz('s1', [
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `p${String(i)}`,
      kind: 'planning' as const,
      weight: 'narrow' as const,
    })),
    { id: 'rap', kind: 'rap' },
    { id: 'beso', kind: 'beso' },
  ]);
  return {
    ...s,
    columns: s.columns.map((c, i) =>
      c.kind === 'planning'
        ? col(c.id, `Ausbildungszug ${String(i + 1)}`, 'planning', { weight: 'narrow' })
        : c,
    ),
  };
}

describe('Wochenseite: Befund am Spaltensatz (R-10-54)', () => {
  it('[R-10-54] Seite mit zu vielen Spalten: je Tag ein Ereignis tooManyColumns mit Datum, Spalte und Spaltensatz; kein «…» und kein Wegfall bei Spaltenköpfen', () => {
    const plan = rasterPlan({ sets: [engerSatz()], tage: alleTage('s1', 'full') });
    const L = seite(plan, 'w26');
    const ev = L.fallbacks.filter((e) => e.field === 'columnHead');
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.kind).toBe('tooManyColumns');
      expect(e.region).toBe('gridHead');
      expect(e.date).not.toBeNull();
      expect(e.columnSetId).toBe('s1');
    }
    expect(new Set(ev.map((e) => e.date)).size).toBe(ev.length);
    const koepfe = (L.pages[0]?.items ?? []).filter(
      (i): i is TextItem => i.kind === 'text' && i.role === 'columnHeader',
    );
    for (const t of koepfe) expect(t.runs.map((r) => r.text).join('')).not.toContain('…');
    // Vollständig: je Tag jeder Name als Folge seiner Zeilen.
    const text = koepfe.map((t) => t.runs.map((r) => r.text).join('')).join('|');
    for (let i = 1; i <= 9; i++)
      expect(text.replace(/-\|/g, '').replace(/\|/g, ' ')).toContain(String(i));
    for (const t of koepfe) expect(t.sizePt).toBeGreaterThanOrEqual(MIN);
  });

  it('[R-10-54] passende Spaltensätze erzeugen kein Ereignis', () => {
    const plan = rasterPlan({ tage: alleTage() });
    const L = seite(plan, 'w26');
    expect(L.fallbacks.filter((e) => e.kind === 'tooManyColumns')).toEqual([]);
  });
});
