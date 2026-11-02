// @vitest-environment node
// F-UX2 P1 (Entscheid «Bildschirm: ja» 19.10.2026; CR-H-U-02, CR-H-U-03; Beschrieb 5, R-5-01, R-5-02; Leitplanke 2,
// ADR-004): Das Editor-Raster ist die PDF-Seite, nur gleichmässig skaliert. Umbrüche und Lagen jeder Blockzeile am
// Bildschirm = PDF-Layout derselben Woche, bei 50 %, 100 %, 200 % und «Einpassen» (zwei Fenstergrössen). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { dayViews, querbalkenLanes } from '../../../../src/components/wap/i2/entryViews';
import {
  type DayBox,
  dayBoxes,
  type PageBasis,
  pageBasis,
  pageFactor,
  pageScaleOf,
  type Scale,
  type ZoomSetting,
} from '../../../../src/components/wap/i2/geometry';
import { layoutViews, screenFactor } from '../../../../src/components/wap/i2/layoutViews';
import { addDays } from '../../../../src/model/wap/calendar';
import { layoutGrid } from '../../../../src/model/wap/layout/grid/layout';
import { pageFrame, pageGeometryFor } from '../../../../src/model/wap/layout/page/geometry';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import { builtInTemplates, templateById } from '../../../../src/model/wap/template';
import type { Entry, Plan } from '../../../../src/model/wap/types';
import {
  basePlan,
  block,
  days as dayConfigs,
  rt,
  week,
  withEntries,
} from '../../support/model/builders';

const MO = '2026-09-28';
const DI = '2026-09-29';
const MI = '2026-09-30';
const TITEL = [
  'Theorie Kartenlesen',
  'Fahrschule Lastwagen',
  'Sanitätsdienst Grundausbildung',
  'Wachtdienst und Postenablösung',
  'Gefechtsschiessen Gruppe',
  'Unterhalt Material und Fahrzeuge',
  'Ausbildung Funkgerät SE-235',
  'Instruktion Schutzmaske',
];

function range(from: number, to: number) {
  return { form: 'range', from, to } as const;
}

/** Fiktive Woche: Blöcke in Planungs- und Nebenspalte, über mehrere Spalten, Sa/So kompakt. */
function plan(): Plan {
  const p = basePlan({
    id: 'fux2-paritaet',
    weeks: [
      week('w26', MO, {
        days: ((d) =>
          [
            d[0],
            d[1],
            d[2],
            d[3],
            d[4],
            { ...d[5], display: 'compact' },
            { ...d[6], display: 'compact' },
          ] as const)(dayConfigs(['s7', 's39', 's16', 's16', 's16', 's22', 's22'])),
      }),
    ],
  });
  const entries: Entry[] = TITEL.map((t, i) =>
    block(`b${String(i)}`, i + 1, {
      date: i < 4 ? MO : i < 6 ? DI : MI,
      title: rt(t, true),
      supplement: `Zusatz Kurs ${String(i)}`,
      ort: 'Halle Nord',
      time: range(420 + (i % 4) * 150, 540 + (i % 4) * 150),
      columns: {
        kind: 'ids',
        ids:
          i < 4
            ? ([['c8'], ['c9', 'c10'], ['c11'], ['c12', 'c13']][i] ?? ['c8'])
            : i < 6
              ? ([['c40'], ['c42']][i - 4] ?? ['c40'])
              : ([['c17', 'c18'], ['c19']][i - 6] ?? ['c17']),
      },
    }),
  );
  return withEntries(p, entries);
}

const template = templateById('kp', builtInTemplates());

function basisOf(p: Plan): PageBasis {
  const w = p.weeks[0];
  if (w === undefined) throw new Error('Woche fehlt');
  const frame = pageFrame(pageGeometryFor(template.pageGeometryId), p, w.id);
  return pageBasis(
    frame.grid,
    w.days.map((d) => d.display),
    p.displayRange.to - p.displayRange.from,
  );
}

function boxes(p: Plan, scale: Scale): readonly DayBox[] {
  const w = p.weeks[0];
  if (w === undefined) throw new Error('Woche fehlt');
  return dayBoxes(
    w.days.map((config, index) => {
      const set = p.columnSets.find((s) => s.id === config.columnSetId);
      return {
        date: addDays(w.startDate, index),
        weekday: config.weekday,
        display: config.display,
        setId: set?.id ?? null,
        columns: set?.columns ?? [],
      };
    }),
    scale,
  );
}

interface Line {
  readonly entryId: string;
  readonly text: string;
  /** Lage relativ zur linken Tageskante bzw. zur Oberkante des Zeitbereichs in pt. */
  readonly x: number;
  readonly top: number;
  readonly sizePt: number;
}

/** Bildschirmzeilen aller Blöcke bei einer Zoomstufe (wie das Raster: Tage, Ansichten, Zeilen in px ÷ Faktor). */
function screenLines(p: Plan, zoom: ZoomSetting, available: { width: number; height: number }) {
  const basis = basisOf(p);
  const f = pageFactor(zoom, basis, available, 24, 60);
  const scale = pageScaleOf(basis, f);
  const days = boxes(p, scale);
  const entries = Object.values(p.entries);
  const views = layoutViews({
    plan: p,
    weekId: 'w26',
    days,
    entries,
    scale,
    template,
    viewsOf: (d) => dayViews(p, d, entries, scale, template, querbalkenLanes([])),
  });
  const out: Line[] = [];
  for (const d of days)
    for (const v of views.get(d.date) ?? [])
      for (const l of v.render?.lines ?? [])
        out.push({
          entryId: v.id,
          text: l.runs.map((r) => r.text).join(''),
          x: (v.rect.left + l.left) / f,
          top: (v.rect.top + l.top) / f,
          sizePt: l.fontPx / f,
        });
  return { lines: out, f, scale, days, basis };
}

/** Zeilen derselben Woche im PDF-Rahmen (`layoutGrid` mit `pageFrame`), relativ zu Tag und Zeitbereich. */
function pdfLines(p: Plan) {
  const frame = pageFrame(pageGeometryFor(template.pageGeometryId), p, 'w26');
  const grid = layoutGrid({
    plan: p,
    weekId: 'w26',
    template,
    frame: frame.grid,
    showStatus: true,
  });
  const out: Line[] = [];
  for (const item of grid.items) {
    if (item.kind !== 'text' || item.entryId === undefined) continue;
    const t = item as TextItem;
    const day = grid.days.find((d) => d.x <= t.frame.x + 1e-6 && t.frame.x < d.x + d.w);
    if (day === undefined) continue;
    out.push({
      entryId: item.entryId,
      text: t.runs.map((r) => r.text).join(''),
      x: t.x - day.x,
      top: t.baselineY - t.sizePt - grid.timeScale.yTop,
      sizePt: t.sizePt,
    });
  }
  return { lines: out, grid };
}

const STUFEN: readonly {
  readonly name: string;
  readonly zoom: ZoomSetting;
  readonly w: number;
  readonly h: number;
}[] = [
  { name: '50 %', zoom: { kind: 'level', value: 0.5 }, w: 1500, h: 800 },
  { name: '100 %', zoom: { kind: 'level', value: 1 }, w: 1500, h: 800 },
  { name: '200 %', zoom: { kind: 'level', value: 2 }, w: 1500, h: 800 },
  { name: 'Einpassen breit', zoom: { kind: 'fit' }, w: 1900, h: 600 },
  { name: 'Einpassen hoch', zoom: { kind: 'fit' }, w: 900, h: 1200 },
];

function byEntry(lines: readonly Line[]): Map<string, Line[]> {
  const m = new Map<string, Line[]>();
  for (const l of lines) m.set(l.entryId, [...(m.get(l.entryId) ?? []), l]);
  return m;
}

describe('F-UX2 P1: Editor-Raster = PDF-Seite, gleichmässig skaliert', () => {
  const p = plan();
  const pdf = pdfLines(p);

  it.each(STUFEN.map((s) => [s.name, s] as const))(
    '[R-5-01][R-5-02] %s: Tagesbreiten und Minutenhöhe wie im PDF, ein Faktor für beide Richtungen',
    (_name, s) => {
      const r = screenLines(p, s.zoom, { width: s.w, height: s.h });
      expect(screenFactor(r.scale)).toBe(r.f);
      expect(r.scale.minute / r.f).toBeCloseTo(pdf.grid.timeScale.ptPerMinute, 9);
      expect(r.days.map((d) => d.width / r.f)).toEqual(
        pdf.grid.days.map((d) => expect.closeTo(d.w, 6) as unknown as number),
      );
    },
  );

  it.each(STUFEN.map((s) => [s.name, s] as const))(
    '[R-5-01] %s: jede Blockzeile mit Text, Grösse und Lage wie im PDF (Toleranz 0,05 pt)',
    (_name, s) => {
      const screen = byEntry(screenLines(p, s.zoom, { width: s.w, height: s.h }).lines);
      const paper = byEntry(pdf.lines);
      expect(paper.size).toBe(TITEL.length);
      expect([...screen.keys()].sort()).toEqual([...paper.keys()].sort());
      for (const [id, lines] of paper) {
        const own = screen.get(id) ?? [];
        expect(
          own.map((l) => l.text),
          id,
        ).toEqual(lines.map((l) => l.text));
        lines.forEach((l, i) => {
          const o = own[i];
          expect(Math.abs((o?.x ?? Number.NaN) - l.x), `${id} Zeile ${String(i)} x`).toBeLessThan(
            0.05,
          );
          expect(
            Math.abs((o?.top ?? Number.NaN) - l.top),
            `${id} Zeile ${String(i)} y`,
          ).toBeLessThan(0.05);
          expect(o?.sizePt).toBeCloseTo(l.sizePt, 6);
        });
      }
    },
  );

  it('[R-5-02] Zoom und Einpassen ändern nie die Umbrüche; «Einpassen» passt die Woche in Breite und Höhe', () => {
    const texts = STUFEN.map((s) =>
      screenLines(p, s.zoom, { width: s.w, height: s.h }).lines.map(
        (l) => `${l.entryId}:${l.text}`,
      ),
    );
    for (const t of texts) expect(t).toEqual(texts[0]);
    for (const s of STUFEN.filter((x) => x.zoom.kind === 'fit')) {
      const r = screenLines(p, s.zoom, { width: s.w, height: s.h });
      const width = r.days.reduce((a, d) => a + d.width, 0);
      const height = 24 + r.f * (r.basis.columnHeadPt + r.basis.minutes * r.basis.ptPerMinute + 60);
      expect(width).toBeLessThanOrEqual(s.w + 1e-6);
      expect(height).toBeLessThanOrEqual(s.h + 1e-6);
      // Mindestens eine Richtung ist ausgeschöpft (auf 1 % genau).
      expect(Math.max(width / s.w, height / s.h)).toBeGreaterThan(0.99);
    }
  });
});
