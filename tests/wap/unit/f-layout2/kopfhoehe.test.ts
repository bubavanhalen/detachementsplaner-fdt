// @vitest-environment node
// Paket F-LAYOUT2, Entscheid Auftraggeber 19.10.2026 «11: ja» (Q-HL-01; R-10-54; Beschrieb 10 «Raster»,
// «Schrift»): Passt ein Spaltenkopf in Mindestgrösse nicht in den Kopfbereich, wächst die Kopfzeile der Woche
// einheitlich für alle Tage, bis kein Kopf mehr ins Band oder ins Raster ragt; das Raster beginnt tiefer. Wochen ohne
// zu lange Köpfe behalten die Standardhöhe. Fiktive Spaltennamen aus drei Wörtern in Spalten von rund 13,7 pt
// (wie die Zug-Wochen der Referenz).
import { describe, expect, it } from 'vitest';
import { textBounds } from '../../../../src/model/wap/layout/entries/outsideLabel';
import { pageFrame, pageGeometryFor } from '../../../../src/model/wap/layout/page/geometry';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import type { ColumnSet, Plan } from '../../../../src/model/wap/types';
import { rasterPlan, satz, WOCHE, WOCHE2 } from '../../support/grid/build';
import { col } from '../../support/model/builders';
import { seite } from '../../support/page/seite';

/** Fiktive Spaltennamen aus drei Wörtern (Muster «‹Einheit› ‹Zug› ‹Ort›»). */
const LANG = [
  'Zug Alpha Nord',
  'Zug Bravo Süd',
  'Det Charlie Ost',
  'Det Delta West',
  'Gruppe Echo Mitte',
  'Gruppe Fox Rand',
];
const KURZ = ['Kdo', 'Mö', 'Sph', 'Uof', 'Trp', 'Kp'];

/** Spaltensatz mit sechs Planungsspalten, Nebenspalte, Rap und Beso (Gewichte 12 + Neben + 1 + 2). */
function satzMit(id: string, namen: readonly string[]): ColumnSet {
  const s = satz(id, [
    ...namen.map((_, i) => ({ id: `${id}p${String(i)}`, kind: 'planning' as const })),
    { id: `${id}n`, kind: 'secondary' as const },
    { id: `${id}r`, kind: 'rap' as const },
    { id: `${id}b`, kind: 'beso' as const },
  ]);
  return {
    ...s,
    columns: s.columns.map((c, i) =>
      c.kind === 'planning'
        ? col(c.id, namen[i] as string, 'planning')
        : c.kind === 'secondary'
          ? col(c.id, 'Det', 'secondary')
          : c,
    ),
  };
}

const wochenende = (): ColumnSet => {
  const s = satz('sw', [
    { id: 'swp', kind: 'planning' },
    { id: 'swr', kind: 'rap' },
    { id: 'swb', kind: 'beso' },
  ]);
  return {
    ...s,
    columns: s.columns.map((c) => (c.kind === 'planning' ? col(c.id, 'Kp', 'planning') : c)),
  };
};

/** Woche w26: Mo–Fr voll mit langen Köpfen (nur Mo und Di) bzw. kurzen; w27: überall kurze Köpfe. */
function plan(): Plan {
  const tage = (lang: boolean) =>
    (['full', 'full', 'full', 'full', 'full', 'compact', 'compact'] as const).map((display, i) => ({
      set: i >= 5 ? 'sw' : lang && i < 2 ? 'sl' : 'sk',
      display,
    }));
  return rasterPlan({
    sets: [satzMit('sl', LANG), satzMit('sk', KURZ), wochenende()],
    tage: tage(true),
    tage2: tage(false),
  });
}

const koepfe = (items: readonly { kind: string }[]): TextItem[] =>
  items.filter((i): i is TextItem => i.kind === 'text' && (i as TextItem).role === 'columnHeader');

const zeile = (t: TextItem): string => t.runs.map((r) => r.text).join('');

describe('F-LAYOUT2 Punkt 11: Kopfzeile wächst einheitlich je Woche (Q-HL-01)', () => {
  it('[R-10-54] Voraussetzung: die langen Köpfe liegen in Spalten von rund 13,7 pt', () => {
    const L = seite(plan(), WOCHE);
    const mo = L.grid.days[0];
    const planung = (mo?.columns ?? []).filter((c) => c.kind === 'planning');
    expect(planung).toHaveLength(6);
    for (const c of planung) {
      expect(c.w).toBeGreaterThan(12.5);
      expect(c.w).toBeLessThan(14.5);
    }
  });

  it('[R-10-54] drei Wörter in 13,7-pt-Spalten: kein Spaltenkopf ragt ins Band oder ins Raster, alle vollständig und ≥ 4,5 pt', () => {
    const p = plan();
    const L = seite(p, WOCHE);
    const liste = koepfe(L.pages[0]?.items ?? []);
    const yBand = L.grid.timeScale.yTop;
    expect(liste.length).toBeGreaterThan(0);
    for (const t of liste) {
      const b = textBounds(t);
      expect(b.y + b.h, zeile(t)).toBeLessThanOrEqual(yBand + 1e-6);
      expect(t.sizePt).toBeGreaterThanOrEqual(4.5);
    }
    const mo = L.grid.days[0]?.date;
    const montag = liste.filter((t) => {
      const b = textBounds(t);
      const d = L.grid.days[0];
      return (
        d !== undefined && mo !== undefined && b.x >= d.x - 1e-6 && b.x + b.w <= d.x + d.w + 1e-6
      );
    });
    const text = montag.map(zeile).join(' ').replace(/-\s/g, '');
    for (const name of LANG) for (const wort of name.split(' ')) expect(text).toContain(wort);
  });

  it('[R-10-54] die Kopfzeile ist höher als die Standardhöhe, das Raster beginnt tiefer; Rasterrahmen und Seite bleiben', () => {
    const p = plan();
    const geometry = pageGeometryFor('kp');
    const standard = pageFrame(geometry, p, WOCHE2);
    const L = seite(p, WOCHE);
    expect(L.frame.grid.columnHeaderHeightPt).toBeGreaterThan(
      standard.grid.columnHeaderHeightPt + 0.5,
    );
    expect(L.grid.timeScale.yTop).toBeGreaterThan(seite(p, WOCHE2).grid.timeScale.yTop + 0.5);
    expect(L.frame.grid.rect).toEqual(standard.grid.rect);
    expect(L.frame.agenda).toEqual(standard.agenda);
    expect(L.grid.timeScale.yTop).toBeCloseTo(
      L.frame.grid.rect.y + L.frame.grid.dayHeaderHeightPt + L.frame.grid.columnHeaderHeightPt,
      6,
    );
  });

  it('[R-10-54] einheitlich für die ganze Woche: Spaltenköpfe aller Tage liegen in derselben Kopfzeile, auch an Tagen mit kurzen Köpfen', () => {
    const L = seite(plan(), WOCHE);
    const yKopf = L.frame.grid.rect.y + L.frame.grid.dayHeaderHeightPt;
    const yBand = L.grid.timeScale.yTop;
    for (const t of koepfe(L.pages[0]?.items ?? [])) {
      const b = textBounds(t);
      expect(b.y, zeile(t)).toBeGreaterThanOrEqual(yKopf - 1e-6);
      expect(b.y + b.h, zeile(t)).toBeLessThanOrEqual(yBand + 1e-6);
    }
    // Linien der Spaltengrenzen reichen bis zur gemeinsamen Rasteroberkante; die Rasterbegrenzung oben liegt dort.
    const rasterOben = (L.pages[0]?.items ?? []).filter(
      (i) =>
        i.kind === 'line' &&
        i.role === 'gridLine' &&
        Math.abs(i.y1 - yBand) < 1e-6 &&
        Math.abs(i.y2 - yBand) < 1e-6 &&
        i.x2 - i.x1 > 300,
    );
    expect(rasterOben.length).toBeGreaterThanOrEqual(1);
  });

  it('[R-10-54] passt nach dem Wachsen jeder Kopf in seine Spalte, entfällt der Befund «zu viele Spalten für diesen Tag»', () => {
    const L = seite(plan(), WOCHE);
    expect(L.fallbacks.filter((f) => f.kind === 'tooManyColumns').map((f) => f.date)).toEqual([]);
  });

  it('[R-10-54] Woche ohne zu lange Köpfe: Standardhöhe unverändert (gleicher Rahmen wie pageFrame)', () => {
    const p = plan();
    const L = seite(p, WOCHE2);
    expect(L.frame).toEqual(pageFrame(pageGeometryFor('kp'), p, WOCHE2));
  });
});
