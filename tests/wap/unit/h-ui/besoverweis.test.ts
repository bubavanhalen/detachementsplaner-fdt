// @vitest-environment node
// H-UI, Befund CR-H-U-01 (R-5.3-11; Beschrieb 5.3 «Verweis auf die Nummer eines Beso»; Leitplanke 2): Ein Verweis
// «(Nr)» im Titel eines Blocks oder Querbalkens zeigt am Bildschirm dieselbe Nummer wie im PDF, auch wenn der Beso an
// einem anderen Tag der Woche liegt, und folgt einer Umnummerierung sofort (Zeichnung und Name der Ansicht), auch über
// den Render-Zwischenspeicher der Tageslayouts. Fiktive Daten.
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
import type {
  Beso,
  Block,
  Entry,
  IsoDate,
  Plan,
  Querbalken,
} from '../../../../src/model/wap/types';
import { basePlan, beso, block, querbalken, win, withEntries } from '../../support/model/builders';

const SCALE: Scale = { minute: 0.8, day: 360 };
const MO = '2026-09-28';
const DI = '2026-09-29';
const DO = '2026-10-01';
const one = { kind: 'ids', ids: ['c8'] } as const;

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

/** Ansichten wie im Raster (GridEditor): alle Einträge der Woche ausser ganztägigen Bemerkungen. */
function screen(p: Plan): Map<IsoDate, readonly EntryView[]> {
  const template = templateById(p.templateId, builtInTemplates());
  const entries = Object.values(p.entries).filter((e) => e.type !== 'dayRemark');
  const lanes = querbalkenLanes(entries.filter((e) => e.type === 'querbalken'));
  return layoutViews({
    plan: p,
    weekId: 'w26',
    days: boxes(p),
    entries,
    scale: SCALE,
    template,
    viewsOf: (day) => dayViews(p, day, entries, SCALE, template, lanes),
  });
}

/** Gezeichneter Text (alle Zeilen) und Name aller Ansichten eines Eintrags über die Woche. */
function textOf(views: Map<IsoDate, readonly EntryView[]>, id: string) {
  const all = [...views.values()].flat().filter((v) => v.id === id);
  return {
    labels: all.map((v) => v.label).join(' | '),
    drawn: all
      .flatMap((v) => v.render?.lines ?? [])
      .map((l) => l.runs.map((r) => r.text).join(''))
      .join(' / '),
  };
}

const refBlock: Block = block('bMo', 1, {
  date: MO,
  title: [
    { text: 'Begehung ', bold: true },
    { text: '', bold: true, besoRef: 'sDi' },
  ],
  time: { form: 'range', from: 480, to: 720 },
  columns: one,
});

function besoDi(nr: number): Beso {
  return beso('sDi', 2, {
    date: DI,
    besoNumber: nr,
    windows: [win('tsDi', { time: { form: 'point', at: 600 } })],
  });
}

function plan(id: string, entries: readonly Entry[]): Plan {
  return withEntries(basePlan({ id }), entries);
}

describe('H-UI CR-H-U-01: Verweis auf einen Beso eines anderen Tags', () => {
  it('[R-5.3-11] Block am Mo verweist auf den Beso am Di: Bildschirm zeichnet «(21)» wie das PDF', () => {
    const s = textOf(screen(plan('hui-ref-1', [refBlock, besoDi(21)])), 'bMo');
    expect(s.drawn).toContain('(21)');
    expect(s.labels).toContain('(21)');
  });

  it('[R-5.3-11] Umnummerierung des Beso am Di: Zeichnung und Name des Blocks am Mo folgen (gleiches Block-Objekt)', () => {
    const before = textOf(screen(plan('hui-ref-2', [refBlock, besoDi(21)])), 'bMo');
    expect(before.drawn).toContain('(21)');
    const after = textOf(screen(plan('hui-ref-2', [refBlock, besoDi(23)])), 'bMo');
    expect(after.drawn).toContain('(23)');
    expect(after.drawn).not.toContain('(21)');
    expect(after.labels).toContain('(23)');
  });

  it('[R-5.3-11] Umnummerierung mit neuem, inhaltsgleichem Block-Objekt: kein veralteter Stand aus dem Zwischenspeicher', () => {
    textOf(screen(plan('hui-ref-3', [{ ...refBlock }, besoDi(21)])), 'bMo');
    const after = textOf(screen(plan('hui-ref-3', [{ ...refBlock }, besoDi(22)])), 'bMo');
    expect(after.drawn).toContain('(22)');
    expect(after.labels).toContain('(22)');
  });

  it('[R-5.3-11] Verweis ohne Ziel zeigt «(–)», nach dem Anlegen des Beso dessen Nummer', () => {
    const missing = textOf(screen(plan('hui-ref-4', [refBlock])), 'bMo');
    expect(missing.drawn).toContain('(–)');
    const found = textOf(screen(plan('hui-ref-4', [refBlock, besoDi(7)])), 'bMo');
    expect(found.drawn).toContain('(7)');
  });

  it('[R-5.3-11] Querbalken verweist auf einen Beso am Do: Bildschirm zeichnet die Nummer und folgt der Umnummerierung', () => {
    const qb: Querbalken = querbalken('qMo', 3, {
      fromDate: MO,
      toDate: DI,
      title: [
        { text: 'Übung ', bold: true },
        { text: '', bold: true, besoRef: 'sDo' },
      ],
    });
    const besoDo = (nr: number): Beso =>
      beso('sDo', 4, {
        date: DO,
        besoNumber: nr,
        windows: [win('tsDo', { time: { form: 'point', at: 900 } })],
      });
    const a = textOf(screen(plan('hui-ref-5', [qb, besoDo(31)])), 'qMo');
    expect(a.drawn).toContain('(31)');
    const b = textOf(screen(plan('hui-ref-5', [qb, besoDo(32)])), 'qMo');
    expect(b.drawn).toContain('(32)');
  });
});
