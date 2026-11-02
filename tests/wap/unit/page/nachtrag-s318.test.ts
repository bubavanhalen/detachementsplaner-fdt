// @vitest-environment jsdom
// Paket E1-02e: Pflichtfälle nach Vertrag E1-02e Notiz S3-18 und S3-19 (d) sowie R-10-37 nach S3-19 (Q-032
// Option A, bestätigt an Gate S (S-2); Stand nach Gate-S-Auflage A2 (E1-02j), Liste nach Vertrag E1-02j
// Abschnitt 5). Seitenmodell (`fallbacks` und Kopfzeilen sind Rückgabewerte, H1 gilt nicht; S3-19).
// Pseudonymisierte KVK-Fixture; die Variante ändert nur das Gewicht einer Spalte.
import { describe, expect, it } from 'vitest';
import type { ColumnGeometry, DayGeometry } from '../../../../src/model/wap/layout/grid/types';
import type {
  PageFallbackEvent,
  WeekPageLayout,
} from '../../../../src/model/wap/layout/page/types';
import type { PageModel, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { leseBkp } from '../../support/page/bkp';
import { seite } from '../../support/page/seite';
import { strichAus } from '../../support/page/stile';
import { KVK_TAGE, KVK_WOCHE, kvk, SA, SO } from '../../support/page/varianten';

const ELLIPSE = String.fromCodePoint(0x2026);
const INSET = 0.5;

/** KVK mit Gewicht 'wide' für die Planungsspalte c23 im Spaltensatz s22 (Sa, So kompakt; S3-19 (d)). */
function breitPlan(): Plan {
  const p = kvk();
  return {
    ...p,
    columnSets: p.columnSets.map((s) =>
      s.id === 's22'
        ? {
            ...s,
            columns: s.columns.map((c) => (c.id === 'c23' ? { ...c, weight: 'wide' as const } : c)),
          }
        : s,
    ),
  };
}

function tagVon(L: WeekPageLayout, date: string): DayGeometry {
  const d = L.grid.days.find((x) => x.date === date);
  expect(d, `Tag ${date} sichtbar`).toBeDefined();
  return d as DayGeometry;
}

function spalteVon(d: DayGeometry, id: string): ColumnGeometry {
  const c = d.columns.find((x) => x.columnId === id);
  expect(c, `Spalte ${id} am ${d.date}`).toBeDefined();
  return c as ColumnGeometry;
}

/** Kopfzeilen (Art columnHead) eines Tags, deren Mitte waagrecht in der Spalte liegt. */
function koepfe(L: WeekPageLayout, date: string, c: ColumnGeometry): TextItem[] {
  return L.texts
    .filter((r) => r.kind === 'columnHead' && r.date === date)
    .map((r) => (L.pages[r.page] as PageModel).items[r.item] as TextItem)
    .filter((t) => {
      const m = t.rotation === 0 ? t.x + measureRuns(t.runs, t.sizePt) / 2 : t.x;
      return m > c.x && m < c.x + c.w;
    });
}

const gleich = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol + 1e-9;

describe('Rap-Kopf in sehr schmaler Spalte (S3-18 Schritt 3; S3-19 (d))', () => {
  it('[R-4.4-08] (V-02e-16; E1-02l R1, Entscheid 14.10.2026) KVK mit c23 «wide»: Rap-Spalte c24 6,393 pt passt weder waagrecht noch senkrecht → an Sa und So Kopf «Rap» vollständig fett in 4,5 pt, rotation 0, über der Spalte zentriert, je ein Ereignis tooManyColumns/gridHead/c24 mit Spaltensatz s22; Beso «Bes» ohne Ereignis', () => {
    const L = seite(breitPlan(), KVK_WOCHE);
    const d = leseBkp();
    // Grenzstriche der Rap-Spalte: Rap-Trennlinie links (B-Kp-40), Spaltengrenze rechts (B-Kp-39).
    const striche = strichAus(d, 'B-Kp-40').breite + strichAus(d, 'B-Kp-39').breite;
    const S = kpTemplate().fontSizes.standard;
    const min = kpTemplate().fontSizes.min;
    const rap = [{ text: 'Rap', weight: 'bold' as const }];
    // Vorbedingungen (S3-19 (d), Spike rap-schmal): gerechnet aus layout.grid.days, ± 0,01.
    for (const date of [SA, SO]) {
      const c = spalteVon(tagVon(L, date), 'c24');
      expect(c.kind).toBe('rap');
      expect(gleich(c.w, 6.393, 0.01), `Breite c24 am ${date}: ${c.w}`).toBe(true);
      const nutz = c.w - 2 * INSET - striche / 2;
      expect(gleich(nutz, 5.093, 0.01), `Nutzbreite ${nutz}`).toBe(true);
      expect(gleich(measureRuns(rap, S), 9.446, 0.01)).toBe(true);
      expect(measureRuns(rap, S)).toBeGreaterThan(nutz);
      expect(gleich(lineHeightPt(S), 5.75, 0.01)).toBe(true);
      expect(lineHeightPt(S)).toBeGreaterThan(nutz);
      expect(gleich(measureRuns(rap, min), 8.501, 0.01)).toBe(true);
      expect(measureRuns(rap, min)).toBeGreaterThan(nutz);
      const rKurz = measureRuns([{ text: `R${ELLIPSE}`, weight: 'bold' }], min);
      expect(gleich(rKurz, 7.75, 0.01)).toBe(true);
      expect(rKurz).toBeGreaterThan(nutz);
      const nurEllipse = measureRuns([{ text: ELLIPSE, weight: 'bold' }], min);
      expect(gleich(nurEllipse, 4.5, 0.01)).toBe(true);
      expect(nurEllipse).toBeLessThanOrEqual(nutz);
    }
    for (const date of [SA, SO]) {
      const tag = tagVon(L, date);
      const c = spalteVon(tag, 'c24');
      const k = koepfe(L, date, c);
      expect(k.length, `ein Kopf über c24 am ${date}`).toBe(1);
      const t = k[0] as TextItem;
      // E1-02l R1: nie gekürzt – der Kopf steht vollständig (TE-E102l-01).
      expect(t.runs.map((r) => ({ text: r.text, weight: r.weight }))).toEqual([
        { text: 'Rap', weight: 'bold' },
      ]);
      expect(t.sizePt).toBe(min);
      expect(t.rotation).toBe(0);
      expect(
        gleich(
          t.x + measureRuns(t.runs, t.sizePt) / 2,
          (c.x +
            INSET +
            strichAus(d, 'B-Kp-40').breite / 2 +
            (c.x + c.w - INSET - strichAus(d, 'B-Kp-39').breite / 2)) /
            2,
          0.01,
        ),
        `«Rap» am ${date} über der Nutzfläche zentriert (E2)`,
      ).toBe(true);
      const beso = spalteVon(tag, 'c25');
      const b = koepfe(L, date, beso);
      expect(b.length).toBe(1);
      const bt = b[0] as TextItem;
      expect(bt.runs.map((r) => r.text).join('')).toBe('Bes');
      expect(bt.rotation).toBe(0);
      expect(bt.sizePt).toBe(S);
    }
    const kopf = L.fallbacks.filter((e) => e.region === 'gridHead');
    // E1-02l R1: Befund «zu viele Spalten für diesen Tag» am Spaltensatz statt «…» (TE-E102l-01).
    const erwartet = (date: string): PageFallbackEvent => ({
      kind: 'tooManyColumns',
      region: 'gridHead',
      weekId: KVK_WOCHE,
      date,
      entryId: null,
      piece: null,
      dropped: [],
      field: 'columnHead',
      columnId: 'c24',
      columnSetId: 's22',
    });
    expect(kopf).toEqual([erwartet(SA), erwartet(SO)]);
    const iKopf = L.fallbacks.findIndex((e) => e.region === 'gridHead' && e.date === SO);
    const iBlock = L.fallbacks.findIndex((e) => e.region === 'block' || e.region === 'band');
    expect(iBlock).toBeGreaterThan(iKopf);
  });
});

describe('KVK: bestätigte Rückfallliste (R-10-37; S3-19, Q-032 Option A)', () => {
  // F-LAYOUT2 (Entscheid Auftraggeber 19.10.2026 «12: ja», Nebenspalte Gewicht 2): e39 und e50 (Blöcke in «Det»)
  // fassen ihre Ltg; neue Fassung der Liste zur Bestätigung an Gate B (Entscheid 8).
  it('[R-10-37] KVK w26 A4: fallbacks genau die 4 Blockereignisse e33, e34, e43, e54 in dieser Reihenfolge, keine weiteren Ereignisse in irgendeiner Region; eine Seite', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const block = (
      kind: PageFallbackEvent['kind'],
      entryId: string,
      date: string,
      dropped: PageFallbackEvent['dropped'],
    ): PageFallbackEvent => ({
      kind,
      region: 'block',
      weekId: KVK_WOCHE,
      date,
      entryId,
      piece: 0,
      dropped,
      field: null,
      columnId: null,
    });
    const [mo, di] = KVK_TAGE;
    expect(mo).toBe('2026-09-28');
    expect(di).toBe('2026-09-29');
    expect(L.fallbacks).toEqual([
      block('ellipsis', 'e33', '2026-09-28', ['ort']),
      block('lineDropped', 'e34', '2026-09-28', ['ort']),
      block('lineDropped', 'e43', '2026-09-28', ['ort']),
      block('ellipsis', 'e54', '2026-09-29', []),
    ]);
    expect(L.pages.length).toBe(1);
  });
});
