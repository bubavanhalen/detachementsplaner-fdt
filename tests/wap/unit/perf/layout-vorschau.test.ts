// @vitest-environment node
// PERF (R-5.1-14, R-11-11; Beschrieb 11 «Ziehen folgt der Maus ohne sichtbare Verzögerung»): Beim Ziehen ändert sich
// nur die Vorschau (der gezogene Block bzw. seine Nachbarn). Die Bildschirmansichten aus der Layout-Schicht werden dann
// nur für den betroffenen Tag neu berechnet; alle übrigen Tage behalten dieselben Ansichten (Objektidentität), damit
// das Raster sie nicht neu zeichnet. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  dayViews,
  type EntryView,
  querbalkenLanes,
} from '../../../../src/components/wap/i2/entryViews';
import { type DayBox, dayBoxes, type Scale } from '../../../../src/components/wap/i2/geometry';
import { layoutViews } from '../../../../src/components/wap/i2/layoutViews';
import { addDays } from '../../../../src/model/wap/calendar';
import { builtInTemplates, templateById } from '../../../../src/model/wap/template';
import type { Entry, IsoDate, Plan } from '../../../../src/model/wap/types';
import { basePlan, block, rt, withEntries } from '../../support/model/builders';

const SCALE: Scale = { minute: 0.8, day: 360 };
const MO = '2026-09-28';
const MI = '2026-09-30';
const FR = '2026-10-02';
const one = { kind: 'ids', ids: ['c8'] } as const;

function range(from: number, to: number) {
  return { form: 'range', from, to } as const;
}

/** Fiktive Woche w26 mit Blöcken am Mo, Mi und Fr; eigene Plan-ID je Test (Zwischenspeicher der Layout-Schicht). */
function plan(id: string): Plan {
  return withEntries(basePlan({ id }), [
    block('eMo1', 1, { date: MO, title: rt('Alpha', true), time: range(480, 540), columns: one }),
    block('eMo2', 2, { date: MO, title: rt('Bravo', true), time: range(540, 600), columns: one }),
    block('eMi1', 3, { date: MI, title: rt('Charlie', true), time: range(480, 600), columns: one }),
    block('eMi2', 4, { date: MI, title: rt('Delta', true), time: range(600, 660), columns: one }),
    block('eFr1', 5, { date: FR, title: rt('Echo', true), time: range(720, 840), columns: one }),
  ]);
}

function boxes(p: Plan): readonly DayBox[] {
  const week = p.weeks[0];
  if (week === undefined) throw new Error('Woche fehlt');
  return dayBoxes(
    week.days.map((config, index) => {
      const set = p.columnSets.find((s) => s.id === config.columnSetId);
      return {
        date: addDays(week.startDate, index),
        weekday: config.weekday,
        display: config.display,
        setId: set?.id ?? null,
        columns: set?.columns ?? [],
      };
    }),
    SCALE,
  );
}

/** Ansichten wie im Raster (GridEditor) und die Tage, für die `viewsOf` gerufen wurde. */
function run(p: Plan, days: readonly DayBox[], entries: readonly Entry[]) {
  const template = templateById(p.templateId, builtInTemplates());
  const lanes = querbalkenLanes(entries.filter((e) => e.type === 'querbalken'));
  const laid: IsoDate[] = [];
  const views = layoutViews({
    plan: p,
    weekId: 'w26',
    days,
    entries,
    scale: SCALE,
    template,
    viewsOf: (day) => {
      laid.push(day.date);
      return dayViews(p, day, entries, SCALE, template, lanes);
    },
  });
  return { views, laid };
}

/** Wie `displayEntries` im Raster beim Ziehen: nur der geänderte Eintrag ist ein neues Objekt. */
function moved(entries: readonly Entry[], id: string, from: number, to: number): Entry[] {
  return entries.map((e) =>
    e.id === id && e.type === 'block' ? { ...e, time: range(from, to) } : e,
  );
}

function ids(list: readonly EntryView[] | undefined): string[] {
  return (list ?? []).map((v) => v.id);
}

describe('PERF: Layout beim Ziehen nur für die Vorschau', () => {
  it('[R-5.1-14] erster Aufruf legt alle sichtbaren Tage, ein unveränderter zweiter keinen', () => {
    const p = plan('perf-plan-1');
    const days = boxes(p);
    const entries = Object.values(p.entries);
    const first = run(p, days, entries);
    expect(first.laid).toEqual(days.map((d) => d.date));
    expect(ids(first.views.get(MO))).toEqual(['eMo1', 'eMo2']);
    const second = run(p, days, entries);
    expect(second.laid).toEqual([]);
    for (const d of days) expect(second.views.get(d.date)).toBe(first.views.get(d.date));
  });

  it('[R-5.1-14] Vorschau eines verschobenen Blocks berechnet nur dessen Tag neu, die übrigen Tage bleiben dieselben Objekte', () => {
    const p = plan('perf-plan-2');
    const days = boxes(p);
    const entries = Object.values(p.entries);
    const before = run(p, days, entries);
    // Jede Lage beim Ziehen (wie displayEntries): Mi-Block nacheinander auf 0815, 0830, 0845 verschoben.
    let last = before;
    for (const from of [495, 510, 525]) {
      last = run(p, days, moved(entries, 'eMi1', from, from + 120));
      expect(last.laid).toEqual([MI]);
      for (const d of days)
        if (d.date !== MI) expect(last.views.get(d.date)).toBe(before.views.get(d.date));
    }
    const mi = last.views.get(MI)?.find((v) => v.id === 'eMi1');
    expect(mi?.from).toBe(525);
  });

  it('[R-5.1-14] Nachbarn der Vorschau (Kante angepasst, Teilstück) betreffen nur ihren Tag', () => {
    const p = plan('perf-plan-3');
    const days = boxes(p);
    const entries = Object.values(p.entries);
    const before = run(p, days, entries);
    // Nachbar «Bravo» am Mo kürzer, dazu ein Teilstück eines geteilten Blocks (Vorschau-ID mit «~»).
    const source = p.entries.eMo2;
    if (source?.type !== 'block') throw new Error('Block fehlt');
    const preview: Entry[] = [
      ...moved(entries, 'eMo2', 555, 600),
      { ...source, id: 'eMo2~0', time: range(540, 550) },
    ];
    const after = run(p, days, preview);
    expect(after.laid).toEqual([MO]);
    expect(ids(after.views.get(MO))).toContain('eMo2~0');
    for (const d of days)
      if (d.date !== MO) expect(after.views.get(d.date)).toBe(before.views.get(d.date));
    // Abbrechen: zurück zum Ausgangsstand ohne neues Layout (Zwischenspeicher nach Inhalt), dieselben Ansichten.
    const back = run(p, days, entries);
    expect(back.laid).toEqual([]);
    for (const d of days) expect(back.views.get(d.date)).toBe(before.views.get(d.date));
  });
});
